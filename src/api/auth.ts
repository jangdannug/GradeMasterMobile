import { initializeApi, unwrap } from '../api';

export interface RotatedTokens {
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  /**
   * POST /api/Auth/change-password with the current session's token (attached by the interceptor).
   * The backend may answer with a fresh token pair; null when it does not.
   */
  changePassword: async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<RotatedTokens | null> => {
    const res = await initializeApi().post('/api/Auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    const data = unwrap<any>(res.data);
    return data?.accessToken ? { accessToken: data.accessToken, refreshToken: data.refreshToken ?? '' } : null;
  },
};
