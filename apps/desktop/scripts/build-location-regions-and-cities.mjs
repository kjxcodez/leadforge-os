import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.resolve(__dirname, '../src/shared/locations/data');

const countries = JSON.parse(fs.readFileSync(path.join(targetDir, 'countries.json'), 'utf8'));

// 2. Comprehensive ISO-3166-2 Subdivisions by Country Code
const REGIONS = {
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
    { code: 'DC', name: 'District of Columbia', countryCode: 'US' },
    { code: 'PR', name: 'Puerto Rico', countryCode: 'US' },
    { code: 'VI', name: 'Virgin Islands', countryCode: 'US' },
    { code: 'GU', name: 'Guam', countryCode: 'US' }
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
    { code: 'WYK', name: 'West Yorkshire', countryCode: 'GB' },
    { code: 'SYK', name: 'South Yorkshire', countryCode: 'GB' },
    { code: 'MSY', name: 'Merseyside', countryCode: 'GB' }
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
    { code: 'AP', name: 'Andhra Pradesh', countryCode: 'IN' },
    { code: 'BR', name: 'Bihar', countryCode: 'IN' },
    { code: 'OR', name: 'Odisha', countryCode: 'IN' },
    { code: 'AS', name: 'Assam', countryCode: 'IN' },
    { code: 'JH', name: 'Jharkhand', countryCode: 'IN' },
    { code: 'CH', name: 'Chandigarh', countryCode: 'IN' },
    { code: 'GA', name: 'Goa', countryCode: 'IN' },
    { code: 'UT', name: 'Uttarakhand', countryCode: 'IN' },
    { code: 'HP', name: 'Himachal Pradesh', countryCode: 'IN' }
  ],
  DE: [
    { code: 'BW', name: 'Baden-Württemberg', countryCode: 'DE' },
    { code: 'BY', name: 'Bavaria (Bayern)', countryCode: 'DE' },
    { code: 'BE', name: 'Berlin', countryCode: 'DE' },
    { code: 'BB', name: 'Brandenburg', countryCode: 'DE' },
    { code: 'HB', name: 'Bremen', countryCode: 'DE' },
    { code: 'HH', name: 'Hamburg', countryCode: 'DE' },
    { code: 'HE', name: 'Hesse (Hessen)', countryCode: 'DE' },
    { code: 'MV', name: 'Mecklenburg-Western Pomerania', countryCode: 'DE' },
    { code: 'NI', name: 'Lower Saxony', countryCode: 'DE' },
    { code: 'NW', name: 'North Rhine-Westphalia', countryCode: 'DE' },
    { code: 'RP', name: 'Rhineland-Palatinate', countryCode: 'DE' },
    { code: 'SL', name: 'Saarland', countryCode: 'DE' },
    { code: 'SN', name: 'Saxony', countryCode: 'DE' },
    { code: 'ST', name: 'Saxony-Anhalt', countryCode: 'DE' },
    { code: 'SH', name: 'Schleswig-Holstein', countryCode: 'DE' },
    { code: 'TH', name: 'Thuringia', countryCode: 'DE' }
  ],
  FR: [
    { code: 'IDF', name: 'Île-de-France (Paris Region)', countryCode: 'FR' },
    { code: 'ARA', name: 'Auvergne-Rhône-Alpes (Lyon)', countryCode: 'FR' },
    { code: 'PAC', name: "Provence-Alpes-Côte d'Azur", countryCode: 'FR' },
    { code: 'OCC', name: 'Occitanie (Toulouse)', countryCode: 'FR' },
    { code: 'NAQ', name: 'Nouvelle-Aquitaine (Bordeaux)', countryCode: 'FR' },
    { code: 'GES', name: 'Grand Est (Strasbourg)', countryCode: 'FR' },
    { code: 'HDF', name: 'Hauts-de-France (Lille)', countryCode: 'FR' },
    { code: 'BRE', name: 'Brittany (Bretagne)', countryCode: 'FR' },
    { code: 'NOR', name: 'Normandy', countryCode: 'FR' },
    { code: 'PDL', name: 'Pays de la Loire', countryCode: 'FR' },
    { code: 'BFC', name: 'Bourgogne-Franche-Comté', countryCode: 'FR' },
    { code: 'CVL', name: 'Centre-Val de Loire', countryCode: 'FR' },
    { code: 'COR', name: 'Corsica', countryCode: 'FR' }
  ],
  NL: [
    { code: 'NH', name: 'North Holland (Amsterdam)', countryCode: 'NL' },
    { code: 'ZH', name: 'South Holland (Rotterdam / The Hague)', countryCode: 'NL' },
    { code: 'UT', name: 'Utrecht', countryCode: 'NL' },
    { code: 'NB', name: 'North Brabant (Eindhoven)', countryCode: 'NL' },
    { code: 'GE', name: 'Gelderland', countryCode: 'NL' },
    { code: 'OV', name: 'Overijssel', countryCode: 'NL' },
    { code: 'LI', name: 'Limburg', countryCode: 'NL' },
    { code: 'GR', name: 'Groningen', countryCode: 'NL' },
    { code: 'FR', name: 'Friesland', countryCode: 'NL' },
    { code: 'DR', name: 'Drenthe', countryCode: 'NL' },
    { code: 'ZE', name: 'Zeeland', countryCode: 'NL' },
    { code: 'FL', name: 'Flevoland', countryCode: 'NL' }
  ],
  AE: [
    { code: 'DXB', name: 'Dubai', countryCode: 'AE' },
    { code: 'AUH', name: 'Abu Dhabi', countryCode: 'AE' },
    { code: 'SHJ', name: 'Sharjah', countryCode: 'AE' },
    { code: 'AJM', name: 'Ajman', countryCode: 'AE' },
    { code: 'RAK', name: 'Ras Al Khaimah', countryCode: 'AE' },
    { code: 'FUJ', name: 'Fujairah', countryCode: 'AE' },
    { code: 'UQW', name: 'Umm Al Quwain', countryCode: 'AE' }
  ],
  SG: [
    { code: 'SG-CR', name: 'Central Region', countryCode: 'SG' },
    { code: 'SG-ER', name: 'East Region', countryCode: 'SG' },
    { code: 'SG-WR', name: 'West Region', countryCode: 'SG' },
    { code: 'SG-NR', name: 'North Region', countryCode: 'SG' },
    { code: 'SG-NER', name: 'North-East Region', countryCode: 'SG' }
  ],
  NZ: [
    { code: 'AUK', name: 'Auckland', countryCode: 'NZ' },
    { code: 'WGN', name: 'Wellington', countryCode: 'NZ' },
    { code: 'CAN', name: 'Canterbury (Christchurch)', countryCode: 'NZ' },
    { code: 'WKO', name: 'Waikato (Hamilton)', countryCode: 'NZ' },
    { code: 'BOP', name: 'Bay of Plenty', countryCode: 'NZ' },
    { code: 'OTA', name: 'Otago (Dunedin / Queenstown)', countryCode: 'NZ' }
  ],
  IE: [
    { code: 'D', name: 'Dublin', countryCode: 'IE' },
    { code: 'C', name: 'Cork', countryCode: 'IE' },
    { code: 'G', name: 'Galway', countryCode: 'IE' },
    { code: 'L', name: 'Limerick', countryCode: 'IE' },
    { code: 'WD', name: 'Waterford', countryCode: 'IE' },
    { code: 'KY', name: 'Kerry', countryCode: 'IE' },
    { code: 'KLD', name: 'Kildare', countryCode: 'IE' }
  ],
  ES: [
    { code: 'MD', name: 'Madrid', countryCode: 'ES' },
    { code: 'CT', name: 'Catalonia (Barcelona)', countryCode: 'ES' },
    { code: 'AN', name: 'Andalusia (Seville / Malaga)', countryCode: 'ES' },
    { code: 'VC', name: 'Valencian Community', countryCode: 'ES' },
    { code: 'PV', name: 'Basque Country (Bilbao)', countryCode: 'ES' },
    { code: 'GA', name: 'Galicia', countryCode: 'ES' },
    { code: 'CL', name: 'Castile and León', countryCode: 'ES' },
    { code: 'CN', name: 'Canary Islands', countryCode: 'ES' },
    { code: 'IB', name: 'Balearic Islands', countryCode: 'ES' },
    { code: 'AR', name: 'Aragon', countryCode: 'ES' }
  ],
  IT: [
    { code: 'LOM', name: 'Lombardy (Milan)', countryCode: 'IT' },
    { code: 'LAZ', name: 'Lazio (Rome)', countryCode: 'IT' },
    { code: 'VEN', name: 'Veneto (Venice / Verona)', countryCode: 'IT' },
    { code: 'PIE', name: 'Piedmont (Turin)', countryCode: 'IT' },
    { code: 'EMR', name: 'Emilia-Romagna (Bologna)', countryCode: 'IT' },
    { code: 'TOS', name: 'Tuscany (Florence)', countryCode: 'IT' },
    { code: 'CAM', name: 'Campania (Naples)', countryCode: 'IT' },
    { code: 'SIC', name: 'Sicily', countryCode: 'IT' },
    { code: 'PUG', name: 'Apulia (Bari)', countryCode: 'IT' },
    { code: 'LIG', name: 'Liguria (Genoa)', countryCode: 'IT' }
  ],
  BR: [
    { code: 'SP', name: 'São Paulo', countryCode: 'BR' },
    { code: 'RJ', name: 'Rio de Janeiro', countryCode: 'BR' },
    { code: 'MG', name: 'Minas Gerais', countryCode: 'BR' },
    { code: 'RS', name: 'Rio Grande do Sul', countryCode: 'BR' },
    { code: 'PR', name: 'Paraná (Curitiba)', countryCode: 'BR' },
    { code: 'BA', name: 'Bahia (Salvador)', countryCode: 'BR' },
    { code: 'SC', name: 'Santa Catarina (Florianópolis)', countryCode: 'BR' },
    { code: 'DF', name: 'Distrito Federal (Brasília)', countryCode: 'BR' },
    { code: 'PE', name: 'Pernambuco (Recife)', countryCode: 'BR' },
    { code: 'CE', name: 'Ceará (Fortaleza)', countryCode: 'BR' }
  ],
  MX: [
    { code: 'CMX', name: 'Mexico City (CDMX)', countryCode: 'MX' },
    { code: 'JAL', name: 'Jalisco (Guadalajara)', countryCode: 'MX' },
    { code: 'NLE', name: 'Nuevo León (Monterrey)', countryCode: 'MX' },
    { code: 'MEX', name: 'State of Mexico', countryCode: 'MX' },
    { code: 'PUE', name: 'Puebla', countryCode: 'MX' },
    { code: 'GUA', name: 'Guanajuato', countryCode: 'MX' },
    { code: 'QUE', name: 'Querétaro', countryCode: 'MX' },
    { code: 'BCN', name: 'Baja California (Tijuana)', countryCode: 'MX' },
    { code: 'YUC', name: 'Yucatán (Mérida)', countryCode: 'MX' }
  ],
  JP: [
    { code: '13', name: 'Tokyo', countryCode: 'JP' },
    { code: '27', name: 'Osaka', countryCode: 'JP' },
    { code: '14', name: 'Kanagawa (Yokohama)', countryCode: 'JP' },
    { code: '23', name: 'Aichi (Nagoya)', countryCode: 'JP' },
    { code: '01', name: 'Hokkaido (Sapporo)', countryCode: 'JP' },
    { code: '26', name: 'Kyoto', countryCode: 'JP' },
    { code: '28', name: 'Hyogo (Kobe)', countryCode: 'JP' },
    { code: '40', name: 'Fukuoka', countryCode: 'JP' }
  ],
  ZA: [
    { code: 'GP', name: 'Gauteng (Johannesburg / Pretoria)', countryCode: 'ZA' },
    { code: 'WC', name: 'Western Cape (Cape Town)', countryCode: 'ZA' },
    { code: 'KZN', name: 'KwaZulu-Natal (Durban)', countryCode: 'ZA' },
    { code: 'EC', name: 'Eastern Cape', countryCode: 'ZA' },
    { code: 'FS', name: 'Free State', countryCode: 'ZA' }
  ],
  CH: [
    { code: 'ZH', name: 'Zurich', countryCode: 'CH' },
    { code: 'GE', name: 'Geneva', countryCode: 'CH' },
    { code: 'BS', name: 'Basel-Stadt', countryCode: 'CH' },
    { code: 'VD', name: 'Vaud (Lausanne)', countryCode: 'CH' },
    { code: 'BE', name: 'Bern', countryCode: 'CH' },
    { code: 'LU', name: 'Lucerne', countryCode: 'CH' },
    { code: 'SG', name: 'St. Gallen', countryCode: 'CH' },
    { code: 'TI', name: 'Ticino (Lugano)', countryCode: 'CH' }
  ],
  SE: [
    { code: 'AB', name: 'Stockholm County', countryCode: 'SE' },
    { code: 'O', name: 'Västra Götaland (Gothenburg)', countryCode: 'SE' },
    { code: 'M', name: 'Skåne (Malmö)', countryCode: 'SE' },
    { code: 'C', name: 'Uppsala County', countryCode: 'SE' },
    { code: 'E', name: 'Östergötland', countryCode: 'SE' }
  ],
  PL: [
    { code: 'MZ', name: 'Masovian (Warsaw)', countryCode: 'PL' },
    { code: 'MA', name: 'Lesser Poland (Kraków)', countryCode: 'PL' },
    { code: 'DS', name: 'Lower Silesian (Wrocław)', countryCode: 'PL' },
    { code: 'WP', name: 'Greater Poland (Poznań)', countryCode: 'PL' },
    { code: 'SL', name: 'Silesian (Katowice)', countryCode: 'PL' },
    { code: 'PM', name: 'Pomeranian (Gdańsk)', countryCode: 'PL' },
    { code: 'LD', name: 'Łódź Voivodeship', countryCode: 'PL' }
  ],
  BE: [
    { code: 'BRU', name: 'Brussels-Capital Region', countryCode: 'BE' },
    { code: 'VLG', name: 'Flemish Region (Flanders)', countryCode: 'BE' },
    { code: 'WAL', name: 'Walloon Region (Wallonia)', countryCode: 'BE' },
    { code: 'VAN', name: 'Antwerp', countryCode: 'BE' },
    { code: 'VOV', name: 'East Flanders (Ghent)', countryCode: 'BE' }
  ],
  AT: [
    { code: '9', name: 'Vienna', countryCode: 'AT' },
    { code: '4', name: 'Upper Austria (Linz)', countryCode: 'AT' },
    { code: '6', name: 'Styria (Graz)', countryCode: 'AT' },
    { code: '3', name: 'Lower Austria', countryCode: 'AT' },
    { code: '7', name: 'Tyrol (Innsbruck)', countryCode: 'AT' },
    { code: '5', name: 'Salzburg', countryCode: 'AT' }
  ],
  DK: [
    { code: '84', name: 'Capital Region (Copenhagen)', countryCode: 'DK' },
    { code: '82', name: 'Central Denmark (Aarhus)', countryCode: 'DK' },
    { code: '83', name: 'Region of Southern Denmark (Odense)', countryCode: 'DK' },
    { code: '81', name: 'North Denmark (Aalborg)', countryCode: 'DK' },
    { code: '85', name: 'Region Zealand', countryCode: 'DK' }
  ],
  NO: [
    { code: '03', name: 'Oslo', countryCode: 'NO' },
    { code: '46', name: 'Vestland (Bergen)', countryCode: 'NO' },
    { code: '11', name: 'Rogaland (Stavanger)', countryCode: 'NO' },
    { code: '50', name: 'Trøndelag (Trondheim)', countryCode: 'NO' },
    { code: '30', name: 'Viken', countryCode: 'NO' }
  ],
  FI: [
    { code: '01', name: 'Uusimaa (Helsinki / Espoo)', countryCode: 'FI' },
    { code: '11', name: 'Pirkanmaa (Tampere)', countryCode: 'FI' },
    { code: '02', name: 'Southwest Finland (Turku)', countryCode: 'FI' },
    { code: '14', name: 'North Ostrobothnia (Oulu)', countryCode: 'FI' }
  ],
  PT: [
    { code: '11', name: 'Lisbon District', countryCode: 'PT' },
    { code: '13', name: 'Porto District', countryCode: 'PT' },
    { code: '03', name: 'Braga District', countryCode: 'PT' },
    { code: '06', name: 'Coimbra District', countryCode: 'PT' },
    { code: '08', name: 'Faro (Algarve)', countryCode: 'PT' }
  ],
  IL: [
    { code: 'TA', name: 'Tel Aviv District', countryCode: 'IL' },
    { code: 'C', name: 'Central District', countryCode: 'IL' },
    { code: 'JM', name: 'Jerusalem District', countryCode: 'IL' },
    { code: 'HA', name: 'Haifa District', countryCode: 'IL' },
    { code: 'N', name: 'Northern District', countryCode: 'IL' },
    { code: 'S', name: 'Southern District', countryCode: 'IL' }
  ],
  AR: [
    { code: 'B', name: 'Buenos Aires Province', countryCode: 'AR' },
    { code: 'C', name: 'Autonomous City of Buenos Aires (CABA)', countryCode: 'AR' },
    { code: 'X', name: 'Córdoba', countryCode: 'AR' },
    { code: 'S', name: 'Santa Fe (Rosario)', countryCode: 'AR' },
    { code: 'M', name: 'Mendoza', countryCode: 'AR' }
  ],
  CL: [
    { code: 'RM', name: 'Santiago Metropolitan Region', countryCode: 'CL' },
    { code: 'VS', name: 'Valparaíso Region', countryCode: 'CL' },
    { code: 'BI', name: 'Biobío Region (Concepción)', countryCode: 'CL' },
    { code: 'AN', name: 'Antofagasta Region', countryCode: 'CL' }
  ],
  CO: [
    { code: 'DC', name: 'Bogota D.C.', countryCode: 'CO' },
    { code: 'ANT', name: 'Antioquia (Medellín)', countryCode: 'CO' },
    { code: 'VAC', name: 'Valle del Cauca (Cali)', countryCode: 'CO' },
    { code: 'ATL', name: 'Atlántico (Barranquilla)', countryCode: 'CO' },
    { code: 'SAN', name: 'Santander (Bucaramanga)', countryCode: 'CO' }
  ],
  PH: [
    { code: 'NCR', name: 'National Capital Region (Metro Manila)', countryCode: 'PH' },
    { code: '4A', name: 'Calabarzon', countryCode: 'PH' },
    { code: '07', name: 'Central Visayas (Cebu)', countryCode: 'PH' },
    { code: '03', name: 'Central Luzon', countryCode: 'PH' },
    { code: '11', name: 'Davao Region', countryCode: 'PH' }
  ],
  MY: [
    { code: 'SGR', name: 'Selangor', countryCode: 'MY' },
    { code: 'KUL', name: 'Kuala Lumpur', countryCode: 'MY' },
    { code: 'JHR', name: 'Johor', countryCode: 'MY' },
    { code: 'PNG', name: 'Penang', countryCode: 'MY' },
    { code: 'PRK', name: 'Perak', countryCode: 'MY' },
    { code: 'SBH', name: 'Sabah', countryCode: 'MY' },
    { code: 'SWK', name: 'Sarawak', countryCode: 'MY' }
  ],
  ID: [
    { code: 'JK', name: 'Jakarta (Special Capital Region)', countryCode: 'ID' },
    { code: 'JB', name: 'West Java (Bandung)', countryCode: 'ID' },
    { code: 'JI', name: 'East Java (Surabaya)', countryCode: 'ID' },
    { code: 'JT', name: 'Central Java (Semarang)', countryCode: 'ID' },
    { code: 'BA', name: 'Bali', countryCode: 'ID' },
    { code: 'BT', name: 'Banten', countryCode: 'ID' },
    { code: 'SU', name: 'North Sumatra (Medan)', countryCode: 'ID' }
  ],
  TH: [
    { code: '10', name: 'Bangkok', countryCode: 'TH' },
    { code: '50', name: 'Chiang Mai', countryCode: 'TH' },
    { code: '83', name: 'Phuket', countryCode: 'TH' },
    { code: '20', name: 'Chonburi (Pattaya)', countryCode: 'TH' },
    { code: '11', name: 'Samut Prakan', countryCode: 'TH' },
    { code: '12', name: 'Nonthaburi', countryCode: 'TH' }
  ],
  VN: [
    { code: 'SG', name: 'Ho Chi Minh City', countryCode: 'VN' },
    { code: 'HN', name: 'Hanoi', countryCode: 'VN' },
    { code: 'DN', name: 'Da Nang', countryCode: 'VN' },
    { code: 'BD', name: 'Binh Duong', countryCode: 'VN' },
    { code: 'HP', name: 'Hai Phong', countryCode: 'VN' },
    { code: 'DN', name: 'Dong Nai', countryCode: 'VN' }
  ],
  SA: [
    { code: '01', name: 'Riyadh Province', countryCode: 'SA' },
    { code: '02', name: 'Makkah Province (Jeddah)', countryCode: 'SA' },
    { code: '04', name: 'Eastern Province (Dammam / Khobar)', countryCode: 'SA' },
    { code: '03', name: 'Al Madinah Province', countryCode: 'SA' }
  ],
  EG: [
    { code: 'C', name: 'Cairo Governorate', countryCode: 'EG' },
    { code: 'GZ', name: 'Giza Governorate', countryCode: 'EG' },
    { code: 'ALX', name: 'Alexandria Governorate', countryCode: 'EG' },
    { code: 'DK', name: 'Dakahlia (Mansoura)', countryCode: 'EG' },
    { code: 'SHR', name: 'Al Sharqia', countryCode: 'EG' }
  ],
  NG: [
    { code: 'LA', name: 'Lagos State', countryCode: 'NG' },
    { code: 'FC', name: 'Federal Capital Territory (Abuja)', countryCode: 'NG' },
    { code: 'RI', name: 'Rivers State (Port Harcourt)', countryCode: 'NG' },
    { code: 'KN', name: 'Kano State', countryCode: 'NG' },
    { code: 'OY', name: 'Oyo State (Ibadan)', countryCode: 'NG' }
  ],
  KE: [
    { code: '30', name: 'Nairobi County', countryCode: 'KE' },
    { code: '28', name: 'Mombasa County', countryCode: 'KE' },
    { code: '22', name: 'Kiambu County', countryCode: 'KE' },
    { code: '32', name: 'Nakuru County', countryCode: 'KE' },
    { code: '42', name: 'Kisumu County', countryCode: 'KE' }
  ]
};

// Ensure every single ISO-3166-1 country in countries.json has at least one valid subdivision entry
for (const country of countries) {
  if (!REGIONS[country.code] || REGIONS[country.code].length === 0) {
    REGIONS[country.code] = [
      { code: `${country.code}-01`, name: `${country.name} (National / Central Region)`, countryCode: country.code }
    ];
  }
}

// 3. Populated Cities Keyed by `${countryCode}-${regionCode}`
const CITIES = {
  'US-CA': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Irvine', 'Fresno', 'Long Beach', 'Palo Alto', 'Santa Clara', 'Sunnyvale', 'Pasadena'],
  'US-NY': ['New York', 'Brooklyn', 'Queens', 'Buffalo', 'Rochester', 'Albany', 'Syracuse', 'Yonkers', 'White Plains'],
  'US-TX': ['Houston', 'Austin', 'Dallas', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Plano', 'Irving', 'Frisco'],
  'US-FL': ['Miami', 'Orlando', 'Tampa', 'Fort Lauderdale', 'Jacksonville', 'St. Petersburg', 'Naples', 'Boca Raton', 'Tallahassee', 'West Palm Beach', 'Clearwater', 'Gainesville'],
  'US-IL': ['Chicago', 'Naperville', 'Aurora', 'Rockford', 'Joliet', 'Springfield', 'Evanston', 'Peoria'],
  'US-WA': ['Seattle', 'Bellevue', 'Tacoma', 'Spokane', 'Vancouver', 'Everett', 'Redmond', 'Kirkland', 'Renton'],
  'US-MA': ['Boston', 'Cambridge', 'Worcester', 'Springfield', 'Lowell', 'Newton', 'Somerville', 'Quincy'],
  'US-CO': ['Denver', 'Boulder', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton'],
  'US-GA': ['Atlanta', 'Savannah', 'Augusta', 'Columbus', 'Macon', 'Alpharetta', 'Roswell', 'Sandy Springs'],
  'US-NC': ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Winston-Salem', 'Cary', 'Wilmington'],
  'US-PA': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton', 'Bethlehem'],
  'US-OH': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  'US-AZ': ['Phoenix', 'Scottsdale', 'Tucson', 'Mesa', 'Chandler', 'Tempe', 'Gilbert', 'Glendale'],
  'US-NV': ['Las Vegas', 'Reno', 'Henderson', 'North Las Vegas', 'Sparks', 'Carson City'],
  'US-MI': ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing', 'Warren', 'Sterling Heights', 'Troy'],
  'US-NJ': ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Trenton', 'Princeton', 'Hoboken', 'Edison'],
  'US-VA': ['Virginia Beach', 'Richmond', 'Norfolk', 'Arlington', 'Alexandria', 'Chesapeake', 'Reston', 'Tysons'],
  'US-DC': ['Washington'],
  'US-MD': ['Baltimore', 'Rockville', 'Bethesda', 'Silver Spring', 'Gaithersburg', 'Annapolis'],
  'US-MN': ['Minneapolis', 'Saint Paul', 'Rochester', 'Bloomington', 'Duluth'],
  'US-MO': ['Kansas City', 'St. Louis', 'Springfield', 'Columbia'],
  'US-OR': ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro', 'Beaverton'],
  'US-TN': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'],
  'US-UT': ['Salt Lake City', 'Provo', 'West Valley City', 'West Jordan', 'Orem', 'Sandy'],
  'US-WI': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha'],
  
  'CA-ON': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor'],
  'CA-BC': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond', 'Kelowna', 'Abbotsford', 'Coquitlam'],
  'CA-QC': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke'],
  'CA-AB': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert'],
  'CA-MB': ['Winnipeg', 'Brandon', 'Steinbach'],
  'CA-NS': ['Halifax', 'Dartmouth', 'Sydney'],
  
  'GB-GLN': ['London', 'Westminster', 'Camden', 'Greenwich', 'Kensington', 'Islington', 'Hackney', 'Croydon'],
  'GB-GMC': ['Manchester', 'Salford', 'Bolton', 'Stockport', 'Oldham', 'Rochdale', 'Wigan'],
  'GB-WMD': ['Birmingham', 'Coventry', 'Wolverhampton', 'Solihull', 'Walsall', 'Dudley'],
  'GB-ENG': ['London', 'Birmingham', 'Manchester', 'Leeds', 'Bristol', 'Liverpool', 'Newcastle', 'Sheffield', 'Nottingham', 'Southampton'],
  'GB-SCT': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling'],
  'GB-WLS': ['Cardiff', 'Swansea', 'Newport', 'Wrexham'],
  'GB-NIR': ['Belfast', 'Derry', 'Lisburn', 'Newry'],

  'AU-NSW': ['Sydney', 'Newcastle', 'Wollongong', 'Central Coast', 'Parramatta', 'Penrith'],
  'AU-VIC': ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Shepparton'],
  'AU-QLD': ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns', 'Toowoomba'],
  'AU-WA': ['Perth', 'Fremantle', 'Mandurah', 'Bunbury'],
  'AU-SA': ['Adelaide', 'Mount Gambier', 'Whyalla'],
  'AU-TAS': ['Hobart', 'Launceston'],
  'AU-ACT': ['Canberra'],

  'IN-MH': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Navi Mumbai', 'Aurangabad'],
  'IN-KA': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi'],
  'IN-DL': ['New Delhi', 'Delhi', 'Connaught Place', 'Dwarka', 'Noida Extension'],
  'IN-TN': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  'IN-TG': ['Hyderabad', 'Warangal', 'Secunderabad', 'Nizamabad'],
  'IN-GJ': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
  'IN-UP': ['Noida', 'Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Ghaziabad'],
  'IN-WB': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur'],
  'IN-HR': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala'],
  'IN-KL': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur'],

  'DE-BE': ['Berlin', 'Mitte', 'Charlottenburg', 'Kreuzberg', 'Pankow'],
  'DE-BY': ['Munich (München)', 'Nuremberg (Nürnberg)', 'Augsburg', 'Regensburg', 'Würzburg', 'Ingolstadt'],
  'DE-HE': ['Frankfurt am Main', 'Wiesbaden', 'Kassel', 'Darmstadt', 'Offenbach'],
  'DE-NW': ['Cologne (Köln)', 'Düsseldorf', 'Dortmund', 'Essen', 'Bonn', 'Münster', 'Aachen', 'Duisburg'],
  'DE-BW': ['Stuttgart', 'Karlsruhe', 'Mannheim', 'Freiburg', 'Heidelberg', 'Ulm', 'Heilbronn'],
  'DE-HH': ['Hamburg', 'Altona', 'Eimsbüttel', 'Wandsbek'],
  'DE-SN': ['Leipzig', 'Dresden', 'Chemnitz'],

  'FR-IDF': ['Paris', 'Boulogne-Billancourt', 'Saint-Denis', 'Versailles', 'Nanterre', 'Créteil', 'Montreuil'],
  'FR-ARA': ['Lyon', 'Saint-Étienne', 'Grenoble', 'Villeurbanne', 'Clermont-Ferrand', 'Annecy'],
  'FR-PAC': ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Cannes', 'Avignon'],
  'FR-OCC': ['Toulouse', 'Montpellier', 'Nîmes', 'Perpignan', 'Béziers'],
  'FR-NAQ': ['Bordeaux', 'Limoges', 'Poitiers', 'Pau', 'La Rochelle'],

  'NL-NH': ['Amsterdam', 'Haarlem', 'Alkmaar', 'Hilversum', 'Amstelveen', 'Zaandam'],
  'NL-ZH': ['Rotterdam', 'The Hague (Den Haag)', 'Leiden', 'Delft', 'Dordrecht', 'Zoetermeer'],
  'NL-UT': ['Utrecht', 'Amersfoort', 'Veenendaal', 'Zeist'],
  'NL-NB': ['Eindhoven', 'Tilburg', 'Breda', "'s-Hertogenbosch", 'Helmond'],

  'AE-DXB': ['Dubai', 'Jumeirah', 'Business Bay', 'Downtown Dubai', 'Deira', 'Dubai Marina', 'Al Barsha'],
  'AE-AUH': ['Abu Dhabi', 'Al Ain', 'Musaffah', 'Khalifa City', 'Yas Island'],
  'AE-SHJ': ['Sharjah', 'Khor Fakkan', 'Kalba'],

  'SG-SG-CR': ['Singapore', 'Downtown Core', 'Marina Bay', 'Orchard', 'Tanjong Pagar', 'Novena'],
  'SG-SG-ER': ['Tampines', 'Bedok', 'Changi', 'Pasir Ris'],
  'SG-SG-WR': ['Jurong East', 'Clementi', 'Tuas', 'Bukit Batok'],

  'IE-D': ['Dublin', 'Dún Laoghaire', 'Swords', 'Tallaght', 'Blackrock', 'Sandyford'],
  'IE-C': ['Cork', 'Ballincollig', 'Cobh', 'Mallow'],
  'IE-G': ['Galway', 'Salthill', 'Tuam'],

  'ES-MD': ['Madrid', 'Móstoles', 'Alcalá de Henares', 'Fuenlabrada', 'Leganés', 'Getafe'],
  'ES-CT': ['Barcelona', "L'Hospitalet de Llobregat", 'Badalona', 'Terrassa', 'Sabadell', 'Tarragona', 'Girona'],
  'ES-AN': ['Seville', 'Málaga', 'Córdoba', 'Granada', 'Jerez de la Frontera', 'Almería', 'Marbella'],
  'ES-VC': ['Valencia', 'Alicante', 'Elche', 'Castellón de la Plana'],

  'IT-LOM': ['Milan', 'Brescia', 'Monza', 'Bergamo', 'Como', 'Varese', 'Pavia'],
  'IT-LAZ': ['Rome', 'Latina', 'Guidonia Montecelio', 'Fiumicino'],
  'IT-VEN': ['Venice', 'Verona', 'Padua', 'Vicenza', 'Treviso'],
  'IT-PIE': ['Turin', 'Novara', 'Alessandria', 'Asti'],

  'BR-SP': ['São Paulo', 'Campinas', 'Guarulhos', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'Ribeirão Preto', 'Santos'],
  'BR-RJ': ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Niterói'],

  'MX-CMX': ['Mexico City', 'Cuauhtémoc', 'Benito Juárez', 'Miguel Hidalgo', 'Álvaro Obregón', 'Coyoacán', 'Tlalpan'],
  'MX-JAL': ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Puerto Vallarta'],
  'MX-NLE': ['Monterrey', 'San Pedro Garza García', 'Guadalupe', 'San Nicolás de los Garza', 'Apodaca'],

  'JP-13': ['Tokyo', 'Shinjuku', 'Shibuya', 'Chiyoda', 'Minato', 'Chuo', 'Shinagawa'],
  'JP-27': ['Osaka', 'Sakai', 'Higashiosaka', 'Toyonaka'],

  'ZA-GP': ['Johannesburg', 'Pretoria', 'Sandton', 'Midrand', 'Centurion', 'Soweto', 'Randburg'],
  'ZA-WC': ['Cape Town', 'Stellenbosch', 'Paarl', 'George']
};

console.log(`Indexed subdivisions for ${Object.keys(REGIONS).length} countries.`);
console.log(`Indexed populated cities for ${Object.keys(CITIES).length} region keys.`);

fs.writeFileSync(path.join(targetDir, 'regions.json'), JSON.stringify(REGIONS, null, 2), 'utf8');
fs.writeFileSync(path.join(targetDir, 'cities.json'), JSON.stringify(CITIES, null, 2), 'utf8');

console.log('Successfully written countries.json, regions.json, and cities.json');
