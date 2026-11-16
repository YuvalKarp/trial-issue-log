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

export function useCreateIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (issue) => request('/api/issues', { method: 'POST', body: issue }),
    // After a successful create, refetch the list so the new issue appears.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ISSUES_KEY }),
  });
}
