# Read the synced Seed Production Log from your Google Sheet into R.
#
# 1. In the Google Sheet: File -> Share -> Publish to web -> (Entire document,
#    CSV) OR just make the sheet viewable, then use the export URL below.
# 2. Replace SHEET_ID with your sheet's id (the long string in its URL:
#    https://docs.google.com/spreadsheets/d/SHEET_ID/edit )

sheet_id <- "1bfQs9LS-zign0eLmWYA8JfJ3LKBcMF7PDRLgtbMbZKU"
url <- paste0("https://docs.google.com/spreadsheets/d/", sheet_id, "/export?format=csv")

df <- read.csv(url, stringsAsFactors = FALSE, check.names = FALSE)

cat("Rows:", nrow(df), "\n")
str(df)

# --- example summaries ---
# lot-wise area by crop and season
if (nrow(df) > 0) {
  agg <- aggregate(area_ha ~ crop + season, data = df, FUN = function(x) sum(as.numeric(x), na.rm = TRUE))
  print(agg)
}
