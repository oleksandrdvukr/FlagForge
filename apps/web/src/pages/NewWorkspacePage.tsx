import type { CreateWorkspaceResponse } from '@flagforge/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useCreateWorkspace } from '../api/hooks';
import { SecretReveal } from '../components/SecretReveal';

export function NewWorkspacePage() {
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreateWorkspaceResponse | null>(null);
  const create = useCreateWorkspace();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setCreated(await create.mutateAsync(name));
  }

  if (created) {
    const first = created.environments[0]!;
    return (
      <div className="login">
        <div className="login-card wide">
          <h1 className="login-title">{created.workspace.name} is ready</h1>
          <p className="muted">
            Each environment has its own SDK key. Your apps send it in the{' '}
            <code>X-Environment-Key</code> header.
          </p>
          {created.environments.map((env) => (
            <SecretReveal key={env.id} label={`${env.name} SDK key`} value={env.sdkKey} />
          ))}
          <Link className="btn btn-primary" to={`/w/${created.workspace.id}/e/${first.id}/flags`}>
            I’ve saved the keys — go to flags
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <h1 className="login-title">New workspace</h1>
        <p className="muted">A workspace gets a Development and a Production environment.</p>
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="input"
            required
            maxLength={100}
            placeholder="Acme Checkout"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={create.isPending}>
          Create workspace
        </button>
        <Link className="btn btn-ghost" to="/">
          Cancel
        </Link>
      </form>
    </div>
  );
}
