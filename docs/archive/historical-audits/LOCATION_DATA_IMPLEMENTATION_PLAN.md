# Location Data Implementation Plan: Comprehensive Local Geographic Engine

**Date:** August 27, 2026  
**Auditor / Systems Architect:** LeadForge OS Systems Engineering & Architecture  
**Execution Phase:** Phase 10I-R1

---

## 1. High-Level Technical Architecture

```
[ Authoritative MIT / ISO Dataset ]
              ↓ (One-time extraction & validation)
apps/desktop/src/shared/locations/
  ├── types.ts              (LocationCountry, LocationRegion, LocationCity)
  ├── data/
  │    ├── countries.json   (249 ISO-3166-1 countries, ISO-2, ISO-3, names, phone codes)
  │    ├── regions.json     (ISO-3166-2 subdivisions indexed by countryCode)
  │    └── cities.json      (Populated cities indexed by `${countryCode}-${regionCode}`)
  └── index.ts              (High-performance in-memory indexing & lookup engine)
              ↓
apps/desktop/src/shared/utils/locations.ts (Adapter Layer)
  ├── COUNTRIES, STATES_BY_COUNTRY, TOP_CITIES_BY_STATE
  ├── getCountries(), getStatesForCountry(), getCitiesForState()
  ├── normalizeCountryName(), normalizeStateName()
  └── searchLocations()
              ↓
  ┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
  │                         │                         │                         │
Renderer (Discovery UI)   Worker (Scraper)        IPC & CRM (Audiences)     Test Suites
- Searchable Country      - ISO state regex       - SQLite resolver         - Comprehensive
- Cascading Region         - Bidirectional map     - MongoDB resolver         geo test suite
- Optional City            - Canonical store       - Distinct values         - Footprint audit
```

---

## 2. Proposed Changes by Component

### Component A: Local Pinned Geographic Dataset Module
**Directory:** `apps/desktop/src/shared/locations/`

1. **`types.ts`**:
   Define canonical TypeScript contracts:
   ```typescript
   export interface LocationCountry {
     code: string;       // ISO 3166-1 alpha-2 (e.g. 'US', 'CA', 'GB', 'IN', 'DE')
     name: string;       // Canonical English name (e.g. 'United States')
     iso3?: string;      // ISO 3166-1 alpha-3 (e.g. 'USA')
     phoneCode?: string; // International dialing code (e.g. '+1')
   }

   export interface LocationRegion {
     code: string;       // ISO 3166-2 subdivision code (e.g. 'FL', 'ON', 'NSW', 'BY')
     name: string;       // Canonical subdivision name (e.g. 'Florida', 'Ontario')
     countryCode: string;// Parent country ISO code (e.g. 'US')
   }

   export interface LocationCity {
     name: string;       // City name (e.g. 'Miami', 'Toronto')
     regionCode: string; // Parent region code (e.g. 'FL')
     countryCode: string;// Parent country code (e.g. 'US')
   }
   ```

2. **`data/countries.json`**:
   Complete list of all 249 ISO-3166-1 countries with ISO alpha-2, alpha-3, canonical names, and dial codes (~15 KB).

3. **`data/regions.json`**:
   Complete dictionary of first-level administrative subdivisions (states, provinces, regions, cantons, departments, territories) for all 249 countries (~170 KB). Every region has a standard subdivision code and canonical name.

4. **`data/cities.json`**:
   Hierarchically keyed dataset of populated cities indexed by country and subdivision code (`${countryCode}-${regionCode}`). Includes major economic centers and population hubs across all supported regions without bloating the bundle with unpopulated hamlets.

5. **`index.ts`**:
   Provides in-memory indexed maps (`Map<string, LocationCountry>`, `Map<string, LocationRegion[]>`, etc.) for $O(1)$ lookups, case-insensitive natural-language search, and normalization.

---

### Component B: Location Adapter Layer
**File:** `apps/desktop/src/shared/utils/locations.ts` & `apps/desktop/src/renderer/lib/locations.ts`

- Refactor `locations.ts` into a lightweight, fully backward-compatible adapter over the pinned dataset:
  - `COUNTRIES`: Replaced with all 249 countries.
  - `STATES_BY_COUNTRY`: Replaced with complete world subdivision dataset.
  - `TOP_CITIES_BY_STATE`: Replaced with hierarchical city index.
  - `getCountries()`: Returns complete 249-country array.
  - `getStatesForCountry(country)`: Accepts ISO code, ISO-3 code, or country name (case-insensitive) and returns all regions for that country.
  - `getCitiesForState(country, state)`: Accepts country and state (code or name) and returns available cities.
  - `normalizeCountryName(input)`: Bidirectionally maps any ISO code (e.g. `'US'`, `'USA'`), abbreviation, or alternate name to its canonical display name (`'United States'`).
  - `normalizeStateName(input, country?)`: Bidirectionally maps subdivision codes (e.g. `'FL'`, `'ON'`, `'NSW'`) and case-insensitive names to their canonical name (`'Florida'`).
  - `getCountryByCode(code)` and `getStateByCode(countryCode, stateCode)`: Direct code-based accessors.

---

### Component C: UI & Discovery Screen UX
**File:** `apps/desktop/src/renderer/screens/DiscoveryScreen.tsx`

- Preserve and enhance cascading UX:
  1. **Country (REQUIRED):** Searchable dropdown / select containing all 249 countries with ISO code tags. Selecting a country clears and resets state and city selections.
  2. **State / Region (REQUIRED):** Searchable input backed by `<datalist id="states-datalist">` containing all available administrative regions for the selected country (with code and name). Users can also type custom regions.
  3. **City (OPTIONAL):** Searchable input backed by `<datalist id="cities-datalist">` containing populated cities for the chosen state/region. Custom city input remains supported.
  4. Empty or unlisted cities will **never** prevent discovery creation if Country and State are valid.

---

### Component D: Scraper Normalization Layer
**File:** `apps/desktop/src/main/workers/plugins/scraper.ts`

- Enhance location token parsing:
  - Leverage the comprehensive 249-country index to identify country tokens from the raw Google Maps address.
  - Contextualize state parsing: when country is identified (or defaults to the discovery run's country), state abbreviations are matched against that country's exact ISO-3166-2 subdivision table rather than a generic US-only regex.
  - Ensure persisted `country`, `state`, and `city` strictly match the canonical display names used by the UI.

---

### Component E: Verification & Test Engineering
**File:** `apps/desktop/src/main/services/locations.test.ts` (New test suite)

Create an automated test suite verifying:
1. **Full Enumeration:** All 249 countries can be enumerated with unique ISO codes.
2. **Subdivision Resolution:** Country -> Regions works across Americas, Europe, Asia, Africa, Oceania.
3. **City Resolution:** Region -> Cities works for major global regions.
4. **Natural-Language Search:** Partial search matches case-insensitively.
5. **Bidirectional Normalization:**
   - `"US"` -> `"United States"`, `"USA"` -> `"United States"`, `"DE"` -> `"Germany"`, `"GB"` -> `"United Kingdom"`.
   - `"FL"` -> `"Florida"`, `"CA"` -> `"California"`, `"ON"` -> `"Ontario"`, `"NSW"` -> `"New South Wales"`, `"BY"` -> `"Bavaria (Bayern)"`.
6. **Scraper Extraction Parity:** Scraped address strings normalize to identical canonical values as UI selections.
7. **Audience Filter Parity:** Both local SQLite and remote MongoDB audience queries match normalized records.
8. **Performance Footprint:** Verification that total dataset bundle footprint is minimal (< 200 KB for core data) and initial renderer startup executes in < 5ms.

---

## 3. Atomic Implementation Steps

1. **Step 1:** Build the pinned dataset in `apps/desktop/src/shared/locations/` (types, countries, regions, cities, and index).
2. **Step 2:** Refactor `apps/desktop/src/shared/utils/locations.ts` into a backward-compatible adapter over the dataset.
3. **Step 3:** Update scraper address extraction and normalization in `apps/desktop/src/main/workers/plugins/scraper.ts`.
4. **Step 4:** Update `DiscoveryScreen.tsx` to utilize the comprehensive dataset with responsive searchable dropdowns.
5. **Step 5:** Create automated test suite in `apps/desktop/src/main/services/locations.test.ts` and register it in `scripts/run-tests.js`.
6. **Step 6:** Run full test suite, verify types, and produce packaged build.
