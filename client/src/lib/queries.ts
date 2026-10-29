import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  AnalyticsFilters,
  AnalyticsSummary,
  Application,
  ApplicationDetail,
  Breakdowns,
  CalendarData,
  Dashboard,
  FunnelData,
  Interview,
  MonthlyPoint,
  PageMeta,
  Profile,
  Resume,
  Stage,
} from './types';

export type ApplicationListParams = {
  search?: string;
  stage?: Stage | '';
  jobType?: string;
  from?: string;
  to?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api<Dashboard>('/dashboard')).data });

export const useApplications = (params: ApplicationListParams) =>
  useQuery({
    queryKey: ['applications', params],
    queryFn: async () => {
      const res = await api<Application[]>('/applications', { query: params as Record<string, string | number> });
      return { rows: res.data, meta: res.meta as PageMeta };
    },
    placeholderData: keepPreviousData,
  });

export const useApplication = (id: string | undefined) =>
  useQuery({
    queryKey: ['application', id],
    queryFn: async () => (await api<ApplicationDetail>(`/applications/${id}`)).data,
    enabled: Boolean(id),
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  });

/** Any write can affect lists, KPIs, analytics and the calendar, so refresh everything cached. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useSaveApplication(id?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await (id ? api<ApplicationDetail>(`/applications/${id}`, { method: 'PATCH', body }) : api<ApplicationDetail>('/applications', { method: 'POST', body }))).data,
    onSuccess: invalidate,
  });
}

export function useMoveStage() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) =>
      (await api<ApplicationDetail>(`/applications/${id}`, { method: 'PATCH', body: { stage } })).data,
    onSuccess: invalidate,
  });
}

export function useDeleteApplication() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/applications/${id}`, { method: 'DELETE' });
    },
    onSuccess: invalidate,
  });
}

export function useSaveInterview(applicationId: string, interviewId?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (
        await (interviewId
          ? api<Interview>(`/interviews/${interviewId}`, { method: 'PATCH', body })
          : api<Interview & { stageAdvanced: boolean }>(`/applications/${applicationId}/interviews`, { method: 'POST', body }))
      ).data,
    onSuccess: invalidate,
  });
}

export function useDeleteInterview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await api(`/interviews/${id}`, { method: 'DELETE' });
    },
    onSuccess: invalidate,
  });
}

export const useResumes = () => useQuery({ queryKey: ['resumes'], queryFn: async () => (await api<Resume[]>('/resumes')).data });

export function useUploadResume() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      const form = new FormData();
      form.append('name', name);
      form.append('file', file);
      return (await api<Resume>('/resumes', { method: 'POST', form })).data;
    },
    onSuccess: invalidate,
  });
}

export function useRenameResume() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => (await api<Resume>(`/resumes/${id}`, { method: 'PATCH', body: { name } })).data,
    onSuccess: invalidate,
  });
}

export function useDeleteResume() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => (await api<{ id: string; storageCleanup: 'ok' | 'failed' | 'skipped' }>(`/resumes/${id}`, { method: 'DELETE' })).data,
    onSuccess: invalidate,
  });
}

export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: async () => (await api<Profile>('/profile')).data, staleTime: 60_000 });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api<Profile>('/profile', { method: 'PATCH', body })).data,
    onSuccess: (data) => qc.setQueryData(['profile'], data),
  });
}

export const useCalendar = (from: string, to: string) =>
  useQuery({
    queryKey: ['calendar', from, to],
    queryFn: async () => (await api<CalendarData>('/calendar', { query: { from, to } })).data,
    placeholderData: keepPreviousData,
  });

const analyticsQuery = (f: AnalyticsFilters) => ({ from: f.from, to: f.to, jobType: f.jobType || undefined });

export const useAnalyticsSummary = (f: AnalyticsFilters) =>
  useQuery({ queryKey: ['analytics', 'summary', f], queryFn: async () => (await api<AnalyticsSummary>('/analytics/summary', { query: analyticsQuery(f) })).data, placeholderData: keepPreviousData });
export const useAnalyticsFunnel = (f: AnalyticsFilters) =>
  useQuery({ queryKey: ['analytics', 'funnel', f], queryFn: async () => (await api<FunnelData>('/analytics/funnel', { query: analyticsQuery(f) })).data, placeholderData: keepPreviousData });
export const useAnalyticsMonthly = (f: AnalyticsFilters) =>
  useQuery({ queryKey: ['analytics', 'monthly', f], queryFn: async () => (await api<MonthlyPoint[]>('/analytics/monthly', { query: analyticsQuery(f) })).data, placeholderData: keepPreviousData });
export const useAnalyticsBreakdowns = (f: AnalyticsFilters) =>
  useQuery({ queryKey: ['analytics', 'breakdowns', f], queryFn: async () => (await api<Breakdowns>('/analytics/breakdowns', { query: analyticsQuery(f) })).data, placeholderData: keepPreviousData });

export function useSampleData() {
  const invalidate = useInvalidate();
  return {
    load: useMutation({ mutationFn: async () => (await api<{ inserted: number }>('/sample-data', { method: 'POST' })).data, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: async () => (await api<{ removed: number }>('/sample-data', { method: 'DELETE' })).data, onSuccess: invalidate }),
  };
}

export function useWipeData() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async () => (await api<{ deletedResumeFiles: number; failedFileCleanups: number }>('/profile/data', { method: 'DELETE' })).data,
    onSuccess: invalidate,
  });
}
