/* Seed Production Log — offline PWA logic
 * Saves records to IndexedDB while offline; uploads to a Google Sheet (via an
 * Apps Script web app) when online. No server, no framework, no WebAssembly.
 *
 * >>> SET THIS to your Apps Script Web App URL (see apps-script/Code.gs) <<< */
const ENDPOINT = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

const CROPS   = ["Paddy/Rice","Pigeonpea","Groundnut","Finger millet (Ragi)","Blackgram","Greengram","Sesame","Other"];
const CLASSES = ["Nucleus","Breeder","Foundation","Certified"];
const SEASONS = ["Kharif","Rabi","Summer"];
const FIELDS  = ["lot_id","crop","variety","seed_class","season","year","source_lot","source_class",
                 "area_ha","district","block","village","lat","lon","sowing_date","grower","grower_ref","notes"];

/* ---------- device id (to tell phones apart in the Sheet) ---------- */
function deviceId() {
  let id = localStorage.getItem("device_id");
  if (!id) { id = "dev-" + Math.random().toString(36).slice(2, 8); localStorage.setItem("device_id", id); }
  return id;
}

/* ---------- IndexedDB (tiny promise wrapper) ---------- */
let _db;
function db() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("seedlog", 1);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains("records"))
        d.createObjectStore("records", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}
function tx(mode) { return db().then((d) => d.transaction("records", mode).objectStore("records")); }
function idbAll() {
  return tx("readonly").then((s) => new Promise((res, rej) => {
    const r = s.getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
  }));
}
function idbPut(rec) {
  return tx("readwrite").then((s) => new Promise((res, rej) => {
    const r = s.put(rec); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
function idbDelete(id) {
  return tx("readwrite").then((s) => new Promise((res, rej) => {
    const r = s.delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  }));
}

/* ---------- UI helpers ---------- */
function el(id) { return document.getElementById(id); }
function fillSelect(id, opts, blankFirst) {
  const s = el(id); s.innerHTML = "";
  (blankFirst ? [""].concat(opts) : opts).forEach((o) => {
    const op = document.createElement("option"); op.value = o; op.textContent = o || "—"; s.appendChild(op);
  });
}
function toast(msg) {
  const t = el("toast"); t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}
function showView(v) {
  el("view-log").classList.toggle("hidden", v !== "log");
  el("view-rec").classList.toggle("hidden", v !== "rec");
  el("tab-log").classList.toggle("active", v === "log");
  el("tab-rec").classList.toggle("active", v === "rec");
  if (v === "rec") render();
}
function setNet() {
  const p = el("net");
  if (navigator.onLine) { p.textContent = "online"; p.classList.remove("off"); }
  else { p.textContent = "offline"; p.classList.add("off"); }
}

/* ---------- form ---------- */
function clearForm() {
  FIELDS.forEach((f) => { if (el(f)) el(f).value = ""; });
  el("year").value = new Date().getFullYear();
  el("crop").selectedIndex = 0; el("seed_class").selectedIndex = 0; el("season").selectedIndex = 0;
  el("source_class").selectedIndex = 0;
}
function useGPS() {
  if (!navigator.geolocation) { toast("Geolocation not supported"); return; }
  toast("Getting GPS…");
  navigator.geolocation.getCurrentPosition(
    (p) => { el("lat").value = p.coords.latitude.toFixed(6); el("lon").value = p.coords.longitude.toFixed(6); toast("GPS captured"); },
    () => toast("Could not get GPS — enable location")
  );
}
async function saveRecord() {
  const missing = [];
  if (!el("lot_id").value.trim())  missing.push("Lot ID");
  if (!el("variety").value.trim()) missing.push("Variety");
  if (!el("area_ha").value)        missing.push("Area (ha)");
  if (missing.length) { toast("Please fill: " + missing.join(", ")); return; }

  const all = await idbAll();
  if (all.some((r) => r.lot_id === el("lot_id").value.trim())) { toast("That Lot ID already exists"); return; }

  const rec = { synced: false, device_id: deviceId(), logged_at: new Date().toISOString() };
  FIELDS.forEach((f) => { rec[f] = el(f) ? el(f).value : ""; });
  await idbPut(rec);
  toast("Record saved");
  clearForm();
  updateCounts();
  syncNow(false); // try to upload right away if online
}

/* ---------- records view ---------- */
async function render() {
  const all = (await idbAll()).sort((a, b) => (b.logged_at || "").localeCompare(a.logged_at || ""));
  const tb = el("rows"); tb.innerHTML = "";
  all.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td></td>" +
      td(r.lot_id) + td(r.crop) + td(r.variety) + td(r.seed_class) + td(r.season) + td(r.area_ha) +
      "<td>" + (r.synced ? "✓ uploaded" : "<span class='badge'>pending</span>") + "</td>" +
      "<td><button class='btn danger small' data-id='" + r.id + "'>Delete</button></td>";
    tb.appendChild(tr);
  });
  tb.querySelectorAll("button[data-id]").forEach((b) =>
    b.addEventListener("click", async () => { await idbDelete(Number(b.dataset.id)); render(); updateCounts(); toast("Deleted"); }));
  updateCounts();
}
function td(v) { return "<td>" + (v == null ? "" : String(v)) + "</td>"; }

async function updateCounts() {
  const all = await idbAll();
  const pending = all.filter((r) => !r.synced).length;
  el("count").textContent = all.length + " saved";
  const u = el("unsynced");
  if (u) { u.textContent = pending + " not yet uploaded"; u.style.display = pending ? "" : "none"; }
}

/* ---------- CSV export ---------- */
async function exportCSV() {
  const all = await idbAll();
  if (!all.length) { toast("No records to export"); return; }
  const cols = FIELDS.concat(["logged_at", "device_id", "synced"]);
  const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const csv = [cols.join(",")].concat(all.map((r) => cols.map((c) => esc(r[c])).join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "seed-log-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- sync to Google Sheet ---------- */
let syncing = false;
async function syncNow(manual) {
  if (syncing) return;
  if (!navigator.onLine) { if (manual) toast("You are offline — will upload when back online"); return; }
  if (ENDPOINT.indexOf("PASTE_YOUR") === 0) { if (manual) toast("Set ENDPOINT in app.js first"); return; }

  const pending = (await idbAll()).filter((r) => !r.synced);
  if (!pending.length) { if (manual) toast("Everything is already uploaded"); return; }

  syncing = true;
  if (manual) toast("Uploading " + pending.length + "…");
  try {
    // text/plain body avoids a CORS preflight; Apps Script reads e.postData.contents
    const res = await fetch(ENDPOINT, { method: "POST", body: JSON.stringify({ records: pending }) });
    const out = await res.json();
    if (out && out.status === "ok") {
      for (const r of pending) { r.synced = true; r.synced_at = new Date().toISOString(); await idbPut(r); }
      toast("Uploaded " + pending.length + " record(s)");
    } else {
      toast("Upload failed: " + (out && out.message ? out.message : "unknown"));
    }
  } catch (e) {
    if (manual) toast("Upload failed — will retry when online");
  } finally {
    syncing = false;
    render(); updateCounts();
  }
}

/* ---------- boot ---------- */
window.addEventListener("online", () => { setNet(); syncNow(false); });
window.addEventListener("offline", setNet);

(function init() {
  fillSelect("crop", CROPS); fillSelect("seed_class", CLASSES); fillSelect("season", SEASONS);
  fillSelect("source_class", CLASSES, true);
  clearForm(); setNet(); updateCounts();
  // one small, own service worker — nothing else registers one, so it is safe
  if ("serviceWorker" in navigator)
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  // try an initial sync if we happen to be online
  setTimeout(() => syncNow(false), 1500);
})();
