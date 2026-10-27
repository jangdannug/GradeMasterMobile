import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import AnswerSheetScanScreen from '../answer-sheet/AnswerSheetScanScreen';
import AcademicSetupScreen from '../academic-setup/AcademicSetupScreen';
import FinalGradesScreen from '../class-record/FinalGradesScreen';
import GradingSheetScreen from '../class-record/GradingSheetScreen';
import DashboardScreen from '../dashboard/DashboardScreen';
import { useDashboardTheme } from '../dashboard/theme';
import SchoolSetupScreen from '../school-setup/SchoolSetupScreen';
import FormPlaceholderScreen from '../school-forms/FormPlaceholderScreen';
import { SCHOOL_FORMS } from '../school-forms/forms';
import SettingsScreen from '../settings/SettingsScreen';
import UserManagementScreen from '../settings/UserManagementScreen';
import EnrollmentScreen from '../students/EnrollmentScreen';
import StudentsScreen from '../students/StudentsScreen';
import SubmittedScoresScreen from '../submitted-scores/SubmittedScoresScreen';
import TeacherAssignmentScreen from '../teacher-assignment/TeacherAssignmentScreen';
import { useAuthStore } from '../stores/authStore';
import DrawerContent from './DrawerContent';
import { INITIAL_ROUTE, menuLabel, routesFor, toMenuRole } from './menu';
import ScreenHeader from './ScreenHeader';

const Drawer = createDrawerNavigator();

// Route id (the web path) -> screen; menu.ts decides which of these a role can reach
const SCREENS: Record<string, React.ComponentType<any>> = {
  dashboard: DashboardScreen,
  'school-setup': SchoolSetupScreen,
  'academic-setup': AcademicSetupScreen,
  'school-year-setup': TeacherAssignmentScreen,
  'students/registration': StudentsScreen,
  'students/enrollment': EnrollmentScreen,
  'students/class-record': GradingSheetScreen,
  'students/class-record/submitted-scores': SubmittedScoresScreen,
  'students/class-record/final-grades': FinalGradesScreen,
  'assessments/answer-sheets': AnswerSheetScanScreen,
  admin: UserManagementScreen,
  settings: SettingsScreen,
  ...Object.fromEntries(SCHOOL_FORMS.map((f) => [`school-forms/${f.code.toLowerCase()}`, FormPlaceholderScreen])),
};

/** The web sidebar as a drawer: one navigator, the menu filtered by the signed-in role */
export default function DrawerNavigator() {
  const t = useDashboardTheme();
  const role = toMenuRole(useAuthStore((s) => s.user?.role));
  const routes = routesFor(role);

  return (
    <Drawer.Navigator
      initialRouteName={INITIAL_ROUTE}
      // The Android back button closes the drawer first, then walks back through the screens visited
      backBehavior="history"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={({ navigation, route }) => ({
        header: () => (
          <ScreenHeader
            title={menuLabel(route.name)}
            onMenu={() => navigation.openDrawer()}
            onProfile={() => navigation.navigate('settings')}
          />
        ),
        drawerStyle: { width: 310, backgroundColor: t.card },
        sceneStyle: { backgroundColor: t.background },
      })}
    >
      {routes.map(({ route }) => {
        const form = SCHOOL_FORMS.find((f) => `school-forms/${f.code.toLowerCase()}` === route);
        return (
          <Drawer.Screen
            key={route}
            name={route}
            component={SCREENS[route]}
            initialParams={form ? { code: form.code } : undefined}
          />
        );
      })}
    </Drawer.Navigator>
  );
}
