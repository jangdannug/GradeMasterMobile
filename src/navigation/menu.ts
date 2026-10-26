import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { SCHOOL_FORMS } from '../school-forms/forms';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type MenuRole = 'Teacher' | 'SchoolHead' | 'Admin';

const STAFF: MenuRole[] = ['SchoolHead', 'Admin'];
const EVERYONE: MenuRole[] = ['Teacher', 'SchoolHead', 'Admin'];

export interface MenuChild {
  id: string;
  label: string;
  icon: IconName;
  /** Stable id matching the web route path; also the drawer route name */
  route: string;
  roles: MenuRole[];
}

export interface MenuItem {
  id: string;
  label: string;
  icon: IconName;
  route?: string;
  children?: MenuChild[];
  roles: MenuRole[];
}

/**
 * The web sidebar's `navItems` (GradeMasterFrontend/client/app/ui/Layout.tsx), in the same order with the
 * same labels. The drawer, the screen titles and the route registration all read from here.
 * `roles` is the visibility matrix: one line per item to change; a group with no visible child is hidden.
 */
export const MENU: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', route: 'dashboard', roles: EVERYONE },
  { id: 'school-setup', label: 'School Setup', icon: 'business', route: 'school-setup', roles: STAFF },
  { id: 'academic-setup', label: 'Academic Setup', icon: 'school', route: 'academic-setup', roles: STAFF },
  { id: 'school-year-setup', label: 'Teacher Assignment', icon: 'calendar', route: 'school-year-setup', roles: STAFF },
  {
    id: 'student',
    label: 'Student',
    icon: 'people',
    roles: EVERYONE,
    children: [
      // Teachers get the same list read-only
      { id: 'students/registration', label: 'Registration', icon: 'person-add', route: 'students/registration', roles: EVERYONE },
      { id: 'students/enrollment', label: 'Enrollment', icon: 'document-text', route: 'students/enrollment', roles: STAFF },
    ],
  },
  {
    id: 'class-record',
    label: 'Class Record',
    icon: 'book',
    roles: EVERYONE,
    children: [
      // Heads may open it too (they will see the empty "no classes" state)
      { id: 'students/class-record', label: 'Grading Sheets', icon: 'book', route: 'students/class-record', roles: EVERYONE },
      { id: 'students/class-record/submitted-scores', label: 'Submitted Scores', icon: 'clipboard', route: 'students/class-record/submitted-scores', roles: STAFF },
      { id: 'students/class-record/final-grades', label: 'Final Grades', icon: 'ribbon', route: 'students/class-record/final-grades', roles: EVERYONE },
      { id: 'students/class-record/answer-sheets', label: 'Scan Answer Sheets', icon: 'scan', route: 'students/class-record/answer-sheets', roles: EVERYONE },
    ],
  },
  {
    id: 'school-forms',
    label: 'School Forms',
    icon: 'clipboard',
    roles: EVERYONE,
    children: SCHOOL_FORMS.map((form) => ({
      id: `school-forms/${form.code.toLowerCase()}`,
      label: `${form.code} - ${form.title}`,
      icon: 'document-text' as IconName,
      route: `school-forms/${form.code.toLowerCase()}`,
      roles: EVERYONE,
    })),
  },
  { id: 'admin', label: 'Administration', icon: 'shield-checkmark', route: 'admin', roles: STAFF },
  { id: 'settings', label: 'Settings', icon: 'settings', route: 'settings', roles: EVERYONE },
];

export const INITIAL_ROUTE = 'dashboard';

/**
 * The web shows every menu item to every signed-in school user and leaves access to the API, so mobile does the
 * same. The token carries no role (only super admins get a claim), so reading one here hid Setup, Teacher Assignment
 * and Administration from school admins, e.g. admin@tnhs.test. The visibility matrix above stays for when the
 * backend exposes real roles.
 */
export const toMenuRole = (role: string | undefined | null): MenuRole => (role ? 'Admin' : 'Teacher');

export interface VisibleItem extends Omit<MenuItem, 'children'> {
  children?: MenuChild[];
}

/** The menu for a role, in web order; groups without a visible child are dropped */
export function visibleMenu(role: MenuRole): VisibleItem[] {
  return MENU.flatMap((item) => {
    if (!item.roles.includes(role)) return [];
    if (!item.children) return [item];
    const children = item.children.filter((c) => c.roles.includes(role));
    return children.length > 0 ? [{ ...item, children }] : [];
  });
}

/** Every navigable route for a role */
export const routesFor = (role: MenuRole): { route: string; label: string }[] =>
  visibleMenu(role).flatMap((item) =>
    item.children
      ? item.children.map((c) => ({ route: c.route, label: c.label }))
      : item.route
        ? [{ route: item.route, label: item.label }]
        : []
  );

/** The page title for a route: the nav label, like the web */
export function menuLabel(route: string): string {
  for (const item of MENU) {
    if (item.route === route) return item.label;
    const child = item.children?.find((c) => c.route === route);
    if (child) return child.label;
  }
  return 'Dashboard';
}
