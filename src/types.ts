export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'Teacher' | 'SchoolHead' | 'Admin';
  schoolId: string | null;
  schoolName: string | null;
}

export interface StudentDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  address: string | null;
  profileImage: string | null;
  status: 'Active' | 'Inactive';
  sectionId: string | null;
  currentSchoolYearId: string | null;
}

export interface StudentSummary {
  id: string;
  firstName: string;
  lastName: string;
  currentGrade: string | null;
  sectionName: string | null;
}

export interface PagedResultDto<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  hasNext: boolean;
}

export interface GetStudentsPagedRequest {
  pageNumber: number;
  pageSize: number;
  searchTerm?: string;
  sectionId?: string;
  schoolYearId?: string;
}

export interface SchoolYearDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Closed' | 'Upcoming';
  sectionsCount: number;
  studentsCount: number;
}

export interface CreateSchoolYearRequest {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SectionDto {
  id: string;
  name: string;
  gradeLevel: number;
  adviserId: string | null;
  schoolYearId: string;
  studentCount: number;
}

export interface SubjectDto {
  id: string;
  name: string;
  parentSubjectId: string | null;
  parentSubject: SubjectDto | null;
  children: SubjectDto[];
  orderIndex: number;
  isComposite: boolean;
}

export interface CreateSubjectRequest {
  name: string;
  parentSubjectId?: string;
}

export interface ReorderChildrenRequest {
  childIds: string[];
}

export interface SectionGradeSubmissionDto {
  id: string;
  sectionId: string;
  schoolYearId: string;
  periodId: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  submittedBy: string;
  submittedAt: string | null;
  rejectionComments: string | null;
  quarter: number;
}

export interface SectionReadinessDto {
  sectionId: string;
  periodId: string;
  isReady: boolean;
  subjectsReady: string[];
  subjectsNotReady: string[];
}

export interface AuthResponseDto {
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
  authSchool: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface BulkUploadResultDto {
  successCount: number;
  failedRows: Array<{ row: number; column: number; error: string }>;
  errorSummary: string;
}