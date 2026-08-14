# Seed Production Log — offline PWA (plain JS) + Google Sheet sync

An offline-first field logging app for seed production. It is a **plain static
web app** (HTML + one JavaScript file) — no WebAssembly, no server, no
framework — so it is reliable and installs as a phone app. It saves records to
the browser's **IndexedDB** while offline and **uploads them to a Google Sheet**
automatically when back online. R or Python then reads the Sheet for analysis.

## Why this design

Running R/Python *in the browser* needs WebAssembly (shinylive / Pyodide), whose
large runtime fights the service worker that offline needs. This app avoids that
entirely: the offline UI is plain JavaScript (tiny, native to the browser), and
R/Python live on the analysis side where connectivity is never an issue.

## How it works

- **Offline:** every saved record goes into IndexedDB on the device. The app
  (installed to the home screen) opens and logs with no signal.
- **Online:** when the device regains connectivity, the app POSTs any
  not-yet-uploaded records to a Google Apps Script web app, which appends them to
  your Google Sheet. Records are then marked uploaded.
- **Backup:** "Export CSV" saves everything on the device to a CSV any time.
- **Analysis:** `analysis/read_data.R` / `.py` pull the Sheet as CSV.

Each device keeps its own records; the Google Sheet is where they all combine.

## Repository layout

```
seed-log-pwa/
├── index.html         # the form + records UI
├── app.js             # IndexedDB, save/list, online sync, CSV export
├── sw.js              # service worker (precache — offline support)
├── manifest.json      # PWA manifest
├── icon-192.png / icon-512.png
├── apps-script/Code.gs   # Google Apps Script sync endpoint
├── analysis/read_data.R  # R reader
├── analysis/read_data.py # Python reader
├── .github/workflows/deploy.yml  # publishes the static site to Pages
└── README.md
```

## Setup

### 1. Google Sheet + sync endpoint
1. Create a new Google Sheet (it will store the records).
2. **Extensions → Apps Script**, delete the sample, paste `apps-script/Code.gs`, Save.
3. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access*
   **Anyone**. Deploy, authorise, and **copy the Web app URL**.
4. Open `app.js` and set `ENDPOINT` to that URL.

### 2. Publish the app on GitHub Pages
1. Push this folder to a GitHub repo (`main`).
2. **Settings → Pages → Source: GitHub Actions.** (The workflow just uploads the
   static files — no build, nothing to fail.) Alternatively set
   *Deploy from a branch → main → /(root)*; both work for a static site.
3. Your app appears at `https://USERNAME.github.io/REPO/`.

### 3. Install on Android
Open the Pages URL in Chrome **with a connection**, let it load once (small),
then **⋮ → Add to Home screen**. After that it opens and logs offline; it uploads
to the Sheet whenever the phone is online.

## Reading the data (R or Python)
Set your Sheet ID in `analysis/read_data.R` or `.py` and run it — it pulls the
Sheet as CSV and prints a quick area-by-crop-and-season summary you can build on.

## Updating the app
Edit files, commit — Pages redeploys. When you change `app.js`/`index.html`, bump
`CACHE` in `sw.js` (e.g. `seedlog-v2`) so installed devices pick up the new
version instead of a cached old one.

## Notes & limits
- **CORS:** the upload uses a plain-text POST body, which avoids a CORS preflight;
  the Apps Script must be deployed with *Who has access: Anyone*. If uploads fail
  with a CORS error, re-check that deployment setting.
- **Security:** the endpoint URL is public (anyone with it can append rows). Fine
  for internal field logging; if you need access control, put a shared secret in
  the request and check it in `Code.gs`, or switch the sync target to Supabase or
  a small Python backend.
- **No shared DB on-device:** each phone holds its own records until they upload.
