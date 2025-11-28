# Postal Code Scanner - Results Summary

## Overview
Successfully processed **98 postal codes** from `CiviCRM_Contact_Search.csv` and queried Elections Canada for electoral district information.

## Output File
**`PostalCodesFound.csv`** - 8.2KB

### Columns:
1. **Display Name** - Contact name from input CSV
2. **Street Address** - Street address from input CSV
3. **City** - City from input CSV
4. **Postal Code** - Original postal code from input CSV
5. **Electoral District** - Queried from Elections Canada website

## Results Statistics

- **Total Records:** 98
- **Electoral Districts Found:** 94 (96%)
- **No District Found:** 4 (4%)

## Top Electoral Districts

| Electoral District | Count |
|-------------------|-------|
| Ottawa Centre (Ontario) | 18 |
| Ottawa--Vanier--Gloucester (Ontario) | 15 |
| Ottawa West--Nepean (Ontario) | 14 |
| Ottawa South (Ontario) | 7 |
| Nepean (Ontario) | 7 |
| Lanark--Frontenac (Ontario) | 6 |
| Orléans (Ontario) | 5 |
| Carleton (Ontario) | 5 |
| Kanata (Ontario) | 3 |
| Others | 14 |

## Records Without Results

4 records could not be matched to electoral districts:
- **Carp, K0A 1L0** - Rural address
- **Ottawa, K0A1L0** - Rural address (Meadowridge Circle)
- **Navan, K4B 1H9** - Rural area
- **Arnprior, K7S 3G7** - Outside Ottawa region

### Why These Failed

These postal codes trigger the Elections Canada address form, which:
1. Requires selecting a city from a dropdown
2. Dynamically loads street options via JavaScript after city selection  
3. Requires browser-like JavaScript execution to populate the street dropdown

**Technical Limitation:** The tool uses HTTP requests without JavaScript execution. The form's dynamic dropdown population would require:
- Headless browser automation (Puppeteer/Selenium)
- Simulating AJAX calls to fetch street options
- Multi-step form submission

**Workaround:** These addresses could be looked up manually at:
https://www.elections.ca/scripts/vis/FindED

## Success Rate Improvement

By removing spaces from postal codes before querying (e.g., "K1M 1W4" → "K1M1W4"), the success rate improved from **30%** to **96%**.

The script also includes address fallback functionality: if a postal code lookup fails with the message about needing full address information, it automatically attempts to query using the street address and city fields from the CSV.

## Files Generated

1. **`PostalCodesFound.csv`** - Main output file with all requested columns
2. **`results.json`** - Detailed JSON results including population, registered voters, polling divisions
3. **`output.log`** - Complete console output from the scan

## Usage

To run again:
```bash
npm start
```

To process a different CSV file, replace `CiviCRM_Contact_Search.csv` and run the command above.

