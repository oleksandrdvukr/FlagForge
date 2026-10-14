import { Navigate, useParams } from 'react-router';
import { useEnvironments, useWorkspaces } from '../api/hooks';

/** Picks a workspace (newest, or the one in the URL) and its first environment. */
export function HomeRedirect() {
  const { workspaceId: fromUrl } = useParams();
  const workspaces = useWorkspaces();
  const workspaceId = fromUrl ?? workspaces.data?.[0]?.id;
  const environments = useEnvironments(workspaceId);

  if (workspaces.isSuccess && workspaces.data.length === 0)
    return <Navigate to="/workspaces/new" replace />;
  const environment = environments.data?.[0];
  if (workspaceId && environment) {
    return <Navigate to={`/w/${workspaceId}/e/${environment.id}/flags`} replace />;
  }
  return <div className="loading">Loading…</div>;
}
