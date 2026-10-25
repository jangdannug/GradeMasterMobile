import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { districtsApi } from '../api/districts';
import { gradingPeriodsApi } from '../api/gradingPeriods';
import { schoolsApi } from '../api/schools';
import { setupSchoolYearsApi } from '../api/schoolYears';

export const setupKeys = {
  districts: ['districts'] as const,
  schools: ['schools'] as const,
  schoolYears: ['school-years'] as const,
  gradingPeriods: (schoolYearId: string) => ['grading-periods', schoolYearId] as const,
};

export const useDistricts = () => useQuery({ queryKey: setupKeys.districts, queryFn: districtsApi.list });

export const useSchools = () => useQuery({ queryKey: setupKeys.schools, queryFn: schoolsApi.list });

export const useSchoolYears = () => useQuery({ queryKey: setupKeys.schoolYears, queryFn: setupSchoolYearsApi.list });

export const useGradingPeriods = (schoolYearId: string, enabled: boolean) =>
  useQuery({
    queryKey: setupKeys.gradingPeriods(schoolYearId),
    queryFn: () => gradingPeriodsApi.listBySchoolYear(schoolYearId),
    enabled,
  });

/** Pull-to-refresh state for a query's refetch */
export function useRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, onRefresh };
}
