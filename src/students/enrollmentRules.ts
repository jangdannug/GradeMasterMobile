import { EnrollmentRecord, PreviousSchool } from '../api/enrollments';
import { GradeLevel } from '../api/gradeLevels';
import { formatDate } from '../school-setup/dates';

export const ENROLLMENT_STATUSES = ['Enrolled', 'Transferred', 'Dropped', 'Graduated'];

export const ENROLLMENT_TYPES = [
  { value: '', label: 'None' },
  { value: 'LateEnrollee', label: 'Late Enrollee' },
  { value: 'TransferStudent', label: 'Transfer Student' },
];

export const SEMESTERS = [
  { value: '', label: 'None' },
  { value: '1st', label: '1st' },
  { value: '2nd', label: '2nd' },
];

/** Plain string comparison start <= date <= end; true when either bound is missing */
export const isValidEnrollmentDate = (date: string, start?: string, end?: string): boolean => {
  if (!start || !end) return true;
  return start <= date && date <= end;
};

export const outsideWindowMessage = (start: string, end: string) =>
  `Enrollment is only allowed from ${formatDate(start)} to ${formatDate(end)}`;

/** A bare yyyy-MM-dd widened to a full ISO instant (the backend wants one) */
export const widenDate = (date: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : date);

/** Leading yyyy-MM-dd of a timestamp; formatDate rebuilds it from parts, so no timezone shift */
export const datePart = (timestamp: string): string => timestamp.slice(0, 10);

export const isShsLevel = (level: GradeLevel | undefined) => !!level && level.numericLevel >= 11;

export interface EnrollmentFormState {
  studentId: string;
  studentLabel: string;
  gradeLevelId: string;
  sectionId: string;
  date: string;
  status: string;
  enrollmentType: string;
  isReturning: boolean;
  lastGradeLevelCompleted: string;
  lastSchoolAttended: string;
  lastSchoolId: string;
  lastSchoolYearCompleted: string;
  semester: string;
  track: string;
  strand: string;
}

export const emptyEnrollmentForm = (today: string): EnrollmentFormState => ({
  studentId: '',
  studentLabel: '',
  gradeLevelId: '',
  sectionId: '',
  date: today,
  status: 'Enrolled',
  enrollmentType: '',
  isReturning: false,
  lastGradeLevelCompleted: '',
  lastSchoolAttended: '',
  lastSchoolId: '',
  lastSchoolYearCompleted: '',
  semester: '',
  track: '',
  strand: '',
});

export function formFromEnrollment(
  e: EnrollmentRecord,
  studentLabel: string,
  gradeLevelId: string
): EnrollmentFormState {
  return {
    studentId: e.studentId,
    studentLabel,
    gradeLevelId,
    sectionId: e.schoolYearSectionId,
    date: datePart(e.enrollmentDate),
    status: e.status || 'Enrolled',
    enrollmentType: e.enrollmentType,
    isReturning: e.isReturning,
    lastGradeLevelCompleted: e.previousSchool?.lastGradeLevelCompleted ?? '',
    lastSchoolAttended: e.previousSchool?.lastSchoolAttended ?? '',
    lastSchoolId: e.previousSchool?.lastSchoolId ?? '',
    lastSchoolYearCompleted: e.previousSchool?.lastSchoolYearCompleted ?? '',
    semester: e.semester,
    track: e.track,
    strand: e.strand,
  };
}

/** First problem (the spec's messages) or null */
export function validateEnrollmentForm(
  f: EnrollmentFormState,
  window: { start?: string; end?: string }
): string | null {
  if (!f.studentId) return 'Student is required';
  if (!f.sectionId) return 'Section is required';
  if (!f.date) return 'Enrollment date is required';
  if (!isValidEnrollmentDate(f.date, window.start, window.end) && !f.enrollmentType)
    return 'Enrollment Type is required when enrolling outside the enrollment period';
  if (f.enrollmentType === 'TransferStudent') {
    if (!f.lastSchoolAttended.trim()) return 'Last school attended is required for transfer students';
    if (!f.lastGradeLevelCompleted.trim()) return 'Last grade level completed is required for transfer students';
    if (!/^\d{4}$/.test(f.lastSchoolYearCompleted.trim())) return 'Last school year completed must be a 4-digit year';
  }
  return null;
}

/**
 * Builds the POST/PUT body: blank optional fields are omitted, semester/track/strand only go out
 * for senior-high levels, and previousSchool only carries its non-blank members. On UPDATE an
 * existing previous-school block is always re-sent (the backend cannot detach it); for new records
 * it is only collected for transfers.
 */
export function buildEnrollmentPayload(
  f: EnrollmentFormState,
  options: { shs: boolean; editing: boolean; hadPreviousSchool: boolean }
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    studentId: f.studentId,
    schoolYearSectionId: f.sectionId,
    enrollmentDate: widenDate(f.date),
    status: f.status || 'Enrolled',
    isReturning: f.isReturning,
  };
  if (f.enrollmentType) payload.enrollmentType = f.enrollmentType;
  if (options.shs) {
    if (f.semester.trim()) payload.semester = f.semester.trim();
    if (f.track.trim()) payload.track = f.track.trim();
    if (f.strand.trim()) payload.strand = f.strand.trim();
  }

  const includePrevious =
    f.enrollmentType === 'TransferStudent' || (options.editing && options.hadPreviousSchool);
  if (includePrevious) {
    const previous: Record<string, string> = {};
    if (f.lastGradeLevelCompleted.trim()) previous.lastGradeLevelCompleted = f.lastGradeLevelCompleted.trim();
    if (f.lastSchoolAttended.trim()) previous.lastSchoolAttended = f.lastSchoolAttended.trim();
    if (f.lastSchoolId.trim()) previous.lastSchoolId = f.lastSchoolId.trim();
    if (f.lastSchoolYearCompleted.trim()) previous.lastSchoolYearCompleted = f.lastSchoolYearCompleted.trim();
    if (Object.keys(previous).length > 0) payload.previousSchool = previous;
  }
  return payload;
}

export const previousSchoolSummary = (p: PreviousSchool) =>
  `Last level completed: ${p.lastGradeLevelCompleted || '—'} · School ID: ${p.lastSchoolId || '—'} · School year: ${
    p.lastSchoolYearCompleted || '—'
  }`;

/**
 * Highest numericLevel each student was previously enrolled in, across the given enrollments
 * (0 when none). `levelOfSection` maps a section id to its numericLevel.
 */
export function highestLevelByStudent(
  enrollments: EnrollmentRecord[],
  levelOfSection: Map<string, number>
): Map<string, number> {
  const highest = new Map<string, number>();
  enrollments.forEach((e) => {
    const level = levelOfSection.get(e.schoolYearSectionId) ?? 0;
    if (level > (highest.get(e.studentId) ?? 0)) highest.set(e.studentId, level);
  });
  return highest;
}
