import React, { useEffect } from 'react';
import { Appearance } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/stores/authStore';

const queryClient = new QueryClient();

export default function App() {
  const restoreSession = useAuthStore((state) => state.restoreSession);

  const theme = useAuthStore((state) => state.theme);

  // The Settings switch drives the whole app's appearance; null follows the system again
  useEffect(() => {
    Appearance.setColorScheme(theme);
  }, [theme]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
