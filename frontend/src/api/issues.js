import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from './client.js';

// Every query about issues starts with this key, so one invalidation refreshes them all.
const ISSUES_KEY = ['issues'];

export function useIssues() {
  return useQuery({
    queryKey: ISSUES_KEY,
    queryFn: () => request('/api/issues'),
  });
}

// A mutation that refetches the issues list after it succeeds, so the UI always shows
// what the server has rather than a local guess.
function useIssueMutation(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ISSUES_KEY }),
  });
}

export function useCreateIssue() {
  return useIssueMutation((issue) => request('/api/issues', { method: 'POST', body: issue }));
}

// Called with { id, ...changes }. Only the changes are sent.
export function useUpdateIssue() {
  return useIssueMutation(({ id, ...changes }) =>
    request(`/api/issues/${id}`, { method: 'PATCH', body: changes }),
  );
}

export function useDeleteIssue() {
  return useIssueMutation((id) => request(`/api/issues/${id}`, { method: 'DELETE' }));
}
