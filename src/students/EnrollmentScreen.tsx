import React from 'react';
import { View } from 'react-native';
import { useDashboardTheme } from '../dashboard/theme';
import EnrollmentTab from './EnrollmentTab';

/** "Student > Enrollment" (school head / admin) */
export default function EnrollmentScreen() {
  const t = useDashboardTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <EnrollmentTab />
    </View>
  );
}
