// Static Philippine address reference data for the School Setup forms.
//
// The web app imports `@bzync/ph-address-intel`, which is an unpublished private package (the web
// repo only ships a stub of it), so it can't be used in React Native. This file replaces it:
//  - regions and provinces: complete (17 regions, NCR has no provinces)
//  - municipalities / zip codes: NCR (cities + their postal codes) and Cagayan (names only).
//    Other provinces have no municipality list; the pickers accept a typed-in value instead.

export interface Region {
  code: string;
  name: string;
}

export interface Province {
  code: string;
  name: string;
  regionCode: string;
}

export interface Municipality {
  code: string;
  name: string;
  regionCode: string;
  provinceCode: string | null;
  isCity: boolean;
  zipCodes: string[];
}

export interface ZipLookupResult {
  region: Region;
  province: Province | null;
  municipality: Municipality;
}

export const NCR_REGION_CODE = '130000000';

const REGIONS: Region[] = [
  { code: '130000000', name: 'National Capital Region (NCR)' },
  { code: '140000000', name: 'Cordillera Administrative Region (CAR)' },
  { code: '010000000', name: 'Region I - Ilocos Region' },
  { code: '020000000', name: 'Region II - Cagayan Valley' },
  { code: '030000000', name: 'Region III - Central Luzon' },
  { code: '040000000', name: 'Region IV-A - CALABARZON' },
  { code: '170000000', name: 'Region IV-B - MIMAROPA' },
  { code: '050000000', name: 'Region V - Bicol Region' },
  { code: '060000000', name: 'Region VI - Western Visayas' },
  { code: '070000000', name: 'Region VII - Central Visayas' },
  { code: '080000000', name: 'Region VIII - Eastern Visayas' },
  { code: '090000000', name: 'Region IX - Zamboanga Peninsula' },
  { code: '100000000', name: 'Region X - Northern Mindanao' },
  { code: '110000000', name: 'Region XI - Davao Region' },
  { code: '120000000', name: 'Region XII - SOCCSKSARGEN' },
  { code: '160000000', name: 'Region XIII - Caraga' },
  { code: '190000000', name: 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)' },
];

const PROVINCES: Province[] = [
  { code: '140000000-abra', name: 'Abra', regionCode: '140000000' },
  { code: '140000000-apayao', name: 'Apayao', regionCode: '140000000' },
  { code: '140000000-benguet', name: 'Benguet', regionCode: '140000000' },
  { code: '140000000-ifugao', name: 'Ifugao', regionCode: '140000000' },
  { code: '140000000-kalinga', name: 'Kalinga', regionCode: '140000000' },
  { code: '140000000-mountain-province', name: 'Mountain Province', regionCode: '140000000' },
  { code: '010000000-ilocos-norte', name: 'Ilocos Norte', regionCode: '010000000' },
  { code: '010000000-ilocos-sur', name: 'Ilocos Sur', regionCode: '010000000' },
  { code: '010000000-la-union', name: 'La Union', regionCode: '010000000' },
  { code: '010000000-pangasinan', name: 'Pangasinan', regionCode: '010000000' },
  { code: '020000000-batanes', name: 'Batanes', regionCode: '020000000' },
  { code: '020000000-cagayan', name: 'Cagayan', regionCode: '020000000' },
  { code: '020000000-isabela', name: 'Isabela', regionCode: '020000000' },
  { code: '020000000-nueva-vizcaya', name: 'Nueva Vizcaya', regionCode: '020000000' },
  { code: '020000000-quirino', name: 'Quirino', regionCode: '020000000' },
  { code: '030000000-aurora', name: 'Aurora', regionCode: '030000000' },
  { code: '030000000-bataan', name: 'Bataan', regionCode: '030000000' },
  { code: '030000000-bulacan', name: 'Bulacan', regionCode: '030000000' },
  { code: '030000000-nueva-ecija', name: 'Nueva Ecija', regionCode: '030000000' },
  { code: '030000000-pampanga', name: 'Pampanga', regionCode: '030000000' },
  { code: '030000000-tarlac', name: 'Tarlac', regionCode: '030000000' },
  { code: '030000000-zambales', name: 'Zambales', regionCode: '030000000' },
  { code: '040000000-batangas', name: 'Batangas', regionCode: '040000000' },
  { code: '040000000-cavite', name: 'Cavite', regionCode: '040000000' },
  { code: '040000000-laguna', name: 'Laguna', regionCode: '040000000' },
  { code: '040000000-quezon', name: 'Quezon', regionCode: '040000000' },
  { code: '040000000-rizal', name: 'Rizal', regionCode: '040000000' },
  { code: '170000000-marinduque', name: 'Marinduque', regionCode: '170000000' },
  { code: '170000000-occidental-mindoro', name: 'Occidental Mindoro', regionCode: '170000000' },
  { code: '170000000-oriental-mindoro', name: 'Oriental Mindoro', regionCode: '170000000' },
  { code: '170000000-palawan', name: 'Palawan', regionCode: '170000000' },
  { code: '170000000-romblon', name: 'Romblon', regionCode: '170000000' },
  { code: '050000000-albay', name: 'Albay', regionCode: '050000000' },
  { code: '050000000-camarines-norte', name: 'Camarines Norte', regionCode: '050000000' },
  { code: '050000000-camarines-sur', name: 'Camarines Sur', regionCode: '050000000' },
  { code: '050000000-catanduanes', name: 'Catanduanes', regionCode: '050000000' },
  { code: '050000000-masbate', name: 'Masbate', regionCode: '050000000' },
  { code: '050000000-sorsogon', name: 'Sorsogon', regionCode: '050000000' },
  { code: '060000000-aklan', name: 'Aklan', regionCode: '060000000' },
  { code: '060000000-antique', name: 'Antique', regionCode: '060000000' },
  { code: '060000000-capiz', name: 'Capiz', regionCode: '060000000' },
  { code: '060000000-guimaras', name: 'Guimaras', regionCode: '060000000' },
  { code: '060000000-iloilo', name: 'Iloilo', regionCode: '060000000' },
  { code: '060000000-negros-occidental', name: 'Negros Occidental', regionCode: '060000000' },
  { code: '070000000-bohol', name: 'Bohol', regionCode: '070000000' },
  { code: '070000000-cebu', name: 'Cebu', regionCode: '070000000' },
  { code: '070000000-negros-oriental', name: 'Negros Oriental', regionCode: '070000000' },
  { code: '070000000-siquijor', name: 'Siquijor', regionCode: '070000000' },
  { code: '080000000-biliran', name: 'Biliran', regionCode: '080000000' },
  { code: '080000000-eastern-samar', name: 'Eastern Samar', regionCode: '080000000' },
  { code: '080000000-leyte', name: 'Leyte', regionCode: '080000000' },
  { code: '080000000-northern-samar', name: 'Northern Samar', regionCode: '080000000' },
  { code: '080000000-samar', name: 'Samar', regionCode: '080000000' },
  { code: '080000000-southern-leyte', name: 'Southern Leyte', regionCode: '080000000' },
  { code: '090000000-zamboanga-del-norte', name: 'Zamboanga del Norte', regionCode: '090000000' },
  { code: '090000000-zamboanga-del-sur', name: 'Zamboanga del Sur', regionCode: '090000000' },
  { code: '090000000-zamboanga-sibugay', name: 'Zamboanga Sibugay', regionCode: '090000000' },
  { code: '100000000-bukidnon', name: 'Bukidnon', regionCode: '100000000' },
  { code: '100000000-camiguin', name: 'Camiguin', regionCode: '100000000' },
  { code: '100000000-lanao-del-norte', name: 'Lanao del Norte', regionCode: '100000000' },
  { code: '100000000-misamis-occidental', name: 'Misamis Occidental', regionCode: '100000000' },
  { code: '100000000-misamis-oriental', name: 'Misamis Oriental', regionCode: '100000000' },
  { code: '110000000-davao-de-oro', name: 'Davao de Oro', regionCode: '110000000' },
  { code: '110000000-davao-del-norte', name: 'Davao del Norte', regionCode: '110000000' },
  { code: '110000000-davao-del-sur', name: 'Davao del Sur', regionCode: '110000000' },
  { code: '110000000-davao-occidental', name: 'Davao Occidental', regionCode: '110000000' },
  { code: '110000000-davao-oriental', name: 'Davao Oriental', regionCode: '110000000' },
  { code: '120000000-cotabato', name: 'Cotabato', regionCode: '120000000' },
  { code: '120000000-sarangani', name: 'Sarangani', regionCode: '120000000' },
  { code: '120000000-south-cotabato', name: 'South Cotabato', regionCode: '120000000' },
  { code: '120000000-sultan-kudarat', name: 'Sultan Kudarat', regionCode: '120000000' },
  { code: '160000000-agusan-del-norte', name: 'Agusan del Norte', regionCode: '160000000' },
  { code: '160000000-agusan-del-sur', name: 'Agusan del Sur', regionCode: '160000000' },
  { code: '160000000-dinagat-islands', name: 'Dinagat Islands', regionCode: '160000000' },
  { code: '160000000-surigao-del-norte', name: 'Surigao del Norte', regionCode: '160000000' },
  { code: '160000000-surigao-del-sur', name: 'Surigao del Sur', regionCode: '160000000' },
  { code: '190000000-basilan', name: 'Basilan', regionCode: '190000000' },
  { code: '190000000-lanao-del-sur', name: 'Lanao del Sur', regionCode: '190000000' },
  { code: '190000000-maguindanao-del-norte', name: 'Maguindanao del Norte', regionCode: '190000000' },
  { code: '190000000-maguindanao-del-sur', name: 'Maguindanao del Sur', regionCode: '190000000' },
  { code: '190000000-sulu', name: 'Sulu', regionCode: '190000000' },
  { code: '190000000-tawi-tawi', name: 'Tawi-Tawi', regionCode: '190000000' },
];

// NCR has no provinces: its 16 cities and 1 municipality (Pateros) are listed directly, with postal codes.
export const NCR_CITIES: Municipality[] = [
  { code: 'ncr-caloocan', name: 'Caloocan', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1400'] },
  { code: 'ncr-las-pi-as', name: 'Las Piñas', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1740'] },
  { code: 'ncr-makati', name: 'Makati', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1200'] },
  { code: 'ncr-malabon', name: 'Malabon', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1470'] },
  { code: 'ncr-mandaluyong', name: 'Mandaluyong', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1550'] },
  { code: 'ncr-manila', name: 'Manila', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1000'] },
  { code: 'ncr-marikina', name: 'Marikina', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1800'] },
  { code: 'ncr-muntinlupa', name: 'Muntinlupa', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1770'] },
  { code: 'ncr-navotas', name: 'Navotas', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1485'] },
  { code: 'ncr-para-aque', name: 'Parañaque', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1700'] },
  { code: 'ncr-pasay', name: 'Pasay', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1300'] },
  { code: 'ncr-pasig', name: 'Pasig', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1600'] },
  { code: 'ncr-pateros', name: 'Pateros', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: false, zipCodes: ['1620'] },
  { code: 'ncr-quezon-city', name: 'Quezon City', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1100'] },
  { code: 'ncr-san-juan', name: 'San Juan', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1500'] },
  { code: 'ncr-taguig', name: 'Taguig', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1630'] },
  { code: 'ncr-valenzuela', name: 'Valenzuela', regionCode: NCR_REGION_CODE, provinceCode: null, isCity: true, zipCodes: ['1440'] },
];

const CAGAYAN_PROVINCE_CODE = '020000000-cagayan';
const CAGAYAN_MUNICIPALITIES: Municipality[] = [
  { code: 'cagayan-abulug', name: 'Abulug', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-alcala', name: 'Alcala', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-allacapan', name: 'Allacapan', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-amulung', name: 'Amulung', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-aparri', name: 'Aparri', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-baggao', name: 'Baggao', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-ballesteros', name: 'Ballesteros', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-buguey', name: 'Buguey', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-calayan', name: 'Calayan', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-camalaniugan', name: 'Camalaniugan', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-claveria', name: 'Claveria', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-enrile', name: 'Enrile', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-gattaran', name: 'Gattaran', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-gonzaga', name: 'Gonzaga', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-iguig', name: 'Iguig', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-lal-lo', name: 'Lal-lo', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-lasam', name: 'Lasam', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-pamplona', name: 'Pamplona', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-pe-ablanca', name: 'Peñablanca', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-piat', name: 'Piat', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-rizal', name: 'Rizal', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-sanchez-mira', name: 'Sanchez-Mira', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-santa-ana', name: 'Santa Ana', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-santa-praxedes', name: 'Santa Praxedes', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-santa-teresita', name: 'Santa Teresita', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-santo-ni-o', name: 'Santo Niño', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-solana', name: 'Solana', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-tuao', name: 'Tuao', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: false, zipCodes: [] },
  { code: 'cagayan-tuguegarao-city', name: 'Tuguegarao City', regionCode: '020000000', provinceCode: CAGAYAN_PROVINCE_CODE, isCity: true, zipCodes: [] },
];

const MUNICIPALITIES: Record<string, Municipality[]> = {
  [CAGAYAN_PROVINCE_CODE]: CAGAYAN_MUNICIPALITIES,
};

// Case- and accent-insensitive, ignoring punctuation ("STO. NIÑO" ~ "Sto Nino")
export const normalizeName = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const getRegions = (): Region[] => REGIONS;

export const getRegionByName = (name: string): Region | undefined => {
  const wanted = normalizeName(name);
  if (!wanted) return undefined;
  return (
    REGIONS.find((r) => normalizeName(r.name) === wanted) ??
    // Also accept short forms such as "Region II" or "NCR"
    REGIONS.find((r) => normalizeName(r.name).includes(wanted) || wanted.includes(normalizeName(r.name)))
  );
};

export const getProvinces = (regionCode: string): Province[] =>
  PROVINCES.filter((p) => p.regionCode === regionCode);

export const getProvinceByName = (regionCode: string, name: string): Province | undefined => {
  const wanted = normalizeName(name);
  return getProvinces(regionCode).find((p) => normalizeName(p.name) === wanted);
};

export const getMunicipalities = (provinceCode: string): Municipality[] => MUNICIPALITIES[provinceCode] ?? [];

export const getMunicipalityByName = (list: Municipality[], name: string): Municipality | undefined => {
  const wanted = normalizeName(name);
  return list.find((m) => normalizeName(m.name) === wanted);
};

// Postal code -> address. Only NCR zip codes are known, so anything else returns null.
export const lookupByZip = (zip: string): ZipLookupResult | null => {
  if (!/^\d{4}$/.test(zip)) return null;
  const municipality = NCR_CITIES.find((m) => m.zipCodes.includes(zip));
  const region = REGIONS.find((r) => r.code === NCR_REGION_CODE);
  return municipality && region ? { region, province: null, municipality } : null;
};
