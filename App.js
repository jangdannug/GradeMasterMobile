import React, { useEffect } from 'react';
import { Appearance, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/stores/authStore';

// Raised by react-native-gesture-handler's drawer/swipeable passing deps to Reanimated hooks; harmless on native
LogBox.ignoreLogs(['[Reanimated] Dependencies should only be used on the web']);

const queryClient = new QueryClient();

export default function App() {
  const restoreSession = useAuthStore((state) => state.restoreSession);

  const theme = useAuthStore((state) => state.theme);

  // Native chrome (keyboard, pickers, alerts) follows the chosen theme
  useEffect(() => {
    Appearance.setColorScheme(theme === 'dark' ? 'dark' : 'light');
  }, [theme]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
