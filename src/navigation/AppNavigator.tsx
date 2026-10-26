import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDashboardTheme } from '../dashboard/theme';
import { useAuthStore } from '../stores/authStore';

import AuthScreen from '../screens/onboarding/AuthScreen';
import DrawerNavigator from './DrawerNavigator';

const AppNavigator = () => {
  const { isLoading, isLoggedIn } = useAuthStore();
  const t = useDashboardTheme();

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <Text style={{ color: t.foreground }}>Loading...</Text>
      </View>
    );
  }

  // Logged in: one drawer, filtered by the user's role (see menu.ts)
  if (isLoggedIn) return <DrawerNavigator />;

  // Show auth screen if not logged in
  return <AuthScreen />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AppNavigator;
