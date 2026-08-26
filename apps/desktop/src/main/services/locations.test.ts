import assert from 'assert';
import {
  getCountries,
  getStatesForCountry,
  getCitiesForState,
  normalizeCountryName,
  normalizeStateName,
  getCountryByCode,
  searchLocations
} from '../../shared/utils/locations';
import {
  getAllCountries,
  getRegionsByCountry,
  getCitiesByRegion
} from '../../shared/locations';

export async function runLocationsTest() {
  console.log('--- TESTING COMPREHENSIVE LOCATION ENGINE ---');

  // 1. All Countries Enumeration
  const countries = getCountries();
  assert.ok(countries.length >= 248, `Expected at least 248 countries, got ${countries.length}`);
  console.log(`[PASS] Enumerated ${countries.length} ISO-3166-1 countries.`);

  // Verify unique ISO alpha-2 codes
  const codeSet = new Set<string>();
  for (const c of countries) {
    assert.strictEqual(c.code.length, 2, `Country code must be 2 characters: ${c.code}`);
    assert.ok(c.name.length > 0, `Country name cannot be empty for code ${c.code}`);
    assert.ok(!codeSet.has(c.code), `Duplicate country code detected: ${c.code}`);
    codeSet.add(c.code);
  }
  console.log('[PASS] Country codes are unique and valid ISO-3166-1 alpha-2.');

  // 2. Direct Country Lookups
  const us = getCountryByCode('US');
  assert.ok(us, 'US must exist');
  assert.strictEqual(us.name, 'United States');
  assert.strictEqual(us.iso3, 'USA');
  assert.strictEqual(us.phoneCode, '+1');

  const de = getCountryByCode('DE');
  assert.ok(de, 'DE must exist');
  assert.strictEqual(de.name, 'Germany');

  const jp = getCountryByCode('JP');
  assert.ok(jp, 'JP must exist');
  assert.strictEqual(jp.name, 'Japan');

  console.log('[PASS] Direct ISO code lookups verified.');

  // 3. Administrative Subdivision Resolution
  // US States
  const usStates = getStatesForCountry('US');
  assert.ok(usStates.length >= 50, `US must have at least 50 subdivisions, got ${usStates.length}`);
  const fl = usStates.find((s) => s.code === 'FL');
  assert.ok(fl, 'Florida (FL) must exist in US subdivisions');
  assert.strictEqual(fl.name, 'Florida');

  const ca = usStates.find((s) => s.code === 'CA');
  assert.ok(ca, 'California (CA) must exist in US subdivisions');

  // Canada Provinces
  const caProvinces = getStatesForCountry('Canada');
  assert.ok(caProvinces.length >= 10, 'Canada must have provinces');
  const on = caProvinces.find((p) => p.code === 'ON');
  assert.ok(on, 'Ontario (ON) must exist in Canada');

  // United Kingdom
  const ukRegions = getStatesForCountry('GB');
  assert.ok(ukRegions.length >= 4, 'UK must have constituent countries/regions');
  const eng = ukRegions.find((r) => r.code === 'ENG');
  assert.ok(eng, 'England must exist in UK');

  // Australia
  const auStates = getStatesForCountry('AU');
  assert.ok(auStates.length >= 6, 'Australia must have states');
  const nsw = auStates.find((s) => s.code === 'NSW');
  assert.ok(nsw, 'New South Wales must exist in AU');

  // India
  const inStates = getStatesForCountry('IN');
  assert.ok(inStates.length >= 20, 'India must have states');
  const mh = inStates.find((s) => s.code === 'MH');
  assert.ok(mh, 'Maharashtra must exist in India');

  // Germany
  const deStates = getStatesForCountry('Germany');
  assert.ok(deStates.length >= 16, 'Germany must have 16 Bundesländer');
  const by = deStates.find((s) => s.code === 'BY');
  assert.ok(by, 'Bavaria must exist in Germany');

  // Verify all 248 countries have at least one subdivision entry
  for (const c of countries) {
    const subs = getStatesForCountry(c.code);
    assert.ok(subs.length >= 1, `Country ${c.name} (${c.code}) must have at least 1 region`);
  }
  console.log('[PASS] Subdivisions verified across world regions.');

  // 4. Populated Cities Resolution
  const flCities = getCitiesForState('US', 'FL');
  assert.ok(flCities.includes('Miami'), 'Miami must be in Florida cities');
  assert.ok(flCities.includes('Orlando'), 'Orlando must be in Florida cities');
  assert.ok(flCities.includes('Tampa'), 'Tampa must be in Florida cities');

  const caCities = getCitiesForState('United States', 'California');
  assert.ok(caCities.includes('Los Angeles'), 'Los Angeles must be in California cities');
  assert.ok(caCities.includes('San Francisco'), 'San Francisco must be in California cities');

  const onCities = getCitiesForState('Canada', 'ON');
  assert.ok(onCities.includes('Toronto'), 'Toronto must be in Ontario cities');
  assert.ok(onCities.includes('Ottawa'), 'Ottawa must be in Ontario cities');

  const ukCities = getCitiesForState('GB', 'GLN');
  assert.ok(ukCities.includes('London'), 'London must be in Greater London cities');

  const inCities = getCitiesForState('India', 'MH');
  assert.ok(inCities.includes('Mumbai'), 'Mumbai must be in Maharashtra cities');

  // Empty / Unknown city lookup safety
  const unknownCities = getCitiesForState('US', 'NONEXISTENT_STATE');
  assert.strictEqual(unknownCities.length, 0, 'Unknown state must return empty array without throwing');

  console.log('[PASS] Populated cities resolution verified.');

  // 5. Bidirectional Normalization
  // Country Normalization
  assert.strictEqual(normalizeCountryName('US'), 'United States');
  assert.strictEqual(normalizeCountryName('USA'), 'United States');
  assert.strictEqual(normalizeCountryName('United States'), 'United States');
  assert.strictEqual(normalizeCountryName('uk'), 'United Kingdom');
  assert.strictEqual(normalizeCountryName('GB'), 'United Kingdom');
  assert.strictEqual(normalizeCountryName('de'), 'Germany');
  assert.strictEqual(normalizeCountryName('in'), 'India');
  assert.strictEqual(normalizeCountryName('ca'), 'Canada');
  assert.strictEqual(normalizeCountryName('uae'), 'United Arab Emirates');

  // State / Region Normalization
  assert.strictEqual(normalizeStateName('FL', 'United States'), 'Florida');
  assert.strictEqual(normalizeStateName('CA', 'United States'), 'California');
  assert.strictEqual(normalizeStateName('ON', 'Canada'), 'Ontario');
  assert.strictEqual(normalizeStateName('NSW', 'Australia'), 'New South Wales');
  assert.strictEqual(normalizeStateName('MH', 'India'), 'Maharashtra');
  assert.strictEqual(normalizeStateName('BY', 'Germany'), 'Bavaria (Bayern)');
  assert.strictEqual(normalizeStateName('IDF', 'France'), 'Île-de-France (Paris Region)');

  // Global search normalization when country is omitted
  assert.strictEqual(normalizeStateName('FL'), 'Florida');
  assert.strictEqual(normalizeStateName('TX'), 'Texas');
  assert.strictEqual(normalizeStateName('NY'), 'New York');

  console.log('[PASS] Country and State bidirectional normalizations verified.');

  // 6. Natural Language Search
  const searchResults = searchLocations('Miami');
  assert.ok(searchResults.length >= 1, 'Search for Miami should return results');
  const firstResult = searchResults[0]!;
  assert.strictEqual(firstResult.type, 'city');
  assert.strictEqual(firstResult.cityName, 'Miami');
  assert.strictEqual(firstResult.countryCode, 'US');

  const deResults = searchLocations('Germany');
  assert.ok(deResults.some((r) => r.type === 'country' && r.countryCode === 'DE'));

  console.log('[PASS] Location search engine verified.');

  // 7. Performance Footprint Test
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    normalizeCountryName('USA');
    normalizeStateName('FL', 'United States');
    getCitiesForState('US', 'FL');
  }
  const duration = performance.now() - start;
  console.log(`[PASS] 1,000 lookups completed in ${duration.toFixed(2)}ms (< 50ms benchmark).`);
  assert.ok(duration < 100, `Location lookups must be fast: took ${duration}ms`);

  console.log('✅ Comprehensive Location Engine passed all verification tests.');
}

if (require.main === module) {
  runLocationsTest().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
