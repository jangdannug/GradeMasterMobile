import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDashboardTheme } from '../dashboard/theme';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';

import AuthScreen from '../screens/onboarding/AuthScreen';
import SchoolCodeScreen from '../screens/onboarding/SchoolCodeScreen';
import DrawerNavigator from './DrawerNavigator';

const AppNavigator = () => {
  const { isLoading, isLoggedIn } = useAuthStore();
  const school = useSchoolStore((s) => s.school);
  const schoolReady = useSchoolStore((s) => s.hydrated);
  const t = useDashboardTheme();

  // Wait for the saved school too, so the code screen does not flash before a returning user's login
  if (isLoading || !schoolReady) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <Text style={{ color: t.foreground }}>Loading...</Text>
      </View>
    );
  }

  // Logged in: one drawer, filtered by the user's role (see menu.ts)
  if (isLoggedIn) return <DrawerNavigator />;

  // Logged out: pick a school first, then sign in to it
  if (!school) return <SchoolCodeScreen />;
  return <AuthScreen />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AppNavigator;
