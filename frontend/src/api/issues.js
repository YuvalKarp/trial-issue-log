import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from './client.js';

// Every query about issues starts with this key, so one invalidation refreshes them all.
const ISSUES_KEY = ['issues'];

// `filters` is { search, status, severity }; an empty string means "no filter" and is not sent.
export function useIssues(filters = {}) {
  const active = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const queryString = new URLSearchParams(active).toString();

  return useQuery({
    // The filters are part of the key, so each combination is fetched and cached separately.
    queryKey: [...ISSUES_KEY, active],
    queryFn: () => request(queryString ? `/api/issues?${queryString}` : '/api/issues'),
    // While a new combination loads, keep showing the previous results instead of a blank table.
    placeholderData: keepPreviousData,
  });
}

// Counts for the dashboard. The key starts with 'issues' too, so creating, editing or
// deleting an issue refreshes the counts along with the list.
export function useIssueStats() {
  return useQuery({
    queryKey: [...ISSUES_KEY, 'stats'],
    queryFn: () => request('/api/issues/stats'),
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
