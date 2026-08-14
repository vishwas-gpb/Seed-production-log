# Read the synced Seed Production Log from your Google Sheet into Python.
# pip install pandas
#
# Replace SHEET_ID with your sheet's id (the long string in its URL:
# https://docs.google.com/spreadsheets/d/SHEET_ID/edit )

import pandas as pd

SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE"
url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv"

df = pd.read_csv(url)
print("Rows:", len(df))
print(df.head())

# --- example summary: area by crop and season ---
if len(df):
    print(df.groupby(["crop", "season"])["area_ha"].sum())
