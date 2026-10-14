import type {
  AuditLogDto,
  CreateFlagRequest,
  CreateWorkspaceResponse,
  EnvironmentDto,
  FlagDto,
  LoginRequest,
  Page,
  SdkKeyResponse,
  UpdateFlagRequest,
  WorkspaceDto,
} from '@flagforge/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const keys = {
  workspaces: ['workspaces'] as const,
  environments: (workspaceId: string) => ['environments', workspaceId] as const,
  flags: (environmentId: string) => ['flags', environmentId] as const,
  flagList: (environmentId: string, q: string, page: number) =>
    ['flags', environmentId, { q, page }] as const,
  flag: (flagId: string) => ['flag', flagId] as const,
  audit: (environmentId: string) => ['audit', environmentId] as const,
};

export const PAGE_SIZE = 20;

export function useLogin() {
  return useMutation({
    mutationFn: (body: LoginRequest) => api<void>('POST', '/auth/login', body),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('POST', '/auth/logout'),
    onSuccess: () => qc.clear(),
  });
}

export function useWorkspaces() {
  return useQuery({
    queryKey: keys.workspaces,
    queryFn: () => api<WorkspaceDto[]>('GET', '/workspaces'),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<CreateWorkspaceResponse>('POST', '/workspaces', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspaces }),
  });
}

export function useEnvironments(workspaceId: string | undefined) {
  return useQuery({
    queryKey: keys.environments(workspaceId ?? ''),
    queryFn: () => api<EnvironmentDto[]>('GET', `/workspaces/${workspaceId}/environments`),
    enabled: Boolean(workspaceId),
  });
}

export function useRotateSdkKey() {
  return useMutation({
    mutationFn: (environmentId: string) =>
      api<SdkKeyResponse>('POST', `/environments/${environmentId}/sdk-key/rotate`),
  });
}

export function useFlags(environmentId: string, q: string, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) params.set('q', q);
  return useQuery({
    queryKey: keys.flagList(environmentId, q, page),
    queryFn: () => api<Page<FlagDto>>('GET', `/environments/${environmentId}/flags?${params}`),
    placeholderData: (previous) => previous,
  });
}

export function useFlag(flagId: string) {
  return useQuery({
    queryKey: keys.flag(flagId),
    queryFn: () => api<FlagDto>('GET', `/flags/${flagId}`),
  });
}

export function useCreateFlag(environmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFlagRequest) =>
      api<FlagDto>('POST', `/environments/${environmentId}/flags`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.flags(environmentId) });
      void qc.invalidateQueries({ queryKey: keys.audit(environmentId) });
    },
  });
}

export function useUpdateFlag(environmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateFlagRequest }) =>
      api<FlagDto>('PATCH', `/flags/${id}`, body),
    onSuccess: (flag) => {
      qc.setQueryData(keys.flag(flag.id), flag);
      void qc.invalidateQueries({ queryKey: keys.flags(environmentId) });
      void qc.invalidateQueries({ queryKey: keys.audit(environmentId) });
    },
  });
}

export function useArchiveFlag(environmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>('DELETE', `/flags/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: keys.flag(id) });
      void qc.invalidateQueries({ queryKey: keys.flags(environmentId) });
      void qc.invalidateQueries({ queryKey: keys.audit(environmentId) });
    },
  });
}

export function useAuditLogs(environmentId: string, page: number) {
  return useQuery({
    queryKey: [...keys.audit(environmentId), page],
    queryFn: () =>
      api<Page<AuditLogDto>>(
        'GET',
        `/environments/${environmentId}/audit-logs?page=${page}&pageSize=${PAGE_SIZE}`,
      ),
    placeholderData: (previous) => previous,
  });
}
