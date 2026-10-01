import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { ApiSuccess } from "./client";

type Params = Record<string, string | number | boolean | undefined | null>;

const clean = (params?: Params) =>
  params ? Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")) : undefined;

/** GET an admin resource; keeps the previous page on screen while paging. */
export function useApi<T>(key: QueryKey, path: string, params?: Params, options: { refetchInterval?: number; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...key, clean(params) ?? {}],
    queryFn: async () => (await apiClient.get<ApiSuccess<T>>(path, { params: clean(params) })).data.data,
    placeholderData: keepPreviousData,
    refetchInterval: options.refetchInterval,
    enabled: options.enabled,
  });
}

/** A write that refreshes the given query families (and the dashboard) on success. */
export function useApiMutation<TVariables, TResult = unknown>(
  request: (variables: TVariables) => Promise<{ data: ApiSuccess<TResult> }>,
  invalidate: QueryKey[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => (await request(variables)).data.data,
    onSuccess: () =>
      Promise.all(
        [...invalidate, ["admin", "dashboard"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
}

export { apiClient };
