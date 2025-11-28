# Postal Code Scanner Tool

Reads postal codes from a CSV file and queries Elections Canada to find electoral district information.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Place your CSV file named `CiviCRM_Contact_Search.csv` in this directory
   - The CSV should have a column titled "Postal Code" (column BH)

## Usage

Run the scanner:
```bash
npm start
```

The tool will:
1. Read all postal codes from the CSV file
2. Query Elections Canada for each postal code
3. Display results in the console
4. Save results to `results.json`

## Output

Results are saved to `results.json` with the following structure:
```json
[
  {
    "postalCode": "K1A 0B1",
    "electoralDistrict": "Ottawa—Vanier",
    "additionalInfo": [...]
  }
]
```

## Dependencies

- `csv-parser`: Parse CSV files
- `axios`: Make HTTP requests
- `cheerio`: Parse HTML responses

