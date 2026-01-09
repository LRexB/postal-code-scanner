const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const cheerio = require('cheerio');

// Configuration
const CSV_FILE = 'CiviCRM_Contact_Search.csv';
const ELECTIONS_URL = 'https://www.elections.ca/scripts/vis/FindED';

// Helper function to find best match in dropdown options
function findBestMatch(options, searchText) {
  if (!searchText || !options || options.length === 0) return null;
  
  const search = searchText.toLowerCase().trim();
  
  // Try exact match first
  for (const opt of options) {
    if (opt.text.toLowerCase() === search) {
      return opt;
    }
  }
  
  // Try case-insensitive contains
  for (const opt of options) {
    if (opt.text.toLowerCase().includes(search) || search.includes(opt.text.toLowerCase())) {
      return opt;
    }
  }
  
  // Try partial match (first significant word)
  const searchWords = search.split(/\s+/).filter(w => w.length > 2);
  for (const word of searchWords) {
    for (const opt of options) {
      if (opt.text.toLowerCase().includes(word)) {
        return opt;
      }
    }
  }
  
  return null;
}

// Helper function to extract street number from address
function extractStreetNumber(fullAddress, streetName) {
  if (!fullAddress) return '';
  
  // Remove the street name portion to isolate the number
  const beforeStreet = fullAddress.split(streetName)[0];
  
  // Extract numbers, handling formats like "107-280", "280", "107 - 280", etc.
  const numberMatch = beforeStreet.match(/(\d+[\s-]*\d*)/);
  if (numberMatch) {
    return numberMatch[1].trim();
  }
  
  // Fallback: just grab first number sequence
  const firstNumber = fullAddress.match(/^\s*(\d+)/);
  return firstNumber ? firstNumber[1] : '';
}

// Function to query Elections Canada by full address with dropdown form
async function queryByAddress(streetAddress, city, postalCode, province = 'ON') {
  try {
    console.log(`   🔄 Trying address lookup: ${streetAddress}, ${city}`);
    
    // First, get the form page with postal code to get dropdown options
    const formUrl = `${ELECTIONS_URL}?L=e&PAGEID=20&PC=${encodeURIComponent(postalCode.replace(/\s+/g, ''))}`;
    
    const formResponse = await axios.get(formUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(formResponse.data);
    const bodyText = $('body').text();
    
    // Check if this page requires address details (has dropdowns)
    if (!bodyText.includes('We will need your address') && 
        !bodyText.includes('Entering incomplete address information')) {
      console.log(`   ⚠️  Form doesn't require address details`);
      return null;
    }
    
    console.log(`   📋 Found address form, parsing dropdowns...`);
    
    // Parse city dropdown options
    const cityOptions = [];
    $('select[name="CITY"] option, select[name="city"] option').each((i, elem) => {
      const value = $(elem).attr('value');
      const text = $(elem).text().trim();
      if (value && text && value !== '') {
        cityOptions.push({ value, text });
      }
    });
    
    // Parse street name dropdown options  
    const streetOptions = [];
    $('select[name="ST"] option, select[name="st"] option, select[name="STREET"] option').each((i, elem) => {
      const value = $(elem).attr('value');
      const text = $(elem).text().trim();
      if (value && text && value !== '') {
        streetOptions.push({ value, text });
      }
    });
    
    console.log(`   📊 Found ${cityOptions.length} city options, ${streetOptions.length} street options`);
    
    if (cityOptions.length === 0 || streetOptions.length === 0) {
      console.log(`   ⚠️  No dropdown options found`);
      return null;
    }
    
    // Find best matches
    const selectedCity = findBestMatch(cityOptions, city);
    const selectedStreet = findBestMatch(streetOptions, streetAddress);
    
    if (!selectedCity || !selectedStreet) {
      console.log(`   ⚠️  Could not match city or street in dropdowns`);
      console.log(`      City match: ${selectedCity ? selectedCity.text : 'none'}`);
      console.log(`      Street match: ${selectedStreet ? selectedStreet.text : 'none'}`);
      return null;
    }
    
    console.log(`   ✓ Matched city: "${selectedCity.text}"`);
    console.log(`   ✓ Matched street: "${selectedStreet.text}"`);
    
    // Extract street number
    const streetNumber = extractStreetNumber(streetAddress, selectedStreet.text);
    console.log(`   ✓ Street number: "${streetNumber}"`);
    
    // Submit the form with selected values
    const submitUrl = ELECTIONS_URL;
    const formData = {
      L: 'e',
      PAGEID: '20',
      PC: postalCode.replace(/\s+/g, ''),
      CITY: selectedCity.value,
      ST: selectedStreet.value,
      STN: streetNumber,
      PROV: province
    };
    
    const submitResponse = await axios.post(submitUrl, 
      new URLSearchParams(formData).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      }
    );

    // Parse the result
    const $result = cheerio.load(submitResponse.data);
    const h2Text = $result('h2').first().text().trim();
    
    // Valid electoral districts typically have a dash and province in parentheses
    if (h2Text && 
        h2Text.length > 3 && 
        h2Text !== 'Find your electoral district' &&
        h2Text !== 'Am I registered to vote?' &&
        (h2Text.includes('--') || h2Text.includes('(Ontario)') || h2Text.includes('(Quebec)'))) {
      console.log(`   ✅ Address lookup successful: ${h2Text}`);
      return h2Text;
    }
    
    console.log(`   ⚠️  Address lookup did not return valid district (got: "${h2Text}")`);
    return null;
  } catch (error) {
    console.error(`   ❌ Error querying address:`, error.message);
    return null;
  }
}

// Function to query Elections Canada for a postal code
async function queryPostalCode(postalCode, streetAddress = '', city = '') {
  try {
    console.log(`\n📍 Querying postal code: ${postalCode}`);
    
    // Construct the GET request URL with query parameters
    const url = `${ELECTIONS_URL}?L=e&PAGEID=20&PC=${encodeURIComponent(postalCode)}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    // Parse the HTML response
    const $ = cheerio.load(response.data);
    
    // Extract electoral district information
    const results = {
      postalCode: postalCode,
      electoralDistrict: '',
      districtNumber: '',
      mp: '',
      party: '',
      additionalInfo: []
    };

    // Extract electoral district name from first h2 tag
    const h2Text = $('h2').first().text().trim();
    if (h2Text && h2Text.length > 3) {
      results.electoralDistrict = h2Text;
    }

    // Check if the page contains the error message about needing full address
    const bodyText = $('body').text();
    const needsAddress = bodyText.includes('We will need your address to find your electoral district') ||
                         bodyText.includes('Entering incomplete address information may lead to errors');
    
    // If postal code lookup failed and we have address info, try address lookup
    if ((needsAddress || !results.electoralDistrict || results.electoralDistrict === 'Find your electoral district') 
        && streetAddress && city) {
      console.log(`   ⚠️  Postal code lookup incomplete - trying address lookup`);
      const addressResult = await queryByAddress(streetAddress, city, postalCode);
      if (addressResult) {
        results.electoralDistrict = addressResult;
      }
    }

    // Extract detailed information from the page (only if we have a valid district)
    if (results.electoralDistrict && results.electoralDistrict !== 'Find your electoral district') {
      // Extract population
      const popMatch = bodyText.match(/Population:\s*([\d,]+)/);
      if (popMatch) {
        results.population = popMatch[1];
      }

      // Extract registered voters
      const votersMatch = bodyText.match(/Registered voters\s*([\d,]+)/);
      if (votersMatch) {
        results.registeredVoters = votersMatch[1];
      }

      // Extract polling divisions
      const pollingMatch = bodyText.match(/Number of polling divisions:\s*(\d+)/);
      if (pollingMatch) {
        results.pollingDivisions = pollingMatch[1];
      }

      // Extract MP information
      const mpSection = bodyText.match(/Your Member of Parliament(.*?)Last election/s);
      if (mpSection) {
        const mpText = mpSection[1];
        const nameMatch = mpText.match(/Name:\s*([^\n]+)/);
        if (nameMatch) {
          results.mp = nameMatch[1].trim();
        }
        const partyMatch = mpText.match(/Party:\s*([^\n]+)/);
        if (partyMatch) {
          results.party = partyMatch[1].trim();
        }
      }
    }

    // Display results
    console.log('✅ Results:');
    if (results.electoralDistrict && results.electoralDistrict !== 'Find your electoral district') {
      console.log(`   Electoral District: ${results.electoralDistrict}`);
    }
    if (results.population) {
      console.log(`   Population: ${results.population}`);
    }
    if (results.registeredVoters) {
      console.log(`   Registered Voters: ${results.registeredVoters}`);
    }
    if (results.pollingDivisions) {
      console.log(`   Polling Divisions: ${results.pollingDivisions}`);
    }
    if (results.mp) {
      console.log(`   MP: ${results.mp}`);
    }
    if (results.party) {
      console.log(`   Party: ${results.party}`);
    }
    
    if (!results.electoralDistrict || results.electoralDistrict === 'Find your electoral district') {
      console.log('   ⚠️  No electoral district information found');
    }

    return results;

  } catch (error) {
    console.error(`❌ Error querying postal code ${postalCode}:`, error.message);
    return {
      postalCode: postalCode,
      error: error.message
    };
  }
}

// Function to process the CSV file
async function processCSV() {
  console.log('🚀 Starting Postal Code Scanner');
  console.log(`📂 Reading CSV file: ${CSV_FILE}\n`);

  const results = [];
  const rowsData = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row) => {
        // Store the entire row data along with postal code
        const postalCode = row['Postal Code'];
        
        if (postalCode && postalCode.trim()) {
          rowsData.push({
              displayName: row['Display Name'] || '',
              streetAddress: row['Street Address'] || '',
              city: row['City'] || '',
              phone: row['Phone'] || '',
              postalCode: postalCode.trim(),
              originalRow: row
            });
        }
      })
      .on('end', async () => {
        console.log(`✅ Found ${rowsData.length} postal codes in CSV\n`);
        console.log('=' .repeat(60));

        // Query each postal code
        for (let i = 0; i < rowsData.length; i++) {
          const rowData = rowsData[i];
          // Remove spaces from postal code for the query
          const postalCodeNoSpaces = rowData.postalCode.replace(/\s+/g, '');
          const result = await queryPostalCode(
            postalCodeNoSpaces, 
            rowData.streetAddress, 
            rowData.city
          );
          
          // Combine original row data with electoral district
          // Filter out invalid district names
          let district = '';
          if (result.electoralDistrict && 
              result.electoralDistrict !== 'Find your electoral district' &&
              result.electoralDistrict !== 'Am I registered to vote?' &&
              !result.electoralDistrict.match(/^K\d[A-Z]/)) { // Not a postal code
            district = result.electoralDistrict;
          }
          
          results.push({
            displayName: rowData.displayName,
            streetAddress: rowData.streetAddress,
            city: rowData.city,
            phone: rowData.phone || '',
            postalCode: rowData.postalCode,
            electoralDistrict: district
          });
          
          // Add a small delay between requests to be polite
          if (i < rowsData.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        console.log('\n' + '=' .repeat(60));
        console.log(`\n✅ Completed processing ${results.length} postal codes`);
        
        // Save results to JSON file
        const jsonOutputFile = 'results.json';
        fs.writeFileSync(jsonOutputFile, JSON.stringify(results, null, 2));
        console.log(`💾 Full results saved to ${jsonOutputFile}`);
        
        // Save results to CSV file
        const csvOutputFile = 'PostalCodesFound.csv';
        const csvHeader = '"Display Name","Street Address","City","Phone","Postal Code","Electoral District"\n';
        const csvRows = results.map(r => {
          const escapeCsv = (str) => {
            if (!str) return '""';
            const strVal = String(str);
            if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
              return `"${strVal.replace(/"/g, '""')}"`;
            }
            return `"${strVal}"`;
          };
          return [
            escapeCsv(r.displayName),
            escapeCsv(r.streetAddress),
            escapeCsv(r.city),
            escapeCsv(r.phone),
            escapeCsv(r.postalCode),
            escapeCsv(r.electoralDistrict)
          ].join(',');
        }).join('\n');
        
        fs.writeFileSync(csvOutputFile, csvHeader + csvRows);
        console.log(`📊 CSV output saved to ${csvOutputFile}`);
        
        // Print summary
        const withDistricts = results.filter(r => r.electoralDistrict && r.electoralDistrict !== '');
        console.log(`\n📈 Summary:`);
        console.log(`   Total records: ${results.length}`);
        console.log(`   Electoral districts found: ${withDistricts.length}`);
        console.log(`   No district found: ${results.length - withDistricts.length}`);
        
        resolve(results);
      })
      .on('error', (error) => {
        console.error('❌ Error reading CSV:', error.message);
        reject(error);
      });
  });
}

// Main execution
if (require.main === module) {
  processCSV()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { processCSV, queryPostalCode, queryByAddress };

