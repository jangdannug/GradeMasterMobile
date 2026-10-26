import * as SecureStore from 'expo-secure-store';

// Persist storage for zustand stores; SecureStore can throw (locked keychain, cleared data), so a failure just means "nothing stored"
export const secureStorage = {
  getItem: async (name: string) => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // Storage unavailable: the value still holds for this session
    }
  },
  removeItem: async (name: string) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // Nothing to remove
    }
  },
};
