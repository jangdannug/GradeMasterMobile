import { useColorScheme } from 'react-native';

// Values follow GradeMasterFrontend/client/global.css (light :root and .dark tokens)
const light = {
  isDark: false,
  background: '#F5F7FA',
  card: '#FFFFFF',
  foreground: '#1E293B',
  muted: '#64748B',
  border: '#DCE3EC',
  primary: '#1E3A5F',
  primaryTint: '#E7EDF5',
  success: '#0F766E',
  successTint: '#E6F7F4',
  warning: '#B7791F',
  warningTint: '#FFF6DB',
  destructive: '#B91C1C',
  destructiveTint: '#FDECEC',
  secondaryTint: '#EEF1F5',
  chartTeachers: '#10b981',
};

const dark: typeof light = {
  isDark: true,
  background: '#0B1220',
  card: '#111827',
  foreground: '#F1F5F9',
  muted: '#94A3B8',
  border: '#1F2A3D',
  primary: '#3B82F6',
  primaryTint: '#16233B',
  success: '#3BB273',
  successTint: '#12281F',
  warning: '#E8890C',
  warningTint: '#2B2010',
  destructive: '#EF4444',
  destructiveTint: '#2E1517',
  secondaryTint: '#1B2536',
  chartTeachers: '#10b981',
};

export type DashboardTheme = typeof light;

export const useDashboardTheme = (): DashboardTheme => (useColorScheme() === 'dark' ? dark : light);
