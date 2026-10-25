// Static mock data, copied from GradeMasterFrontend/client/features/dashboard/lib/dashboard-data.ts.
// Replace the source in useDashboardData.ts once the backend exposes dashboard endpoints.

export type StatIcon = 'users' | 'teachers' | 'sections' | 'trending-up';
export type SubmissionStatus = 'Posted' | 'Pending' | 'Draft';

export interface DashboardStat {
  title: string;
  value: string;
  change: string;
  changeType: 'increase' | 'decrease';
  icon: StatIcon;
}

export interface EnrollmentPoint {
  month: string;
  students: number;
  teachers: number;
}

export interface GradeLevelPoint {
  grade: string;
  average: number;
  students: number;
}

export interface SubjectScore {
  name: string;
  value: number;
  color: string;
}

export interface TopStudent {
  id: string;
  name: string;
  grade: string;
  section: string;
  average: number;
  rank: number;
}

export interface Submission {
  id: string;
  student: string;
  subject: string;
  grade: string;
  status: SubmissionStatus;
  date: string;
}

export interface DashboardData {
  stats: DashboardStat[];
  enrollmentTrend: EnrollmentPoint[];
  gradeDistribution: GradeLevelPoint[];
  subjectPerformance: SubjectScore[];
  topStudents: TopStudent[];
  recentSubmissions: Submission[];
}

export const dashboardStats: DashboardStat[] = [
  { title: 'Enrolled Students', value: '12,847', change: '+8.2%', changeType: 'increase', icon: 'users' },
  { title: 'Active Teachers', value: '486', change: '+3.1%', changeType: 'increase', icon: 'teachers' },
  { title: 'Grade Sections', value: '64', change: '+4.5%', changeType: 'increase', icon: 'sections' },
  { title: 'Passing Rate', value: '94.2%', change: '+2.3%', changeType: 'increase', icon: 'trending-up' },
];

export const enrollmentTrend: EnrollmentPoint[] = [
  { month: 'Aug', students: 11840, teachers: 452 },
  { month: 'Sep', students: 12020, teachers: 458 },
  { month: 'Oct', students: 12150, teachers: 463 },
  { month: 'Nov', students: 12280, teachers: 468 },
  { month: 'Dec', students: 12350, teachers: 472 },
  { month: 'Jan', students: 12510, teachers: 478 },
  { month: 'Feb', students: 12847, teachers: 486 },
];

export const gradeDistribution: GradeLevelPoint[] = [
  { grade: 'Grade 1', average: 85.3, students: 1240 },
  { grade: 'Grade 2', average: 83.7, students: 1180 },
  { grade: 'Grade 3', average: 86.1, students: 1210 },
  { grade: 'Grade 4', average: 82.4, students: 1150 },
  { grade: 'Grade 5', average: 84.8, students: 1190 },
  { grade: 'Grade 6', average: 87.2, students: 1230 },
  { grade: 'Grade 7', average: 81.9, students: 1080 },
  { grade: 'Grade 8', average: 83.5, students: 1050 },
  { grade: 'Grade 9', average: 82.1, students: 1020 },
  { grade: 'Grade 10', average: 85.6, students: 990 },
  { grade: 'Grade 11', average: 86.4, students: 860 },
  { grade: 'Grade 12', average: 88.9, students: 787 },
];

export const subjectPerformance: SubjectScore[] = [
  { name: 'Mathematics', value: 82.4, color: '#3b82f6' },
  { name: 'Science', value: 84.7, color: '#60a5fa' },
  { name: 'English', value: 86.1, color: '#8b5cf6' },
  { name: 'Filipino', value: 88.3, color: '#a78bfa' },
  { name: 'MAPEH', value: 91.5, color: '#f59e0b' },
  { name: 'Araling Panlipunan', value: 85.9, color: '#10b981' },
];

export const topStudents: TopStudent[] = [
  { id: '1', name: 'Maria Santos', grade: 'Grade 6', section: 'Rizal', average: 97.8, rank: 1 },
  { id: '2', name: 'Jose Cruz', grade: 'Grade 12', section: 'Aguinaldo', average: 97.2, rank: 2 },
  { id: '3', name: 'Ana Gonzales', grade: 'Grade 10', section: 'Bonifacio', average: 96.5, rank: 3 },
  { id: '4', name: 'Carlos Reyes', grade: 'Grade 6', section: 'Rizal', average: 96.1, rank: 4 },
  { id: '5', name: 'Sofia Villanueva', grade: 'Grade 11', section: 'Mabini', average: 95.7, rank: 5 },
];

export const recentSubmissions: Submission[] = [
  { id: 'SUB-001', student: 'Maria Santos', subject: 'Mathematics', grade: '98', status: 'Posted', date: 'Today' },
  { id: 'SUB-002', student: 'Juan Dela Cruz', subject: 'Science', grade: '87', status: 'Pending', date: 'Yesterday' },
  { id: 'SUB-003', student: 'Luisa Garcia', subject: 'English', grade: '92', status: 'Posted', date: '2 days ago' },
  { id: 'SUB-004', student: 'Pedro Reyes', subject: 'Filipino', grade: '79', status: 'Draft', date: '3 days ago' },
  { id: 'SUB-005', student: 'Elena Bautista', subject: 'Araling Panlipunan', grade: '94', status: 'Posted', date: '3 days ago' },
];

export const mockDashboardData: DashboardData = {
  stats: dashboardStats,
  enrollmentTrend,
  gradeDistribution,
  subjectPerformance,
  topStudents,
  recentSubmissions,
};
