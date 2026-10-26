import { useAuthStore } from '../stores/authStore';
import { THEME_TOKENS, type ThemeTokens } from '../theme/themes';

export type DashboardTheme = ThemeTokens;

export const useDashboardTheme = (): DashboardTheme => THEME_TOKENS[useAuthStore((state) => state.theme)];
