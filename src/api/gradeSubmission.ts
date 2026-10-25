import { initializeApi, peel, peelList, unwrap } from '../api';
import { classRecordStatusValue } from '../class-record/logic';

const ZERO_GUID = '00000000-0000-0000-0000-000000000000';
/** The all-zero GUID means "not created yet" */
const guid = (value: unknown): string => (value && value !== ZERO_GUID ? String(value) : '');
const text = (value: unknown) => (value == null ? '' : String(value));
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0);

// ---- Scoresheet ------------------------------------------------------------------------------------

export interface SheetItem {
  id: string;
  name: string;
  maxScore: number;
  sequenceNo: number;
}

export interface SheetComponent {
  id: string;
  name: string;
  weightPercent: number;
  sequenceNo: number;
  items: SheetItem[];
}

export interface SheetRow {
  enrollmentId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  scores: Record<string, { studentScoreId: string; rawScore: number | null }>;
  /** Computed by the server; null until there is something to compute */
  finalGrade: number | null;
}

export interface Scoresheet {
  classSubjectOfferingId: string;
  gradingPeriodId: string;
  /** True when the caller is not the subject teacher: only final grades are populated */
  isRedacted: boolean;
  submissionStatus: number;
  classRecordSubmissionId: string;
  /** The server's edit gate; never second-guessed on the client */
  isEditable: boolean;
  isLate: boolean;
  submittedAt: string;
  components: SheetComponent[];
  rows: SheetRow[];
}

export const mapScoresheet = (raw: any): Scoresheet => ({
  classSubjectOfferingId: text(raw?.classSubjectOfferingId),
  gradingPeriodId: text(raw?.gradingPeriodId),
  isRedacted: raw?.isRedacted === true,
  submissionStatus: classRecordStatusValue(raw?.submissionStatus) ?? 0,
  classRecordSubmissionId: guid(raw?.classRecordSubmissionId),
  isEditable: raw?.isEditable === true,
  isLate: raw?.isLate === true,
  submittedAt: text(raw?.submittedAt),
  components: (raw?.components ?? [])
    .map((c: any) => ({
      id: c.gradingComponentId,
      name: text(c.name),
      weightPercent: num(c.weightPercent),
      sequenceNo: num(c.sequenceNo),
      items: (c.items ?? [])
        .map((i: any) => ({
          id: i.gradingComponentItemId,
          name: text(i.name),
          maxScore: num(i.maxScore),
          sequenceNo: num(i.sequenceNo),
        }))
        .sort((a: SheetItem, b: SheetItem) => a.sequenceNo - b.sequenceNo),
    }))
    .sort((a: SheetComponent, b: SheetComponent) => a.sequenceNo - b.sequenceNo),
  rows: (raw?.rows ?? []).map((r: any) => ({
    enrollmentId: text(r.enrollmentId),
    studentId: text(r.studentId),
    firstName: text(r.studentFirstName),
    lastName: text(r.studentLastName),
    scores: Object.fromEntries(
      Object.entries(r.scores ?? {}).map(([itemId, cell]: [string, any]) => [
        itemId,
        { studentScoreId: text(cell?.studentScoreId), rawScore: cell?.rawScore ?? null },
      ])
    ),
    finalGrade: r.finalGrade ?? null,
  })),
});

// ---- Readiness (per section and grading period) ----------------------------------------------------

export interface ClassRecordRow {
  classRecordSubmissionId: string;
  classSubjectOfferingId: string;
  subjectName: string;
  status: number;
  isLate: boolean;
  submittedAt: string;
  sectionGradeSubmissionId: string;
}

export interface SectionReadiness {
  sectionGradeSubmissionId: string;
  /** SectionSubmissionStatus */
  status: number;
  isLate: boolean;
  classRecords: ClassRecordRow[];
}

export const mapReadiness = (body: any): SectionReadiness => {
  const raw = peel(body, 'classRecords') ?? peel(body, 'sectionGradeSubmissionId') ?? {};
  const sgs = guid(raw.sectionGradeSubmissionId) || guid(raw.sectionGradeSubmission?.id);
  return {
    sectionGradeSubmissionId: sgs,
    status: num(raw.status),
    isLate: raw.isLate === true,
    classRecords: (raw.classRecords ?? []).map((c: any) => ({
      classRecordSubmissionId: guid(c.classRecordSubmissionId),
      classSubjectOfferingId: text(c.classSubjectOfferingId),
      subjectName: text(c.subjectName),
      status: classRecordStatusValue(c.status) ?? 0,
      isLate: c.isLate === true,
      submittedAt: text(c.submittedAt),
      sectionGradeSubmissionId: guid(c.sectionGradeSubmissionId) || sgs,
    })),
  };
};

// ---- Class record submission -----------------------------------------------------------------------

export interface SubmissionResult {
  classRecordSubmissionId: string;
  sectionGradeSubmissionId: string;
  status: number;
  isLate: boolean;
}

export interface Snapshot {
  classRecordSnapshotId: string;
  version: number;
  createdDate: string;
}

export interface SaveScoreEntry {
  enrollmentId: string;
  gradingComponentItemId: string;
  rawScore: number | null;
}

export const gradeSubmissionApi = {
  scoresheet: async (offeringId: string, gradingPeriodId: string): Promise<Scoresheet> => {
    const res = await initializeApi().get(`/api/StudentScore/class-subject-offering/${offeringId}/scores/sheet`, {
      params: { gradingPeriodId },
    });
    const raw = peel(res.data, 'rows') ?? peel(res.data, 'classSubjectOfferingId');
    return mapScoresheet(raw);
  },

  /** Only the changed cells are sent; a null rawScore clears the score */
  saveScores: async (offeringId: string, gradingPeriodId: string, entries: SaveScoreEntry[]) => {
    const res = await initializeApi().post(`/api/StudentScore/class-subject-offering/${offeringId}/scores/bulk`, {
      gradingPeriodId,
      entries,
    });
    return unwrap<{ inserted: number; updated: number; deleted: number }>(res.data);
  },

  readiness: async (sectionId: string, gradingPeriodId: string): Promise<SectionReadiness> => {
    const res = await initializeApi().get(`/api/SectionGradeSubmission/sections/${sectionId}/periods/${gradingPeriodId}`);
    return mapReadiness(res.data);
  },

  /** The response may be wrapped; read the ids defensively */
  submit: async (offeringId: string, gradingPeriodId: string): Promise<SubmissionResult> => {
    const res = await initializeApi().post(
      `/api/ClassRecordSubmission/class-subject-offering/${offeringId}/periods/${gradingPeriodId}/submit`,
      {}
    );
    const raw = peel(res.data, 'classRecordSubmissionId') ?? {};
    return {
      classRecordSubmissionId: guid(raw.classRecordSubmissionId),
      sectionGradeSubmissionId: guid(raw.sectionGradeSubmissionId),
      status: classRecordStatusValue(raw.status) ?? 0,
      isLate: raw.isLate === true,
    };
  },

  withdraw: async (classRecordSubmissionId: string): Promise<void> => {
    await initializeApi().post(`/api/ClassRecordSubmission/${classRecordSubmissionId}/withdraw`, {});
  },

  snapshots: async (classRecordSubmissionId: string): Promise<Snapshot[]> => {
    const res = await initializeApi().get(`/api/ClassRecordSubmission/${classRecordSubmissionId}/snapshots`);
    return peelList(res.data).map((s: any) => ({
      classRecordSnapshotId: s.classRecordSnapshotId,
      version: num(s.version),
      createdDate: text(s.createdDate),
    }));
  },

  // ---- Section level (the head's decision) --------------------------------------------------------

  /** The section adviser sends the section on to the head once every record is ready */
  submitSection: async (sectionGradeSubmissionId: string): Promise<void> => {
    await initializeApi().post(`/api/SectionGradeSubmission/${sectionGradeSubmissionId}/submit`, {});
  },

  approveSection: async (sectionGradeSubmissionId: string): Promise<void> => {
    await initializeApi().post(`/api/SectionGradeSubmission/${sectionGradeSubmissionId}/approve`, {});
  },

  /** A reason is required; naming class records returns just those to their teachers */
  rejectSection: async (
    sectionGradeSubmissionId: string,
    comment: string,
    returnedClassRecordSubmissionIds?: string[]
  ): Promise<void> => {
    await initializeApi().post(`/api/SectionGradeSubmission/${sectionGradeSubmissionId}/reject`, {
      comment,
      ...(returnedClassRecordSubmissionIds?.length ? { returnedClassRecordSubmissionIds } : {}),
    });
  },
};
