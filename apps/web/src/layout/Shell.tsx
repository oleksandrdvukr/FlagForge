import type { EnvironmentDto } from '@flagforge/shared';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { useEnvironments, useLogout, useWorkspaces } from '../api/hooks';

export interface ShellContext {
  workspaceId: string;
  environment: EnvironmentDto;
}

const SECTIONS = [
  ['flags', 'Flags'],
  ['playground', 'Playground'],
  ['keys', 'SDK key'],
  ['audit', 'Audit log'],
] as const;

export function Shell() {
  const { workspaceId = '', environmentId = '' } = useParams();
  const navigate = useNavigate();
  const workspaces = useWorkspaces();
  const environments = useEnvironments(workspaceId);
  const logout = useLogout();
  const environment = environments.data?.find((e) => e.id === environmentId);

  async function signOut() {
    await logout.mutateAsync();
    navigate('/login');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          FlagForge
        </div>

        <label className="field">
          <span className="field-label">Workspace</span>
          <select
            className="input"
            value={workspaceId}
            onChange={(e) =>
              e.target.value === '__new'
                ? navigate('/workspaces/new')
                : navigate(`/w/${e.target.value}`)
            }
          >
            {workspaces.data?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
            <option value="__new">+ New workspace</option>
          </select>
        </label>

        <div className="field">
          <span className="field-label">Environment</span>
          <div className="env-switch" role="tablist" aria-label="Environment">
            {environments.data?.map((env) => (
              <NavLink
                key={env.id}
                role="tab"
                aria-selected={env.id === environmentId}
                className="env-option"
                data-env={env.name}
                to={`/w/${workspaceId}/e/${env.id}/flags`}
              >
                {env.name}
              </NavLink>
            ))}
          </div>
        </div>

        <nav className="nav" aria-label="Sections">
          {SECTIONS.map(([path, label]) => (
            <NavLink
              key={path}
              className="nav-link"
              to={`/w/${workspaceId}/e/${environmentId}/${path}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="btn btn-ghost sign-out" onClick={signOut}>
          Sign out
        </button>
      </aside>

      <main className="main" data-env={environment?.name}>
        {environment ? (
          <Outlet context={{ workspaceId, environment } satisfies ShellContext} />
        ) : environments.isError ? (
          <p className="muted">This workspace could not be loaded.</p>
        ) : null}
      </main>
    </div>
  );
}
