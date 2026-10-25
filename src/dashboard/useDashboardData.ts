import { useQuery } from '@tanstack/react-query';
import { DashboardData, mockDashboardData } from './dashboard-data';

// Swap this function's body for backend calls later; the screen only depends on DashboardData.
const fetchDashboardData = (): Promise<DashboardData> =>
  new Promise((resolve) => setTimeout(() => resolve(mockDashboardData), 400));

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
  });
}
