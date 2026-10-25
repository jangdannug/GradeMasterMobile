import { useQuery } from '@tanstack/react-query';
import { LookupKind, lookupsApi } from '../api/lookups';

const A_DAY = 24 * 60 * 60 * 1000;

/** Reference lists (languages, religions, ...) change almost never: cache them for a day */
export const useLookup = (kind: LookupKind) =>
  useQuery({ queryKey: ['lookups', kind], queryFn: lookupsApi[kind], staleTime: A_DAY, gcTime: A_DAY });
