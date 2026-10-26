import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';

let api: AxiosInstance | null = null;

// Called when the API rejects the stored session (expired or revoked token); authStore signs the user out
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

// Keys written by authStore on login
const ACCESS_TOKEN_KEY = 'gm_user';
const SCHOOL_KEY = 'gm_auth_school';

/**
 * Centralized Axios instance for the GradeMaster API.
 * Base URL is host only (endpoints include /api); override with EXPO_PUBLIC_API_URL.
 * The stored access token and school id are attached to every request.
 */
export const initializeApi = () => {
  if (api) return api;

  api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5185',
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });

  api.interceptors.request.use(async (config) => {
    if (!config.headers.Authorization) {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    if (!config.headers['x-school-id']) {
      const schoolId = await SecureStore.getItemAsync(SCHOOL_KEY);
      if (schoolId) config.headers['x-school-id'] = schoolId;
    }
    return config;
  });

  api.interceptors.response.use(undefined, (error) => {
    // Auth calls (login, change password, logout) report their own 401s
    if (error?.response?.status === 401 && !String(error.config?.url ?? '').includes('/api/Auth/')) onUnauthorized?.();
    return Promise.reject(error);
  });

  return api;
};

interface ApiError {
  code?: string;
  message?: string | null;
  details?: string | null;
}

/** Pulls the most specific message out of the backend's errors[] envelope. */
export const apiErrorMessage = (error: any, fallback = 'Something went wrong. Please try again.') => {
  const first: ApiError | undefined = error?.response?.data?.errors?.[0];
  if (first?.details || first?.message) return (first.details || first.message) as string;
  // ASP.NET model-validation errors: { errors: { field: ["message", ...] } }
  const fields = error?.response?.data?.errors;
  if (fields && !Array.isArray(fields) && typeof fields === 'object') {
    const message = Object.values(fields).flat()[0];
    if (typeof message === 'string') return message;
  }
  if (error?.response) return fallback;
  return error?.message || fallback;
};

/** Unwraps `{ data, success, errors }`; the create-subject endpoint wraps it twice. */
export const unwrap = <T>(body: any): T => {
  let data = body?.data;
  while (data && typeof data === 'object' && 'success' in data && 'data' in data) data = data.data;
  return data as T;
};

/**
 * Some endpoints double-wrap their payload ({ data: { data: {...} } }). Peels `data` until the
 * object carries `key` (e.g. the id you need); returns null when it never does.
 */
export const peel = <T = any>(body: any, key: string): T | null => {
  let node = body;
  for (let i = 0; i < 5 && node && typeof node === 'object'; i++) {
    if (key in node) return node as T;
    node = node.data;
  }
  return null;
};

/** List endpoints may answer with an array or an object wrapping it: pick the array out. */
export const asList = <T = any>(data: any, keys: string[] = []): T[] => {
  if (Array.isArray(data)) return data;
  for (const key of ['items', ...keys]) if (Array.isArray(data?.[key])) return data[key];
  return [];
};

/** A page of results, as returned by the `/paged` endpoints */
export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
}

/** Normalizes a `/paged` response (a page envelope, or a bare array) into a PagedResult */
export const toPaged = <Raw, T>(data: any, map: (raw: Raw) => T, pageNumber = 1, pageSize = 50): PagedResult<T> => {
  if (Array.isArray(data)) {
    const items = data.map(map);
    return { items, pageNumber, pageSize, totalCount: items.length, totalPages: 1, hasNextPage: false };
  }
  const items = asList<Raw>(data).map(map);
  return {
    items,
    pageNumber: data?.pageNumber ?? pageNumber,
    pageSize: data?.pageSize ?? pageSize,
    totalCount: data?.totalCount ?? items.length,
    totalPages: data?.totalPages ?? 1,
    hasNextPage: !!data?.hasNextPage,
  };
};

/** Digs through up to 4 `data` layers for an array (the offering endpoints are double-wrapped) */
export const peelList = <T = any>(body: any): T[] => {
  let node = body;
  for (let i = 0; i < 5 && node != null; i++) {
    if (Array.isArray(node)) return node;
    node = node?.data;
  }
  return [];
};
