import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export interface SchoolForm {
  code: string;
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}

// Every form is a "Coming soon" placeholder on the web too; only SF1 has a description there
export const SCHOOL_FORMS: SchoolForm[] = [
  {
    code: 'SF1',
    title: 'Enrollment & Attendance',
    description: 'The Learner Enrollment and Attendance form tracks class rolls, enrollment counts, and daily attendance.',
    icon: 'people-outline',
  },
  { code: 'SF2', title: 'Daily Attendance', description: 'Daily attendance record of learners for each class.', icon: 'calendar-outline' },
  { code: 'SF3', title: 'Books Issued & Returned', description: 'Record of books issued to and returned by learners.', icon: 'book-outline' },
  { code: 'SF4', title: 'Monthly Learner Movement', description: 'Monthly record of learner movement, such as transfers and dropouts.', icon: 'swap-horizontal-outline' },
  { code: 'SF5', title: 'Report on Promotion', description: 'Promotion report of learners for each class.', icon: 'trending-up-outline' },
  { code: 'SF6', title: 'Summary Report on Promotion', description: 'School-wide summary of promotion results.', icon: 'stats-chart-outline' },
  { code: 'SF7', title: 'Personnel Assignment', description: 'Assignment list of school personnel.', icon: 'id-card-outline' },
  { code: 'SF8', title: 'Health Profile', description: 'Health profile and nutritional status of learners.', icon: 'heart-outline' },
  { code: 'SF9', title: 'Report Card', description: 'Report card of learners with their grades and progress.', icon: 'ribbon-outline' },
  { code: 'SF10', title: 'Permanent Record', description: "Permanent academic record of a learner.", icon: 'archive-outline' },
];

export const findForm = (code: string | undefined) => SCHOOL_FORMS.find((f) => f.code === code);
