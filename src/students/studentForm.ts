import { GuardianRecord, StudentRecord } from '../api/students';

export const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV'];

export const NOT_SPECIFIED_REASONS = [
  { value: '', label: 'Not specified (none)' },
  { value: 'NoMother', label: 'Mother deceased' },
  { value: 'NotDisclosed', label: 'Not disclosed' },
];

export interface RelativeForm {
  lastName: string;
  firstName: string;
  middleName: string;
  extensionName: string;
  noMiddleName: boolean;
  /** Guardian only */
  relationship: string;
  /** Mother only: "NoMother" | "NotDisclosed" | '' */
  notSpecifiedReason: string;
}

export interface StudentFormState {
  psaBirthCertNo: string;
  lrn: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthDate: string;
  sex: 'Male' | 'Female';
  placeOfBirth: string;
  emailAddress: string;
  countryOfCitizenship: string;

  houseNo: string;
  street: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  zipCode: string;
  permanentSame: boolean;
  permanentHouseNo: string;
  permanentStreet: string;
  permanentBarangay: string;
  permanentCityMunicipality: string;
  permanentProvince: string;
  permanentZipCode: string;

  motherTongueId: string;
  religionId: string;
  spokenLanguageIds: string[];
  isIndigenous: boolean;
  ethnicityIds: string[];
  isCct: boolean;
  cctHouseholdId: string;
  hasSen: boolean;
  lsenTypeIds: string[];
  isCovidVaccinated: boolean;
  covidFirstShotDate: string;
  covidFullVaccinationDate: string;

  father: RelativeForm;
  mother: RelativeForm;
  guardian: RelativeForm;
}

const emptyRelative = (): RelativeForm => ({
  lastName: '',
  firstName: '',
  middleName: '',
  extensionName: '',
  noMiddleName: false,
  relationship: '',
  notSpecifiedReason: '',
});

export const emptyStudentForm = (): StudentFormState => ({
  psaBirthCertNo: '',
  lrn: '',
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  birthDate: '',
  sex: 'Male',
  placeOfBirth: '',
  emailAddress: '',
  countryOfCitizenship: 'Filipino',

  houseNo: '',
  street: '',
  barangay: '',
  cityMunicipality: '',
  province: '',
  zipCode: '',
  permanentSame: true,
  permanentHouseNo: '',
  permanentStreet: '',
  permanentBarangay: '',
  permanentCityMunicipality: '',
  permanentProvince: '',
  permanentZipCode: '',

  motherTongueId: '',
  religionId: '',
  spokenLanguageIds: [],
  isIndigenous: false,
  ethnicityIds: [],
  isCct: false,
  cctHouseholdId: '',
  hasSen: false,
  lsenTypeIds: [],
  isCovidVaccinated: false,
  covidFirstShotDate: '',
  covidFullVaccinationDate: '',

  father: emptyRelative(),
  mother: emptyRelative(),
  guardian: emptyRelative(),
});

const relativeFrom = (g: GuardianRecord | undefined): RelativeForm => ({
  lastName: g?.lastName ?? '',
  firstName: g?.firstName ?? '',
  middleName: g?.middleName ?? '',
  extensionName: g?.extensionName ?? '',
  noMiddleName: !!g?.hasNoMiddleName,
  relationship: g?.relationship ?? '',
  notSpecifiedReason: g?.motherNameNotSpecifiedReason ?? '',
});

/** Prefill for editing: guardians[] split by relationshipType, dates cut to yyyy-MM-dd, lookups as id strings */
export function formFromStudent(s: StudentRecord): StudentFormState {
  const byType = (type: string) => s.guardians.find((g) => g.relationshipType.toLowerCase() === type);
  const mother = byType('mother');
  return {
    psaBirthCertNo: s.psaBirthCertNo,
    lrn: s.lrn,
    firstName: s.firstName,
    middleName: s.middleName,
    lastName: s.lastName,
    suffix: s.suffix,
    birthDate: s.birthDate.slice(0, 10),
    sex: s.sex === 'Female' ? 'Female' : 'Male',
    placeOfBirth: s.placeOfBirth,
    emailAddress: s.emailAddress,
    countryOfCitizenship: s.countryOfCitizenship || 'Filipino',

    houseNo: s.houseNo,
    street: s.street,
    barangay: s.barangay,
    cityMunicipality: s.cityMunicipality,
    province: s.province,
    zipCode: s.zipCode,
    permanentSame: s.isPermanentSameAsCurrent,
    permanentHouseNo: s.permanentHouseNo,
    permanentStreet: s.permanentStreet,
    permanentBarangay: s.permanentBarangay,
    permanentCityMunicipality: s.permanentCityMunicipality,
    permanentProvince: s.permanentProvince,
    permanentZipCode: s.permanentZipCode,

    motherTongueId: s.motherTongueId != null ? String(s.motherTongueId) : '',
    religionId: s.religionId != null ? String(s.religionId) : '',
    spokenLanguageIds: s.spokenLanguages.map((x) => String(x.id)),
    isIndigenous: s.isIndigenousPeople,
    ethnicityIds: s.ethnicities.map((x) => String(x.id)),
    isCct: s.isCctBeneficiary,
    cctHouseholdId: s.cctHouseholdId,
    hasSen: s.hasSpecialEducationalNeeds,
    lsenTypeIds: s.lsenTypes.map((x) => String(x.id)),
    isCovidVaccinated: s.isCovidVaccinated,
    covidFirstShotDate: s.covidFirstShotDate.slice(0, 10),
    covidFullVaccinationDate: s.covidFullVaccinationDate.slice(0, 10),

    father: relativeFrom(byType('father')),
    mother: relativeFrom(mother),
    guardian: relativeFrom(byType('guardian')),
  };
}

const hasName = (r: RelativeForm) => !!(r.firstName.trim() || r.lastName.trim());

/** First problem in the spec's order, or null when the form is valid */
export function validateStudentForm(f: StudentFormState): string | null {
  if (!f.firstName.trim()) return 'First name is required';
  if (!f.lastName.trim()) return 'Last name is required';
  if (!f.cityMunicipality.trim()) return 'City / Municipality is required';
  if (!f.province.trim()) return 'Province is required';
  if (!f.countryOfCitizenship.trim()) return 'Country of citizenship is required';

  const hasRelative = hasName(f.father) || hasName(f.mother) || hasName(f.guardian) || !!f.mother.notSpecifiedReason;
  if (!hasRelative) return 'At least one of father, mother, or guardian is required';

  if (!f.permanentSame && (!f.permanentCityMunicipality.trim() || !f.permanentProvince.trim()))
    return 'Permanent city/municipality and province are required';

  // The backend rejects a relative with a partial name, so catch it here with a clear message
  for (const [label, r] of [
    ['Father', f.father],
    ['Mother', f.mother],
    ['Guardian', f.guardian],
  ] as const) {
    if (!hasName(r)) continue;
    if (!r.lastName.trim() || !r.firstName.trim()) return `${label}: enter both the first and last name`;
    if (!r.noMiddleName && !r.middleName.trim())
      return `${label}: middle name is required unless "No middle name" is checked`;
  }
  if (hasName(f.guardian) && !f.guardian.relationship.trim()) return 'Guardian: relationship to learner is required';
  return null;
}

const t = (value: string) => value.trim();

function relativePayload(r: RelativeForm, extra: Record<string, unknown> = {}) {
  return {
    lastName: t(r.lastName),
    firstName: t(r.firstName),
    middleName: r.noMiddleName ? '' : t(r.middleName),
    hasNoMiddleName: r.noMiddleName,
    extensionName: t(r.extensionName),
    ...extra,
  };
}

/**
 * Builds the POST/PUT body. Rules that the backend enforces:
 *  - emailAddress and birthDate are OMITTED when blank (an empty email is rejected);
 *  - dependent fields are cleared when their switch is off;
 *  - relatives are only sent with a first or last name;
 *  - the mother's notSpecifiedReason must be ABSENT when her last name is given.
 */
export function buildStudentPayload(f: StudentFormState): Record<string, unknown> {
  const ids = (list: string[]) => list.map(Number);
  const payload: Record<string, unknown> = {
    psaBirthCertNo: t(f.psaBirthCertNo),
    lrn: t(f.lrn),
    firstName: t(f.firstName),
    middleName: t(f.middleName),
    lastName: t(f.lastName),
    suffix: t(f.suffix),
    sex: f.sex,
    placeOfBirth: t(f.placeOfBirth),
    countryOfCitizenship: t(f.countryOfCitizenship),

    motherTongueId: f.motherTongueId ? Number(f.motherTongueId) : null,
    religionId: f.religionId ? Number(f.religionId) : null,
    spokenLanguageIds: ids(f.spokenLanguageIds),

    isIndigenousPeople: f.isIndigenous,
    ethnicityIds: f.isIndigenous ? ids(f.ethnicityIds) : [],
    isCctBeneficiary: f.isCct,
    cctHouseholdId: f.isCct ? t(f.cctHouseholdId) : '',
    hasSpecialEducationalNeeds: f.hasSen,
    lsenTypeIds: f.hasSen ? ids(f.lsenTypeIds) : [],
    isCovidVaccinated: f.isCovidVaccinated,

    houseNo: t(f.houseNo),
    street: t(f.street),
    barangay: t(f.barangay),
    cityMunicipality: t(f.cityMunicipality),
    province: t(f.province),
    zipCode: t(f.zipCode),

    isPermanentSameAsCurrent: f.permanentSame,
    permanentHouseNo: f.permanentSame ? '' : t(f.permanentHouseNo),
    permanentStreet: f.permanentSame ? '' : t(f.permanentStreet),
    permanentBarangay: f.permanentSame ? '' : t(f.permanentBarangay),
    permanentCityMunicipality: f.permanentSame ? '' : t(f.permanentCityMunicipality),
    permanentProvince: f.permanentSame ? '' : t(f.permanentProvince),
    permanentZipCode: f.permanentSame ? '' : t(f.permanentZipCode),
  };

  if (t(f.emailAddress)) payload.emailAddress = t(f.emailAddress);
  if (f.birthDate) payload.birthDate = f.birthDate;
  if (f.isCovidVaccinated && f.covidFirstShotDate) payload.covidFirstShotDate = f.covidFirstShotDate;
  if (f.isCovidVaccinated && f.covidFullVaccinationDate) payload.covidFullVaccinationDate = f.covidFullVaccinationDate;

  if (hasName(f.father)) payload.father = relativePayload(f.father);
  if (hasName(f.guardian)) payload.guardian = relativePayload(f.guardian, { relationship: t(f.guardian.relationship) });

  if (t(f.mother.lastName)) {
    // A named mother never carries a reason
    payload.mother = relativePayload(f.mother);
  } else if (f.mother.notSpecifiedReason) {
    payload.mother = { notSpecifiedReason: f.mother.notSpecifiedReason };
  } else if (hasName(f.mother)) {
    payload.mother = relativePayload(f.mother);
  }
  return payload;
}
