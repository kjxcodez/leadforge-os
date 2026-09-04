/**
 * Comprehensive Location Engine Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  getCountries,
  getStatesForCountry,
  getCitiesForState,
  normalizeCountryName,
  normalizeStateName,
  getCountryByCode,
  searchLocations
} from '../../shared/utils/locations';

describe('Comprehensive Location Engine Suite', () => {
  it('enumerates all ISO-3166-1 countries with unique 2-letter codes', () => {
    const countries = getCountries();
    expect(countries.length).toBeGreaterThanOrEqual(248);

    const codeSet = new Set<string>();
    for (const c of countries) {
      expect(c.code.length).toBe(2);
      expect(c.name.length).toBeGreaterThan(0);
      expect(codeSet.has(c.code)).toBe(false);
      codeSet.add(c.code);
    }
  });

  it('performs direct ISO code country lookups', () => {
    const us = getCountryByCode('US');
    expect(us).toBeDefined();
    expect(us?.name).toBe('United States');
    expect(us?.iso3).toBe('USA');
    expect(us?.phoneCode).toBe('+1');

    const de = getCountryByCode('DE');
    expect(de).toBeDefined();
    expect(de?.name).toBe('Germany');

    const jp = getCountryByCode('JP');
    expect(jp).toBeDefined();
    expect(jp?.name).toBe('Japan');
  });

  it('resolves administrative subdivisions and states', () => {
    const usStates = getStatesForCountry('US');
    expect(usStates.length).toBeGreaterThanOrEqual(50);
    const fl = usStates.find((s) => s.code === 'FL');
    expect(fl).toBeDefined();
    expect(fl?.name).toBe('Florida');

    const ca = usStates.find((s) => s.code === 'CA');
    expect(ca).toBeDefined();
    expect(ca?.name).toBe('California');
  });

  it('resolves populated cities and returns empty array safely for unknown states', () => {
    const flCities = getCitiesForState('US', 'FL');
    expect(flCities.length).toBeGreaterThan(0);
    expect(flCities).toContain('Miami');

    const unknownCities = getCitiesForState('US', 'NONEXISTENT_STATE');
    expect(unknownCities).toEqual([]);
  });

  it('normalizes country and state names bidirectionally', () => {
    expect(normalizeCountryName('US')).toBe('United States');
    expect(normalizeCountryName('USA')).toBe('United States');
    expect(normalizeCountryName('uk')).toBe('United Kingdom');
    expect(normalizeCountryName('de')).toBe('Germany');
    expect(normalizeCountryName('in')).toBe('India');

    expect(normalizeStateName('FL', 'United States')).toBe('Florida');
    expect(normalizeStateName('CA', 'United States')).toBe('California');
    expect(normalizeStateName('FL')).toBe('Florida');
    expect(normalizeStateName('TX')).toBe('Texas');
  });

  it('performs natural language location searches', () => {
    const searchResults = searchLocations('Miami');
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    const firstResult = searchResults[0]!;
    expect(firstResult.type).toBe('city');
    expect(firstResult.cityName).toBe('Miami');
    expect(firstResult.countryCode).toBe('US');

    const deResults = searchLocations('Germany');
    expect(deResults.some((r) => r.type === 'country' && r.countryCode === 'DE')).toBe(true);
  });
});
