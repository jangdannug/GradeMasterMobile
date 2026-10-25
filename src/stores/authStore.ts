import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { apiErrorMessage, initializeApi } from '../api';
import { authApi } from '../api/auth';

type UserRole = 'Teacher' | 'SchoolHead' | 'Admin' | '';

const STORAGE_KEYS = {
  USER: 'gm_user',
  REFRESH_TOKEN: 'gm_refresh_token',
  AUTH_SCHOOL: 'gm_auth_school',
  THEME: 'gm_theme',
};

interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  schoolId: string | null;
  schoolName: string | null;
}

interface AuthState {
  user: User | null;
  refreshToken: string | null;
  authSchool: string | null;
  // null = follow the system appearance until the user picks one
  theme: 'light' | 'dark' | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  // Set while the backend requires a password change before issuing an access token
  passwordChangeToken: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  loginWithToken: (token: string, refreshToken: string, user: User, authSchool: string) => void;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  changePasswordInSession: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  cancelPasswordChange: () => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | null) => void;
  clearAuth: () => void;
}
// Dev/test sign-in, same as the web "Demo Account": exchanges the built-in test key
// for a token bound to the seeded school user (POST /api/Auth/jwt, raw JWT, no refresh token)
const DEMO_LOGIN = {
  testApiKey: 'gmaster01',
  userId: '03131c42-9b7d-49f1-a13b-019f849b16e6',
  districtId: 'dac08746-30c3-4ef3-86e1-019f849b1b12',
  schoolId: 'cb56d78e-b8c7-47c3-b145-019f849b1b13',
};
const DEMO_EMAIL = 'demo@example.com';

const SCHOOL_ID = process.env.EXPO_PUBLIC_SCHOOL_ID || 'cb56d78e-b8c7-47c3-b145-019f849b1b13';

interface JwtPayload {
  sub?: string;
  name?: string;
  email?: string;
  exp?: number;
  [key: string]: unknown;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const normalized = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

// The token only carries a role claim for super admins; everyone else is treated as a teacher
function userFromToken(token: string, fallbackEmail: string): User {
  const payload = decodeJwtPayload(token);
  const email = typeof payload?.email === 'string' ? payload.email : fallbackEmail;
  const roleClaim = Object.entries(payload ?? {}).find(([key]) => key === 'role' || key.endsWith('/role'))?.[1];
  const isSuperAdmin = [roleClaim].flat().some((r) => String(r).toUpperCase() === 'SUPERADMIN');
  return {
    id: payload?.sub ?? '',
    email,
    name: typeof payload?.name === 'string' ? payload.name : email.split('@')[0] || null,
    role: isSuperAdmin ? 'Admin' : 'Teacher',
    schoolId: SCHOOL_ID,
    schoolName: null,
  };
}

const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      refreshToken: null,
      authSchool: null,
      theme: null,
      isLoggedIn: false,
      isLoading: true,
      passwordChangeToken: null,
      
      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const api = initializeApi();
          const response = await api.post(
            '/api/Auth/login',
            { email, password },
            { headers: { 'x-school-id': SCHOOL_ID } }
          );

          // Bad credentials come back as 401 with errors[], or with data.accessToken missing
          const body = response.data;
          const data = body?.data;
          if (!data?.accessToken) {
            if (data?.requiresPasswordChange && data.passwordChangeToken) {
              set({ passwordChangeToken: data.passwordChangeToken });
              return;
            }
            throw new Error(body?.errors?.[0]?.message || 'Login failed. Please check your credentials.');
          }

          const { accessToken, refreshToken: rt } = data;
          await SecureStore.setItemAsync(STORAGE_KEYS.USER, accessToken);
          await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, rt ?? '');
          await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_SCHOOL, SCHOOL_ID);

          set({
            user: userFromToken(accessToken, email),
            refreshToken: rt,
            authSchool: SCHOOL_ID,
            isLoggedIn: true,
            isLoading: false,
          });
        } catch (error: any) {
          throw new Error(apiErrorMessage(error, 'Login failed. Please check your credentials.'));
        } finally {
          set({ isLoading: false });
        }
      },
      
      loginAsDemo: async () => {
        set({ isLoading: true });
        try {
          const response = await initializeApi().post('/api/Auth/jwt', DEMO_LOGIN, {
            responseType: 'text',
            transformResponse: [(data) => data],
          });
          const token = typeof response.data === 'string' ? response.data.trim() : '';
          if (!token.includes('.')) throw new Error('Demo sign-in failed');

          await SecureStore.setItemAsync(STORAGE_KEYS.USER, token);
          await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, '');
          await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_SCHOOL, DEMO_LOGIN.schoolId);

          set({
            user: { ...userFromToken(token, DEMO_EMAIL), name: 'Demo Account', role: 'Admin' },
            refreshToken: null,
            authSchool: DEMO_LOGIN.schoolId,
            isLoggedIn: true,
          });
        } catch (error: any) {
          throw new Error(apiErrorMessage(error, 'Demo sign-in failed. Is the backend running?'));
        } finally {
          set({ isLoading: false });
        }
      },

      changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string) => {
        const passwordChangeToken = get().passwordChangeToken;
        if (!passwordChangeToken) throw new Error('Your session expired. Please sign in again.');
        set({ isLoading: true });
        try {
          const response = await initializeApi().post(
            '/api/Auth/change-password',
            { currentPassword, newPassword, confirmPassword },
            { headers: { Authorization: `Bearer ${passwordChangeToken}`, 'x-school-id': SCHOOL_ID } }
          );
          const data = response.data?.data;
          if (!data?.accessToken) throw new Error('Password change failed. Please try again.');

          await SecureStore.setItemAsync(STORAGE_KEYS.USER, data.accessToken);
          await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken ?? '');
          await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_SCHOOL, SCHOOL_ID);

          set({
            user: userFromToken(data.accessToken, ''),
            refreshToken: data.refreshToken,
            authSchool: SCHOOL_ID,
            passwordChangeToken: null,
            isLoggedIn: true,
          });
        } catch (error: any) {
          throw new Error(apiErrorMessage(error, 'Password change failed. Please try again.'));
        } finally {
          set({ isLoading: false });
        }
      },

      // Voluntary change while signed in: the same endpoint, called with the current access token.
      // The user and login state stay as they are; rotated tokens, when returned, replace the stored ones.
      changePasswordInSession: async (currentPassword: string, newPassword: string, confirmPassword: string) => {
        const tokens = await authApi.changePassword(currentPassword, newPassword, confirmPassword);
        if (!tokens) return;
        await SecureStore.setItemAsync(STORAGE_KEYS.USER, tokens.accessToken);
        if (tokens.refreshToken) {
          await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
          set({ refreshToken: tokens.refreshToken });
        }
      },

      cancelPasswordChange: () => set({ passwordChangeToken: null }),

      loginWithToken: (token: string, refreshToken: string, user: User, authSchool: string) => {
        SecureStore.setItemAsync(STORAGE_KEYS.USER, token);
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        if (authSchool) {
          SecureStore.setItemAsync(STORAGE_KEYS.AUTH_SCHOOL, authSchool);
        }
        
        const userData: User = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          schoolId: user.schoolId,
          schoolName: user.schoolName,
        };
        
        set({
          user: userData,
          refreshToken,
          authSchool,
          isLoggedIn: true,
          isLoading: false,
        });
      },
      
      logout: async () => {
        try {
          const { refreshToken } = get();
          const token = await SecureStore.getItemAsync(STORAGE_KEYS.USER);
          if (refreshToken && token) {
            const api = initializeApi();
            await api.post('/api/Auth/logout', { refreshToken }, { headers: { Authorization: `Bearer ${token}` } });
          }
        } catch (error) {
          // Ignore logout errors
        }
        
        await SecureStore.deleteItemAsync(STORAGE_KEYS.USER);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_SCHOOL);
        
        set({
          user: null,
          refreshToken: null,
          authSchool: null,
          isLoggedIn: false,
          isLoading: false,
        });
      },
      
      restoreSession: async () => {
        set({ isLoading: true });
        try {
          const [token, refreshToken, authSchool] = await Promise.all([
            SecureStore.getItemAsync(STORAGE_KEYS.USER),
            SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
            SecureStore.getItemAsync(STORAGE_KEYS.AUTH_SCHOOL),
          ]);
          
          const exp = token ? decodeJwtPayload(token)?.exp : undefined;
          if (token && (!exp || exp * 1000 > Date.now())) {
            const restored = userFromToken(token, '');
            // Demo sessions are the only ones without a refresh token
            if (!refreshToken) Object.assign(restored, { name: 'Demo Account', email: DEMO_EMAIL, role: 'Admin' });
            get().loginWithToken(token, refreshToken || '', restored, authSchool || '');
          }
        } catch (error) {
          console.error('Failed to restore session:', error);
        } finally {
          set({ isLoading: false });
        }
      },
      
      setTheme: (theme: 'light' | 'dark' | null) => {
        set({ theme });
      },
      
      clearAuth: () => {
        set({
          user: null,
          refreshToken: null,
          authSchool: null,
          isLoggedIn: false,
          isLoading: false,
        });
      },
    }),
    {
      name: 'grademaster-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        theme: state.theme,
      })
    }
  )
);
