import { asList, initializeApi, PagedResult, peel, toPaged, unwrap } from '../api';

export interface LookupRef {
  id: number;
  name: string;
}

/** One entry of `guardians[]`: relationshipType is "Father", "Mother" or "Guardian" */
export interface GuardianRecord {
  relationshipType: string;
  lastName: string;
  firstName: string;
  middleName: string;
  hasNoMiddleName: boolean;
  extensionName: string;
  relationship: string;
  motherNameNotSpecifiedReason: string;
}

/** A registered student, normalized at the boundary: text is never null, lists are never missing */
export interface StudentRecord {
  studentId: string;
  psaBirthCertNo: string;
  lrn: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthDate: string; // yyyy-MM-dd or ''
  age: number | null;
  sex: string;
  placeOfBirth: string;
  emailAddress: string;
  countryOfCitizenship: string;
  motherTongueId: number | null;
  motherTongue: string;
  religionId: number | null;
  religion: string;
  spokenLanguages: LookupRef[];
  isIndigenousPeople: boolean;
  ethnicities: LookupRef[];
  isCctBeneficiary: boolean;
  cctHouseholdId: string;
  hasSpecialEducationalNeeds: boolean;
  lsenTypes: LookupRef[];
  isCovidVaccinated: boolean;
  covidFirstShotDate: string;
  covidFullVaccinationDate: string;
  houseNo: string;
  street: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  zipCode: string;
  isPermanentSameAsCurrent: boolean;
  permanentHouseNo: string;
  permanentStreet: string;
  permanentBarangay: string;
  permanentCityMunicipality: string;
  permanentProvince: string;
  permanentZipCode: string;
  guardians: GuardianRecord[];
  createdDate: string;
  modifiedDate: string;
}

/** Kept for older imports */
export type Student = StudentRecord;

const text = (value: unknown) => (value == null ? '' : String(value));
const day = (value: unknown) => (value ? String(value).slice(0, 10) : '');
const refs = (list: any[] | null | undefined): LookupRef[] =>
  (list ?? []).map((x) => ({ id: x.id, name: text(x.name) }));

export const mapStudent = (raw: any): StudentRecord => ({
  studentId: raw.studentId,
  psaBirthCertNo: text(raw.psaBirthCertNo),
  lrn: text(raw.lrn),
  firstName: text(raw.firstName),
  middleName: text(raw.middleName),
  lastName: text(raw.lastName),
  suffix: text(raw.suffix),
  birthDate: day(raw.birthDate),
  age: raw.age ?? null,
  sex: text(raw.sex),
  placeOfBirth: text(raw.placeOfBirth),
  emailAddress: text(raw.emailAddress),
  countryOfCitizenship: text(raw.countryOfCitizenship),
  motherTongueId: raw.motherTongueId ?? null,
  motherTongue: text(raw.motherTongue),
  religionId: raw.religionId ?? null,
  religion: text(raw.religion),
  spokenLanguages: refs(raw.spokenLanguages),
  isIndigenousPeople: !!raw.isIndigenousPeople,
  ethnicities: refs(raw.ethnicities),
  isCctBeneficiary: !!raw.isCctBeneficiary,
  cctHouseholdId: text(raw.cctHouseholdId),
  hasSpecialEducationalNeeds: !!raw.hasSpecialEducationalNeeds,
  lsenTypes: refs(raw.lsenTypes),
  isCovidVaccinated: !!raw.isCovidVaccinated,
  covidFirstShotDate: day(raw.covidFirstShotDate),
  covidFullVaccinationDate: day(raw.covidFullVaccinationDate),
  houseNo: text(raw.houseNo),
  street: text(raw.street),
  barangay: text(raw.barangay),
  cityMunicipality: text(raw.cityMunicipality),
  province: text(raw.province),
  zipCode: text(raw.zipCode),
  isPermanentSameAsCurrent: raw.isPermanentSameAsCurrent ?? true,
  permanentHouseNo: text(raw.permanentHouseNo),
  permanentStreet: text(raw.permanentStreet),
  permanentBarangay: text(raw.permanentBarangay),
  permanentCityMunicipality: text(raw.permanentCityMunicipality),
  permanentProvince: text(raw.permanentProvince),
  permanentZipCode: text(raw.permanentZipCode),
  guardians: (raw.guardians ?? []).map((g: any) => ({
    relationshipType: text(g.relationshipType),
    lastName: text(g.lastName),
    firstName: text(g.firstName),
    middleName: text(g.middleName),
    hasNoMiddleName: !!g.hasNoMiddleName,
    extensionName: text(g.extensionName),
    relationship: text(g.relationship),
    motherNameNotSpecifiedReason: text(g.motherNameNotSpecifiedReason),
  })),
  createdDate: text(raw.createdDate),
  modifiedDate: text(raw.modifiedDate),
});

/** "Last, First Middle, Suffix" (blank parts skipped) */
export const formatStudentName = (s: Pick<StudentRecord, 'lastName' | 'firstName' | 'middleName' | 'suffix'>) =>
  [s.lastName, [s.firstName, s.middleName].filter(Boolean).join(' '), s.suffix].filter(Boolean).join(', ');

// Case- and accent-insensitive
const norm = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 20;

export const studentsApi = {
  paged: async (pageNumber: number, search: string, pageSize = 20): Promise<PagedResult<StudentRecord>> => {
    const res = await initializeApi().get('/api/Student/paged', {
      params: { PageNumber: pageNumber, PageSize: pageSize, Search: search || undefined },
    });
    return toPaged(unwrap<any>(res.data), mapStudent, pageNumber, pageSize);
  },

  get: async (studentId: string): Promise<StudentRecord> => {
    const res = await initializeApi().get(`/api/Student/${studentId}`);
    return mapStudent(unwrap<any>(res.data));
  },

  /** Every student (pages of 100, up to 20 pages) */
  listAll: async (): Promise<StudentRecord[]> => {
    const all: StudentRecord[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await studentsApi.paged(page, '', MAX_PAGE_SIZE);
      all.push(...result.items);
      if (!result.hasNextPage) break;
    }
    return all;
  },

  /**
   * The backend search matches the whole query against one field ("Ramon Abad" finds nothing), so
   * this fetches everything and requires every word to match the full name, suffix or LRN.
   */
  searchAll: async (query: string): Promise<StudentRecord[]> => {
    const words = norm(query).split(/\s+/).filter(Boolean);
    const all = await studentsApi.listAll();
    return all.filter((s) => {
      const haystack = norm([s.firstName, s.middleName, s.lastName, s.suffix, s.lrn].filter(Boolean).join(' '));
      return words.every((w) => haystack.includes(w));
    });
  },

  create: async (payload: Record<string, unknown>): Promise<StudentRecord | null> => {
    const res = await initializeApi().post('/api/Student', payload);
    const raw = peel(res.data, 'studentId');
    return raw ? mapStudent(raw) : null;
  },

  update: async (studentId: string, payload: Record<string, unknown>): Promise<StudentRecord | null> => {
    const res = await initializeApi().put(`/api/Student/${studentId}`, payload);
    const raw = peel(res.data, 'studentId');
    return raw ? mapStudent(raw) : null;
  },

  remove: async (studentId: string): Promise<void> => {
    await initializeApi().delete(`/api/Student/${studentId}`);
  },
};

// Kept so asList stays referenced for callers that import it from here
export { asList };
