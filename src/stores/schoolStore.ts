import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { schoolsApi, type SelectedSchool } from '../api/schools';
import { queryClient } from '../queryClient';
import { secureStorage } from './secureStorage';

interface SchoolState {
  school: SelectedSchool | null;
  // The school set aside by "Change school", so the code screen can cancel back to it
  previousSchool: SelectedSchool | null;
  // False until the persisted selection has been read, so the code screen does not flash on launch
  hydrated: boolean;

  /** Validates the code with the API, then saves the school (replacing, and clearing the data of, any other) */
  selectSchool: (code: string) => Promise<SelectedSchool>;
  /** Saves a school without a lookup (the dev-only demo login) */
  setSchool: (school: SelectedSchool) => void;
  /** Returns to the code screen, keeping the current school to cancel back to */
  changeSchool: () => void;
  cancelChangeSchool: () => void;
}

export const useSchoolStore = create<SchoolState>()(
  persist(
    (set, get) => ({
      school: null,
      previousSchool: null,
      hydrated: false,

      selectSchool: async (code: string) => {
        const school = await schoolsApi.getByCode(code);
        get().setSchool(school);
        return school;
      },

      setSchool: (school: SelectedSchool) => {
        // One school's cached data must never show for another
        const current = get().school ?? get().previousSchool;
        if (current?.schoolId !== school.schoolId) queryClient.clear();
        set({ school, previousSchool: null });
      },

      changeSchool: () => {
        const { school } = get();
        if (school) set({ school: null, previousSchool: school });
      },

      cancelChangeSchool: () => {
        const { previousSchool } = get();
        if (previousSchool) set({ school: previousSchool, previousSchool: null });
      },
    }),
    {
      name: 'gm_school_selection',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ school: state.school, previousSchool: state.previousSchool }),
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
