import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/authStore';

import AuthScreen from '../screens/onboarding/AuthScreen';
import DrawerNavigator from './DrawerNavigator';

const AppNavigator = () => {
  const { isLoading, isLoggedIn } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
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
    backgroundColor: '#fff',
  },
});

export default AppNavigator;
