import { z } from 'zod';

/** FR-02: every workspace gets exactly these environments. */
export const ENVIRONMENT_NAMES = ['Development', 'Production'] as const;
export type EnvironmentName = (typeof ENVIRONMENT_NAMES)[number];

/** FR-03: SDK key prefix per environment. */
export const SDK_KEY_PREFIXES = {
  Development: 'ff_test_',
  Production: 'ff_live_',
} as const satisfies Record<EnvironmentName, string>;
export type SdkKeyPrefix = (typeof SDK_KEY_PREFIXES)[EnvironmentName];

/** FR-01 */
export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;

export interface WorkspaceDto {
  id: string;
  name: string;
  createdAt: string;
}

/** SDK keys are never returned here — only their prefix (FR-04). */
export interface EnvironmentDto {
  id: string;
  workspaceId: string;
  name: EnvironmentName;
  sdkKeyPrefix: SdkKeyPrefix;
  createdAt: string;
}

/** FR-04: the raw SDK key appears only in the response that created it. */
export interface EnvironmentWithSdkKeyDto extends EnvironmentDto {
  sdkKey: string;
}

export interface CreateWorkspaceResponse {
  workspace: WorkspaceDto;
  environments: EnvironmentWithSdkKeyDto[];
}

export interface SdkKeyResponse {
  environmentId: string;
  sdkKey: string;
}
