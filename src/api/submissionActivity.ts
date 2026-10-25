import { initializeApi, PagedResult, peelList, toPaged, unwrap } from '../api';

const text = (value: unknown) => (value == null ? '' : String(value));

export interface Activity {
  id: string;
  classRecordSubmissionId: string;
  subjectName: string;
  /** ActivityCategory: 0 decision, 1 comment */
  category: number;
  type: number;
  actorProfileId: string;
  actorName: string;
  comment: string;
  snapshotVersion: number | null;
  remarks: string;
  createdDate: string;
}

export interface CommentThread {
  id: string;
  sectionGradeSubmissionId: string;
  classRecordSubmissionId: string;
  parentCommentId: string;
  replyToProfileId: string;
  replyToName: string;
  body: string;
  authorProfileId: string;
  authorName: string;
  createdDate: string;
  editedAt: string;
  isDeleted: boolean;
  replies: CommentThread[];
}

const mapActivity = (raw: any): Activity => ({
  id: raw.submissionActivityId,
  classRecordSubmissionId: text(raw.classRecordSubmissionId),
  subjectName: text(raw.subjectName),
  category: Number(raw.category) || 0,
  type: Number(raw.type) || 0,
  actorProfileId: text(raw.actorProfileId),
  actorName: text(raw.actorName),
  comment: text(raw.comment),
  snapshotVersion: raw.snapshotVersion ?? null,
  remarks: text(raw.remarks),
  createdDate: text(raw.createdDate),
});

export const mapComment = (raw: any): CommentThread => ({
  id: raw.submissionCommentId,
  sectionGradeSubmissionId: text(raw.sectionGradeSubmissionId),
  classRecordSubmissionId: text(raw.classRecordSubmissionId),
  parentCommentId: text(raw.parentCommentId),
  replyToProfileId: text(raw.replyToProfileId),
  replyToName: text(raw.replyToName),
  body: text(raw.body),
  authorProfileId: text(raw.authorProfileId),
  authorName: text(raw.authorName),
  createdDate: text(raw.createdDate),
  editedAt: text(raw.editedAt),
  isDeleted: raw.isDeleted === true,
  replies: (raw.replies ?? []).map(mapComment),
});

export const submissionActivityApi = {
  /** filter: 0 All (omitted), 1 Decisions, 2 Comments */
  activities: async (
    sectionGradeSubmissionId: string,
    filter: number,
    pageNumber: number,
    pageSize = 20
  ): Promise<PagedResult<Activity>> => {
    const res = await initializeApi().get(`/api/SubmissionActivity/${sectionGradeSubmissionId}/activities`, {
      params: { pageNumber, pageSize, filter: filter || undefined },
    });
    return toPaged(unwrap<any>(res.data), mapActivity, pageNumber, pageSize);
  },

  comments: async (sectionGradeSubmissionId: string, classRecordSubmissionId?: string): Promise<CommentThread[]> => {
    const res = await initializeApi().get(`/api/SubmissionActivity/${sectionGradeSubmissionId}/comments`, {
      params: { classRecordSubmissionId: classRecordSubmissionId || undefined },
    });
    return peelList(res.data).map(mapComment);
  },

  postComment: async (
    sectionGradeSubmissionId: string,
    input: { body: string; classRecordSubmissionId?: string; parentCommentId?: string; replyToProfileId?: string }
  ): Promise<void> => {
    await initializeApi().post(`/api/SubmissionActivity/${sectionGradeSubmissionId}/comments`, input);
  },

  editComment: async (sectionGradeSubmissionId: string, commentId: string, body: string): Promise<void> => {
    await initializeApi().put(`/api/SubmissionActivity/${sectionGradeSubmissionId}/comments/${commentId}`, { body });
  },

  deleteComment: async (sectionGradeSubmissionId: string, commentId: string): Promise<void> => {
    await initializeApi().delete(`/api/SubmissionActivity/${sectionGradeSubmissionId}/comments/${commentId}`);
  },
};
