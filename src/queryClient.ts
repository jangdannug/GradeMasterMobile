import { QueryClient } from '@tanstack/react-query';

// Shared so the stores can drop every cached response when the session or the school changes
export const queryClient = new QueryClient();
