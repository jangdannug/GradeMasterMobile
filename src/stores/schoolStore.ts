import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { schoolsApi, type SelectedSchool } from '../api/schools';
import { queryClient } from '../queryClient';
import { secureStorage } from './secureStorage';

interface SchoolState {
  school: SelectedSchool | null;
  // False until the persisted selection has been read, so the code screen does not flash on launch
  hydrated: boolean;

  /** Validates the code with the API, then saves the school (replacing, and clearing the data of, any other) */
  selectSchool: (code: string) => Promise<SelectedSchool>;
  /** Saves a school without a lookup (the dev-only demo login) */
  setSchool: (school: SelectedSchool) => void;
  clearSchool: () => void;
}

export const useSchoolStore = create<SchoolState>()(
  persist(
    (set, get) => ({
      school: null,
      hydrated: false,

      selectSchool: async (code: string) => {
        const school = await schoolsApi.getByCode(code);
        get().setSchool(school);
        return school;
      },

      setSchool: (school: SelectedSchool) => {
        // One school's cached data must never show for another
        if (get().school?.schoolId !== school.schoolId) queryClient.clear();
        set({ school });
      },

      clearSchool: () => {
        queryClient.clear();
        set({ school: null });
      },
    }),
    {
      name: 'gm_school_selection',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ school: state.school }),
      onRehydrateStorage: () => () => {
        useSchoolStore.setState({ hydrated: true });
      },
    }
  )
);

/** Resolves once the persisted selection has been read (immediately if it already was) */
export const whenSchoolHydrated = () =>
  new Promise<void>((resolve) => {
    if (useSchoolStore.getState().hydrated) return resolve();
    const unsubscribe = useSchoolStore.subscribe((state) => {
      if (!state.hydrated) return;
      unsubscribe();
      resolve();
    });
  });
