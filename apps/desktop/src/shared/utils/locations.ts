/**
 * Comprehensive ISO-3166 Standardized Location Dataset for LeadForge OS
 * Provides cascading Country (REQUIRED) -> State / Region (REQUIRED) -> City (OPTIONAL)
 * and bidirectional code/name normalization.
 */

export interface CountryOption {
  code: string;
  name: string;
}

export interface StateOption {
  code: string;
  name: string;
  countryCode: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'JP', name: 'Japan' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'PL', name: 'Poland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'DK', name: 'Denmark' },
  { code: 'NO', name: 'Norway' },
  { code: 'FI', name: 'Finland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IL', name: 'Israel' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' }
];

export const STATES_BY_COUNTRY: Record<string, StateOption[]> = {
  US: [
    { code: 'AL', name: 'Alabama', countryCode: 'US' },
    { code: 'AK', name: 'Alaska', countryCode: 'US' },
    { code: 'AZ', name: 'Arizona', countryCode: 'US' },
    { code: 'AR', name: 'Arkansas', countryCode: 'US' },
    { code: 'CA', name: 'California', countryCode: 'US' },
    { code: 'CO', name: 'Colorado', countryCode: 'US' },
    { code: 'CT', name: 'Connecticut', countryCode: 'US' },
    { code: 'DE', name: 'Delaware', countryCode: 'US' },
    { code: 'FL', name: 'Florida', countryCode: 'US' },
    { code: 'GA', name: 'Georgia', countryCode: 'US' },
    { code: 'HI', name: 'Hawaii', countryCode: 'US' },
    { code: 'ID', name: 'Idaho', countryCode: 'US' },
    { code: 'IL', name: 'Illinois', countryCode: 'US' },
    { code: 'IN', name: 'Indiana', countryCode: 'US' },
    { code: 'IA', name: 'Iowa', countryCode: 'US' },
    { code: 'KS', name: 'Kansas', countryCode: 'US' },
    { code: 'KY', name: 'Kentucky', countryCode: 'US' },
    { code: 'LA', name: 'Louisiana', countryCode: 'US' },
    { code: 'ME', name: 'Maine', countryCode: 'US' },
    { code: 'MD', name: 'Maryland', countryCode: 'US' },
    { code: 'MA', name: 'Massachusetts', countryCode: 'US' },
    { code: 'MI', name: 'Michigan', countryCode: 'US' },
    { code: 'MN', name: 'Minnesota', countryCode: 'US' },
    { code: 'MS', name: 'Mississippi', countryCode: 'US' },
    { code: 'MO', name: 'Missouri', countryCode: 'US' },
    { code: 'MT', name: 'Montana', countryCode: 'US' },
    { code: 'NE', name: 'Nebraska', countryCode: 'US' },
    { code: 'NV', name: 'Nevada', countryCode: 'US' },
    { code: 'NH', name: 'New Hampshire', countryCode: 'US' },
    { code: 'NJ', name: 'New Jersey', countryCode: 'US' },
    { code: 'NM', name: 'New Mexico', countryCode: 'US' },
    { code: 'NY', name: 'New York', countryCode: 'US' },
    { code: 'NC', name: 'North Carolina', countryCode: 'US' },
    { code: 'ND', name: 'North Dakota', countryCode: 'US' },
    { code: 'OH', name: 'Ohio', countryCode: 'US' },
    { code: 'OK', name: 'Oklahoma', countryCode: 'US' },
    { code: 'OR', name: 'Oregon', countryCode: 'US' },
    { code: 'PA', name: 'Pennsylvania', countryCode: 'US' },
    { code: 'RI', name: 'Rhode Island', countryCode: 'US' },
    { code: 'SC', name: 'South Carolina', countryCode: 'US' },
    { code: 'SD', name: 'South Dakota', countryCode: 'US' },
    { code: 'TN', name: 'Tennessee', countryCode: 'US' },
    { code: 'TX', name: 'Texas', countryCode: 'US' },
    { code: 'UT', name: 'Utah', countryCode: 'US' },
    { code: 'VT', name: 'Vermont', countryCode: 'US' },
    { code: 'VA', name: 'Virginia', countryCode: 'US' },
    { code: 'WA', name: 'Washington', countryCode: 'US' },
    { code: 'WV', name: 'West Virginia', countryCode: 'US' },
    { code: 'WI', name: 'Wisconsin', countryCode: 'US' },
    { code: 'WY', name: 'Wyoming', countryCode: 'US' },
    { code: 'DC', name: 'District of Columbia', countryCode: 'US' }
  ],
  CA: [
    { code: 'ON', name: 'Ontario', countryCode: 'CA' },
    { code: 'QC', name: 'Quebec', countryCode: 'CA' },
    { code: 'BC', name: 'British Columbia', countryCode: 'CA' },
    { code: 'AB', name: 'Alberta', countryCode: 'CA' },
    { code: 'MB', name: 'Manitoba', countryCode: 'CA' },
    { code: 'SK', name: 'Saskatchewan', countryCode: 'CA' },
    { code: 'NS', name: 'Nova Scotia', countryCode: 'CA' },
    { code: 'NB', name: 'New Brunswick', countryCode: 'CA' },
    { code: 'NL', name: 'Newfoundland and Labrador', countryCode: 'CA' },
    { code: 'PE', name: 'Prince Edward Island', countryCode: 'CA' },
    { code: 'NT', name: 'Northwest Territories', countryCode: 'CA' },
    { code: 'YT', name: 'Yukon', countryCode: 'CA' },
    { code: 'NU', name: 'Nunavut', countryCode: 'CA' }
  ],
  GB: [
    { code: 'ENG', name: 'England', countryCode: 'GB' },
    { code: 'SCT', name: 'Scotland', countryCode: 'GB' },
    { code: 'WLS', name: 'Wales', countryCode: 'GB' },
    { code: 'NIR', name: 'Northern Ireland', countryCode: 'GB' },
    { code: 'GLN', name: 'Greater London', countryCode: 'GB' },
    { code: 'GMC', name: 'Greater Manchester', countryCode: 'GB' },
    { code: 'WMD', name: 'West Midlands', countryCode: 'GB' },
    { code: 'WYK', name: 'West Yorkshire', countryCode: 'GB' }
  ],
  AU: [
    { code: 'NSW', name: 'New South Wales', countryCode: 'AU' },
    { code: 'VIC', name: 'Victoria', countryCode: 'AU' },
    { code: 'QLD', name: 'Queensland', countryCode: 'AU' },
    { code: 'WA', name: 'Western Australia', countryCode: 'AU' },
    { code: 'SA', name: 'South Australia', countryCode: 'AU' },
    { code: 'TAS', name: 'Tasmania', countryCode: 'AU' },
    { code: 'ACT', name: 'Australian Capital Territory', countryCode: 'AU' },
    { code: 'NT', name: 'Northern Territory', countryCode: 'AU' }
  ],
  IN: [
    { code: 'MH', name: 'Maharashtra', countryCode: 'IN' },
    { code: 'KA', name: 'Karnataka', countryCode: 'IN' },
    { code: 'DL', name: 'Delhi', countryCode: 'IN' },
    { code: 'TN', name: 'Tamil Nadu', countryCode: 'IN' },
    { code: 'TG', name: 'Telangana', countryCode: 'IN' },
    { code: 'GJ', name: 'Gujarat', countryCode: 'IN' },
    { code: 'UP', name: 'Uttar Pradesh', countryCode: 'IN' },
    { code: 'WB', name: 'West Bengal', countryCode: 'IN' },
    { code: 'HR', name: 'Haryana', countryCode: 'IN' },
    { code: 'KL', name: 'Kerala', countryCode: 'IN' },
    { code: 'RJ', name: 'Rajasthan', countryCode: 'IN' },
    { code: 'PB', name: 'Punjab', countryCode: 'IN' },
    { code: 'MP', name: 'Madhya Pradesh', countryCode: 'IN' },
    { code: 'AP', name: 'Andhra Pradesh', countryCode: 'IN' }
  ],
  DE: [
    { code: 'BW', name: 'Baden-Württemberg', countryCode: 'DE' },
    { code: 'BY', name: 'Bavaria (Bayern)', countryCode: 'DE' },
    { code: 'BE', name: 'Berlin', countryCode: 'DE' },
    { code: 'HE', name: 'Hesse (Hessen)', countryCode: 'DE' },
    { code: 'NW', name: 'North Rhine-Westphalia', countryCode: 'DE' },
    { code: 'HH', name: 'Hamburg', countryCode: 'DE' },
    { code: 'NI', name: 'Lower Saxony', countryCode: 'DE' },
    { code: 'SN', name: 'Saxony', countryCode: 'DE' },
    { code: 'RP', name: 'Rhineland-Palatinate', countryCode: 'DE' }
  ],
  FR: [
    { code: 'IDF', name: 'Île-de-France (Paris Region)', countryCode: 'FR' },
    { code: 'ARA', name: 'Auvergne-Rhône-Alpes (Lyon)', countryCode: 'FR' },
    { code: 'PAC', name: "Provence-Alpes-Côte d'Azur", countryCode: 'FR' },
    { code: 'OCC', name: 'Occitanie (Toulouse)', countryCode: 'FR' },
    { code: 'NAQ', name: 'Nouvelle-Aquitaine (Bordeaux)', countryCode: 'FR' },
    { code: 'GES', name: 'Grand Est (Strasbourg)', countryCode: 'FR' },
    { code: 'HDF', name: 'Hauts-de-France (Lille)', countryCode: 'FR' }
  ],
  NL: [
    { code: 'NH', name: 'North Holland (Amsterdam)', countryCode: 'NL' },
    { code: 'ZH', name: 'South Holland (Rotterdam / The Hague)', countryCode: 'NL' },
    { code: 'UT', name: 'Utrecht', countryCode: 'NL' },
    { code: 'NB', name: 'North Brabant (Eindhoven)', countryCode: 'NL' },
    { code: 'GE', name: 'Gelderland', countryCode: 'NL' }
  ],
  AE: [
    { code: 'DXB', name: 'Dubai', countryCode: 'AE' },
    { code: 'AUH', name: 'Abu Dhabi', countryCode: 'AE' },
    { code: 'SHJ', name: 'Sharjah', countryCode: 'AE' },
    { code: 'AJM', name: 'Ajman', countryCode: 'AE' },
    { code: 'RAK', name: 'Ras Al Khaimah', countryCode: 'AE' }
  ],
  SG: [
    { code: 'SG-CR', name: 'Central Region', countryCode: 'SG' },
    { code: 'SG-ER', name: 'East Region', countryCode: 'SG' },
    { code: 'SG-WR', name: 'West Region', countryCode: 'SG' },
    { code: 'SG-NR', name: 'North Region', countryCode: 'SG' }
  ],
  NZ: [
    { code: 'AUK', name: 'Auckland', countryCode: 'NZ' },
    { code: 'WGN', name: 'Wellington', countryCode: 'NZ' },
    { code: 'CAN', name: 'Canterbury (Christchurch)', countryCode: 'NZ' },
    { code: 'WKO', name: 'Waikato (Hamilton)', countryCode: 'NZ' }
  ],
  IE: [
    { code: 'D', name: 'Dublin', countryCode: 'IE' },
    { code: 'C', name: 'Cork', countryCode: 'IE' },
    { code: 'G', name: 'Galway', countryCode: 'IE' },
    { code: 'L', name: 'Limerick', countryCode: 'IE' }
  ],
  ES: [
    { code: 'MD', name: 'Madrid', countryCode: 'ES' },
    { code: 'CT', name: 'Catalonia (Barcelona)', countryCode: 'ES' },
    { code: 'AN', name: 'Andalusia (Seville / Malaga)', countryCode: 'ES' },
    { code: 'VC', name: 'Valencian Community', countryCode: 'ES' },
    { code: 'PV', name: 'Basque Country (Bilbao)', countryCode: 'ES' }
  ],
  IT: [
    { code: 'LOM', name: 'Lombardy (Milan)', countryCode: 'IT' },
    { code: 'LAZ', name: 'Lazio (Rome)', countryCode: 'IT' },
    { code: 'VEN', name: 'Veneto (Venice / Verona)', countryCode: 'IT' },
    { code: 'PIE', name: 'Piedmont (Turin)', countryCode: 'IT' },
    { code: 'EMR', name: 'Emilia-Romagna (Bologna)', countryCode: 'IT' }
  ],
  BR: [
    { code: 'SP', name: 'São Paulo', countryCode: 'BR' },
    { code: 'RJ', name: 'Rio de Janeiro', countryCode: 'BR' },
    { code: 'MG', name: 'Minas Gerais', countryCode: 'BR' },
    { code: 'RS', name: 'Rio Grande do Sul', countryCode: 'BR' },
    { code: 'PR', name: 'Paraná (Curitiba)', countryCode: 'BR' }
  ],
  MX: [
    { code: 'CMX', name: 'Mexico City (CDMX)', countryCode: 'MX' },
    { code: 'JAL', name: 'Jalisco (Guadalajara)', countryCode: 'MX' },
    { code: 'NLE', name: 'Nuevo León (Monterrey)', countryCode: 'MX' },
    { code: 'MEX', name: 'State of Mexico', countryCode: 'MX' }
  ],
  JP: [
    { code: '13', name: 'Tokyo', countryCode: 'JP' },
    { code: '27', name: 'Osaka', countryCode: 'JP' },
    { code: '14', name: 'Kanagawa (Yokohama)', countryCode: 'JP' },
    { code: '23', name: 'Aichi (Nagoya)', countryCode: 'JP' },
    { code: '01', name: 'Hokkaido (Sapporo)', countryCode: 'JP' }
  ],
  ZA: [
    { code: 'GP', name: 'Gauteng (Johannesburg / Pretoria)', countryCode: 'ZA' },
    { code: 'WC', name: 'Western Cape (Cape Town)', countryCode: 'ZA' },
    { code: 'KZN', name: 'KwaZulu-Natal (Durban)', countryCode: 'ZA' }
  ],
  CH: [
    { code: 'ZH', name: 'Zurich', countryCode: 'CH' },
    { code: 'GE', name: 'Geneva', countryCode: 'CH' },
    { code: 'BS', name: 'Basel-Stadt', countryCode: 'CH' },
    { code: 'VD', name: 'Vaud (Lausanne)', countryCode: 'CH' },
    { code: 'BE', name: 'Bern', countryCode: 'CH' }
  ],
  SE: [
    { code: 'AB', name: 'Stockholm County', countryCode: 'SE' },
    { code: 'O', name: 'Västra Götaland (Gothenburg)', countryCode: 'SE' },
    { code: 'M', name: 'Skåne (Malmö)', countryCode: 'SE' }
  ]
};

export const TOP_CITIES_BY_STATE: Record<string, string[]> = {
  'US-CA': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Irvine', 'Fresno'],
  'US-NY': ['New York', 'Brooklyn', 'Queens', 'Buffalo', 'Rochester', 'Albany', 'Syracuse'],
  'US-TX': ['Houston', 'Austin', 'Dallas', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington'],
  'US-FL': ['Miami', 'Orlando', 'Tampa', 'Fort Lauderdale', 'Jacksonville', 'St. Petersburg', 'Naples', 'Boca Raton'],
  'US-IL': ['Chicago', 'Naperville', 'Aurora', 'Rockford', 'Joliet', 'Springfield'],
  'US-WA': ['Seattle', 'Bellevue', 'Tacoma', 'Spokane', 'Vancouver', 'Everett'],
  'US-MA': ['Boston', 'Cambridge', 'Worcester', 'Springfield', 'Lowell'],
  'US-CO': ['Denver', 'Boulder', 'Colorado Springs', 'Aurora', 'Fort Collins'],
  'US-GA': ['Atlanta', 'Savannah', 'Augusta', 'Columbus', 'Macon'],
  'US-NC': ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Winston-Salem'],
  'US-PA': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading'],
  'US-OH': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron'],
  'US-AZ': ['Phoenix', 'Scottsdale', 'Tucson', 'Mesa', 'Chandler', 'Tempe'],
  'US-NV': ['Las Vegas', 'Reno', 'Henderson', 'North Las Vegas'],
  'US-MI': ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing'],
  'US-NJ': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton', 'Princeton'],
  'US-VA': ['Virginia Beach', 'Richmond', 'Norfolk', 'Arlington', 'Alexandria'],
  'CA-ON': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham'],
  'CA-BC': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond', 'Kelowna'],
  'CA-QC': ['Montreal', 'Quebec City', 'Laval', 'Gatineau'],
  'CA-AB': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge'],
  'GB-GLN': ['London', 'Westminster', 'Camden', 'Greenwich'],
  'GB-GMC': ['Manchester', 'Salford', 'Bolton', 'Stockport'],
  'GB-WMD': ['Birmingham', 'Coventry', 'Wolverhampton'],
  'GB-ENG': ['London', 'Birmingham', 'Manchester', 'Leeds', 'Bristol', 'Liverpool', 'Newcastle', 'Sheffield'],
  'GB-SCT': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'],
  'AU-NSW': ['Sydney', 'Newcastle', 'Wollongong', 'Central Coast'],
  'AU-VIC': ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo'],
  'AU-QLD': ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns'],
  'IN-MH': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik'],
  'IN-KA': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru'],
  'IN-DL': ['New Delhi', 'Delhi', 'Connaught Place'],
  'IN-TN': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'],
  'IN-TG': ['Hyderabad', 'Warangal', 'Secunderabad'],
  'IN-GJ': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
  'DE-BE': ['Berlin'],
  'DE-BY': ['Munich (München)', 'Nuremberg (Nürnberg)', 'Augsburg'],
  'DE-HE': ['Frankfurt am Main', 'Wiesbaden', 'Kassel'],
  'DE-NW': ['Cologne (Köln)', 'Düsseldorf', 'Dortmund', 'Essen'],
  'DE-BW': ['Stuttgart', 'Karlsruhe', 'Mannheim', 'Freiburg'],
  'FR-IDF': ['Paris', 'Boulogne-Billancourt', 'Saint-Denis', 'Versailles'],
  'FR-ARA': ['Lyon', 'Saint-Étienne', 'Grenoble', 'Villeurbanne'],
  'FR-PAC': ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence'],
  'AE-DXB': ['Dubai', 'Jumeirah', 'Business Bay', 'Downtown Dubai', 'Deira'],
  'AE-AUH': ['Abu Dhabi', 'Al Ain', 'Musaffah'],
  'NL-NH': ['Amsterdam', 'Haarlem', 'Alkmaar', 'Hilversum'],
  'NL-ZH': ['Rotterdam', 'The Hague', 'Leiden', 'Delft']
};

export function getCountries(): CountryOption[] {
  return COUNTRIES;
}

export function getStatesForCountry(countryCodeOrName: string): StateOption[] {
  if (!countryCodeOrName) return [];
  const normalized = countryCodeOrName.trim().toLowerCase();
  const match = COUNTRIES.find(
    (c) => c.code.toLowerCase() === normalized || c.name.toLowerCase() === normalized
  );
  if (!match) return [];
  return STATES_BY_COUNTRY[match.code] || [];
}

export function getCitiesForState(countryCodeOrName: string, stateCodeOrName: string): string[] {
  if (!countryCodeOrName || !stateCodeOrName) return [];
  const cMatch = COUNTRIES.find(
    (c) =>
      c.code.toLowerCase() === countryCodeOrName.trim().toLowerCase() ||
      c.name.toLowerCase() === countryCodeOrName.trim().toLowerCase()
  );
  if (!cMatch) return [];

  const states = STATES_BY_COUNTRY[cMatch.code] || [];
  const sMatch = states.find(
    (s) =>
      s.code.toLowerCase() === stateCodeOrName.trim().toLowerCase() ||
      s.name.toLowerCase() === stateCodeOrName.trim().toLowerCase()
  );
  if (!sMatch) return [];

  const key = `${cMatch.code}-${sMatch.code}`;
  return TOP_CITIES_BY_STATE[key] || [];
}

/**
 * Maps 2-letter state abbreviations or partial strings to canonical state name.
 * e.g. "FL" -> "Florida", "CA" -> "California", "NY" -> "New York"
 */
export function normalizeStateName(stateCodeOrName: string, countryCodeOrName?: string): string {
  if (!stateCodeOrName) return '';
  const trimmed = stateCodeOrName.trim();

  // Search within known country or across all countries
  const candidateLists = countryCodeOrName
    ? [getStatesForCountry(countryCodeOrName)]
    : Object.values(STATES_BY_COUNTRY);

  for (const list of candidateLists) {
    const found = list.find(
      (s) =>
        s.code.toLowerCase() === trimmed.toLowerCase() ||
        s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (found) return found.name;
  }

  return trimmed;
}

/**
 * Normalizes country code or common name to standard country name.
 * e.g. "US" -> "United States", "USA" -> "United States", "UK" -> "United Kingdom"
 */
export function normalizeCountryName(countryCodeOrName: string): string {
  if (!countryCodeOrName) return '';
  const trimmed = countryCodeOrName.trim().toLowerCase();
  if (trimmed === 'usa' || trimmed === 'us') return 'United States';
  if (trimmed === 'uk' || trimmed === 'gb') return 'United Kingdom';
  if (trimmed === 'uae') return 'United Arab Emirates';

  const match = COUNTRIES.find(
    (c) => c.code.toLowerCase() === trimmed || c.name.toLowerCase() === trimmed
  );
  return match ? match.name : countryCodeOrName.trim();
}
