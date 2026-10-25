import React, { createContext, useContext } from 'react';
import { SetupSchoolYear } from '../api/schoolYears';
import { AcademicSetupData, useAcademicSetupData } from './useAcademicSetupData';

export interface AcademicSetupContextValue extends AcademicSetupData {
  schoolYear: SetupSchoolYear;
  /** Only an unlocked draft school year can be changed */
  isReadOnly: boolean;
}

const AcademicSetupContext = createContext<AcademicSetupContextValue | null>(null);

export function AcademicSetupProvider({
  schoolYear,
  children,
}: {
  schoolYear: SetupSchoolYear;
  children: React.ReactNode;
}) {
  // Composed once here; the stepper and every step read it from context
  const data = useAcademicSetupData(schoolYear.id);
  const isReadOnly = !schoolYear.isDraft || schoolYear.isLocked;
  return (
    <AcademicSetupContext.Provider value={{ ...data, schoolYear, isReadOnly }}>
      {children}
    </AcademicSetupContext.Provider>
  );
}

export function useAcademicSetup(): AcademicSetupContextValue {
  const value = useContext(AcademicSetupContext);
  if (!value) throw new Error('useAcademicSetup must be used inside AcademicSetupProvider');
  return value;
}
