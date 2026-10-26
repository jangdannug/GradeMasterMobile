import * as SecureStore from 'expo-secure-store';
import { normalizeTheme, type ThemeId } from './themes';

// SecureStore keys only allow letters, digits, ".", "-" and "_", so the web's "gm_theme:<id>" becomes "gm_theme_<id>"
export const userThemeKey = (userId: string) => `gm_theme_${userId}`;

/** The theme this user picked on this device, or null if they never picked one. */
export async function readUserTheme(userId: string): Promise<ThemeId | null> {
  try {
    const stored = await SecureStore.getItemAsync(userThemeKey(userId));
    return stored ? normalizeTheme(stored) : null;
  } catch {
    return null;
  }
}

export async function saveUserTheme(userId: string, theme: ThemeId) {
  try {
    await SecureStore.setItemAsync(userThemeKey(userId), theme);
  } catch {
    // Storage unavailable: the theme still applies for this session
  }
}
