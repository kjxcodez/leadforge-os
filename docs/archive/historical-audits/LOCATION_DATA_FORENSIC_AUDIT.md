# Location Data Forensic Audit: Current Geographic Implementation & Consumers

**Date:** August 27, 2026  
**Auditor:** LeadForge OS Systems Engineering & Architecture  
**Scope:** Forensic analysis of all location, country, state/region, and city models, resolvers, UI components, scrapers, and persistence layers across `apps/desktop`, `apps/api`, `packages/schema`, and `packages/sdk`.

---

## 1. Executive Summary & Defect Identification

The current location implementation in LeadForge OS is anchored by a manually maintained, hardcoded file:
`apps/desktop/src/shared/utils/locations.ts` (re-exported by `apps/desktop/src/renderer/lib/locations.ts`).

### Forensic Findings:
1. **Severely Truncated World Coverage:**
   - `COUNTRIES` contains only **40 hardcoded countries** out of 249 ISO-3166-1 countries (leaving out over 80% of the world, including almost all of Central America, Eastern Europe, Central Asia, Southeast Asia, and Africa).
   - `STATES_BY_COUNTRY` defines states/provinces for only **18 countries** (leaving the remaining 22 listed countries with 0 states, and 209 world countries completely unrepresented).
   - `TOP_CITIES_BY_STATE` defines cities for only **43 state keys** across just 7 countries (`US`, `CA`, `GB`, `AU`, `IN`, `DE`, `FR`, `AE`, `NL`). All other countries and states have empty city dropdowns.
2. **Brittle Normalization Fallbacks:**
   - `normalizeCountryName` contains ad-hoc hardcoded string checks (`'usa'`, `'us'`, `'uk'`, `'gb'`, `'uae'`). Any country outside the 40 hardcoded entries fails normalization and falls back to raw user input.
   - `normalizeStateName` only searches within the hardcoded 18 countries. Postal codes and subdivisions for the rest of the world cannot be normalized.
3. **Architectural Confusion Between Display Names and ISO Codes:**
   - The UI dropdowns save display names (e.g. `"United States"`, `"Florida"`, `"Miami"`) into `discovery_runs` and `companies`.
   - The scraper regex extracts US two-letter state abbreviations (`"FL"`), which it attempts to map to `"Florida"` via `normalizeStateName`.
   - If a user enters or scrapes an abbreviation for an un-mapped state/country, it gets persisted as `"FL"` or `"ON"`, while a UI dropdown selection saves `"Florida"` or `"Ontario"`, causing substring and equality filtering mismatches in CRM and dynamic audiences.
4. **No Separation of Dataset from Logic:**
   - Geographic data arrays (`COUNTRIES`, `STATES_BY_COUNTRY`, `TOP_CITIES_BY_STATE`) are declared directly inside utility code rather than sourced from an authoritative, versioned local dataset.

---

## 2. Comprehensive Inventory of Every Consumer

| Consumer File | Export / Symbol Consumed | Exact Usage & Functional Role |
|---|---|---|
| `apps/desktop/src/shared/utils/locations.ts` | Source of truth (Current) | Defines `CountryOption`, `StateOption`, `COUNTRIES`, `STATES_BY_COUNTRY`, `TOP_CITIES_BY_STATE`, `getCountries()`, `getStatesForCountry()`, `getCitiesForState()`, `normalizeStateName()`, `normalizeCountryName()`. |
| `apps/desktop/src/renderer/lib/locations.ts` | Re-export adapter | `export * from '../../shared/utils/locations';` Bridges shared logic into renderer bundle. |
| `apps/desktop/src/renderer/screens/DiscoveryScreen.tsx` | `COUNTRIES`, `getStatesForCountry`, `getCitiesForState` | **Discovery Modal:** Renders Country `<select>`, State `<Input list="states-datalist">`, and City `<Input list="cities-datalist">`. Validates required Country and State before creating discovery runs. |
| `apps/desktop/src/main/workers/plugins/scraper.ts` | `normalizeStateName`, `normalizeCountryName` | **Playwright Scraper:** Extracts location from Google Maps address node, parses regex postal abbreviation (e.g. `FL 33101`), normalizes state and country, and inserts into SQLite `companies` table. |
| `apps/desktop/src/main/ipc/discovery-ipc.ts` | Location payload validation | Validates `country` and `state` presence; stores `country`, `state`, `city` in `discovery_runs`; passes `{ country, state, city }` to `jobs` payload. |
| `apps/desktop/src/main/ipc/crm.ts` | Database query | `companies:distinct-values` executes `SELECT DISTINCT country, state, city, location FROM companies` to populate CRM filter dropdowns. |
| `apps/desktop/src/renderer/screens/CompaniesScreen.tsx` | Filter dropdowns | Renders Country filter dropdown from `distinctValues.countries` and address filter from `distinctValues.locations`. |
| `apps/desktop/src/renderer/components/crm/CreateAudienceModal.tsx` | Dynamic audience filters | Renders Country, State, City, Location selector inputs for dynamic audience rules. |
| `apps/desktop/src/main/ipc/audiences-ipc.ts` | SQLite Audience Resolver | Resolves dynamic audience filters against SQLite `companies` using `country LIKE ?`, `state LIKE ?`, `city LIKE ?`, `location LIKE ?`. |
| `apps/api/src/services/audience/audience.service.ts` | API MongoDB Resolver | Resolves dynamic audience filters against MongoDB `companies` using `$or: [{ country: regex }, { location: regex }]` with exact parity to SQLite. |
| `apps/api/src/db/models/company.model.ts` | MongoDB Model Schema | Defines `country?: string`, `state?: string`, `city?: string`, `location?: string`. |
| `packages/schema/src/entities/company.ts` | Canonical Zod Schema | Defines `country`, `state`, `city`, `location` as nullable optional strings on `companySchema`. |
| `apps/desktop/src/main/database/runner.ts` | SQLite Schema Migrations | Migration `030_structured_location_and_sync_hardening` added `country TEXT`, `state TEXT`, `city TEXT` to `companies` with indexed columns. |
| `apps/desktop/src/main/services/audiences.test.ts` | Integration Tests | Tests dynamic audience geographic filtering (Country, State, City) and scraper normalization assertions. |

---

## 3. Database Persistence & Filtering Contract Audit

### Persistence Columns Across Subsystems:
1. **SQLite (`companies` table):**
   - `location TEXT`: Raw address string scraped from source (e.g. `"123 Ocean Dr, Miami, FL 33139, USA"`).
   - `city TEXT`: Parsed/normalized city (e.g. `"Miami"`).
   - `state TEXT`: Parsed/normalized administrative subdivision (e.g. `"Florida"`).
   - `country TEXT`: Normalized country name (e.g. `"United States"`).
2. **SQLite (`discovery_runs` table):**
   - `country TEXT NOT NULL`: Target country from discovery modal.
   - `state TEXT NOT NULL`: Target state/region from discovery modal.
   - `city TEXT NULL`: Optional target city from discovery modal.
3. **MongoDB (`companies` collection):**
   - Exact mirror of SQLite fields: `location`, `city`, `state`, `country`.
4. **Current Inconsistency Risk:**
   - There are currently no dedicated ISO code columns (e.g. `countryCode`, `stateCode`) in `companies`.
   - If a scraper saves `"FL"` and the UI filters by `"Florida"`, substring matching (`state LIKE '%Florida%'`) fails unless normalization is strictly guaranteed at ingestion time.
   - Preserving `location` (raw address) is vital as forensic evidence, while `country`, `state`, and `city` must be canonically normalized display names with matching ISO code awareness.

---

## 4. Scraper Normalization Layer Audit

**File:** `apps/desktop/src/main/workers/plugins/scraper.ts` (lines 475–506)

```typescript
// Current extraction logic:
if (location && (!companyCity || !companyState)) {
  const tokens = location.split(',').map((t) => t.trim());
  if (tokens.length >= 2) {
    const lastToken = tokens[tokens.length - 1] || '';
    const secondLastToken = tokens[tokens.length - 2] || '';
    const stateZipMatch = secondLastToken.match(/^([A-Z]{2})\s*(\d{5})?/i);
    if (stateZipMatch && stateZipMatch[1]) {
      if (!companyState) companyState = stateZipMatch[1].toUpperCase();
      if (!companyCity && tokens.length >= 3) {
        companyCity = tokens[tokens.length - 3] || null;
      }
    } else if (!companyCity) {
      companyCity = secondLastToken;
    }
    if (!companyCountry && lastToken) {
      companyCountry = lastToken;
    }
  }
}

if (companyState) {
  companyState = normalizeStateName(companyState, companyCountry || undefined);
}
if (companyCountry) {
  companyCountry = normalizeCountryName(companyCountry);
}
```

### Forensic Deficiencies in Scraper Extraction:
1. **US-Centric Regex:** `^([A-Z]{2})\s*(\d{5})?` assumes US two-letter state codes and 5-digit ZIP codes. Canadian postal codes (`M5V 2T6`), UK postcodes (`SW1A 1AA`), and international addresses do not match this regex, leading to misaligned tokens.
2. **Context-Free Normalization:** If `companyCountry` is missing or unparsed, `normalizeStateName` iterates through all states of all 18 countries, which can produce ambiguous collisions (e.g. `"WA"` in US is Washington, in Australia is Western Australia).
3. **No ISO-3166-2 Code Awareness:** The scraper only saves strings. It does not retain ISO country or subdivision codes.

---

## 5. Audit Conclusions & Transition Requirements

1. The hardcoded 40-country dataset must be completely replaced by an authoritative, version-pinned, local geographic data source.
2. The UI must retain responsive Country (REQUIRED) -> State (REQUIRED) -> City (OPTIONAL) cascading dropdowns with live search.
3. The dataset must not be eagerly bundled in its entirety (150,000 cities) into the renderer chunk, which would bloat the client by 10–25 MB.
4. Normalization must support bidirectional mapping: ISO code ↔ canonical display name across all 249 world countries.
