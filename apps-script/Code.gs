/**
 * Google Apps Script — sync endpoint for the Seed Production Log PWA.
 *
 * SETUP:
 * 1. Create a new Google Sheet (this will hold your records).
 * 2. Extensions -> Apps Script. Delete any code, paste THIS file, Save.
 * 3. Deploy -> New deployment -> type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Deploy, authorise, and COPY the Web app URL.
 * 4. Paste that URL into app.js as ENDPOINT.
 *
 * The phone POSTs {records:[...]} and this appends one row per record to a
 * sheet named "Records" (created automatically on first upload).
 */

var SHEET_NAME = "Records";
var HEADERS = ["lot_id","crop","variety","seed_class","season","year","source_lot",
  "source_class","area_ha","district","block","village","lat","lon","sowing_date",
  "grower","grower_ref","notes","logged_at","device_id","received_at"];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

    var body = JSON.parse(e.postData.contents);
    var records = body.records || [];
    var now = new Date();
    records.forEach(function (r) {
      sheet.appendRow(HEADERS.map(function (h) {
        if (h === "received_at") return now;
        return (r[h] === undefined || r[h] === null) ? "" : r[h];
      }));
    });
    return json({ status: "ok", count: records.length });
  } catch (err) {
    return json({ status: "error", message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ status: "ok", message: "Seed Production Log endpoint is live" });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
