import { FLAG_KEY_PATTERN, type FlagDto } from '@flagforge/shared';
import { useState, type FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router';
import { ApiError } from '../api/client';
import { PAGE_SIZE, useCreateFlag, useFlags, useUpdateFlag } from '../api/hooks';
import { Pager } from '../components/Pager';
import { Toggle } from '../components/Toggle';
import type { ShellContext } from '../layout/Shell';

export function FlagsPage() {
  const { workspaceId, environment } = useOutletContext<ShellContext>();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const flags = useFlags(environment.id, q.trim(), page);
  const update = useUpdateFlag(environment.id);
  const base = `/w/${workspaceId}/e/${environment.id}`;

  return (
    <section>
      <header className="page-header">
        <div>
          <h1 className="page-title">Flags</h1>
          <p className="muted">
            {environment.name} · {flags.data?.total ?? '…'} active
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          New flag
        </button>
      </header>

      {creating && (
        <CreateFlagForm environmentId={environment.id} onDone={() => setCreating(false)} />
      )}

      <input
        className="input search"
        type="search"
        placeholder="Search by key or name"
        aria-label="Search flags"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />

      {flags.data && flags.data.items.length === 0 ? (
        <div className="empty">
          {q ? (
            <p>No flags match “{q}”.</p>
          ) : (
            <p>No flags yet. Create one to start decoupling deploys from releases.</p>
          )}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Serving</th>
              <th scope="col">Flag</th>
              <th scope="col">Rollout</th>
              <th scope="col">Rules</th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>
            {flags.data?.items.map((flag) => (
              <FlagRow
                key={flag.id}
                flag={flag}
                href={`${base}/flags/${flag.id}`}
                busy={update.isPending && update.variables?.id === flag.id}
                onToggle={(isEnabled) => update.mutate({ id: flag.id, body: { isEnabled } })}
              />
            ))}
          </tbody>
        </table>
      )}

      {flags.data && (
        <Pager page={page} pageSize={PAGE_SIZE} total={flags.data.total} onPage={setPage} />
      )}
    </section>
  );
}

function FlagRow(props: {
  flag: FlagDto;
  href: string;
  busy: boolean;
  onToggle: (isEnabled: boolean) => void;
}) {
  const { flag } = props;
  return (
    <tr data-enabled={flag.isEnabled || undefined}>
      <td>
        <Toggle
          checked={flag.isEnabled}
          disabled={props.busy}
          label={`${flag.isEnabled ? 'Turn off' : 'Turn on'} ${flag.key}`}
          onChange={props.onToggle}
        />
      </td>
      <td>
        <Link className="flag-link" to={props.href}>
          <span className="mono">{flag.key}</span>
          <span className="flag-name">{flag.name}</span>
        </Link>
      </td>
      <td>
        <span className="rollout-bar" aria-label={`${flag.percentageRollout}% rollout`}>
          <span style={{ width: `${flag.percentageRollout}%` }} />
        </span>
        <span className="mono rollout-value">{flag.percentageRollout}%</span>
      </td>
      <td className="mono">{flag.targetingRules.length || '—'}</td>
      <td className="muted">
        <time dateTime={flag.updatedAt}>{new Date(flag.updatedAt).toLocaleString()}</time>
      </td>
    </tr>
  );
}

function CreateFlagForm({ environmentId, onDone }: { environmentId: string; onDone: () => void }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateFlag(environmentId);
  const keyValid = FLAG_KEY_PATTERN.test(key);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      key,
      name,
      ...(description ? { description } : {}),
      isEnabled: false,
      percentageRollout: 0,
      targetingRules: [],
    });
    onDone();
  }

  return (
    <form className="panel create-flag" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Key</span>
        <input
          className="input mono"
          required
          placeholder="new-checkout"
          value={key}
          aria-invalid={key !== '' && !keyValid}
          onChange={(e) => setKey(e.target.value)}
        />
        <span className="field-hint">
          3–64 lowercase letters, digits, - or _. Can’t be changed later.
        </span>
      </label>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="input"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Description</span>
        <input
          className="input"
          maxLength={500}
          placeholder="Optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {create.error && (
        <p className="field-error" role="alert">
          {create.error instanceof ApiError ? create.error.message : 'Could not create the flag.'}
        </p>
      )}
      <div className="actions">
        <button
          className="btn btn-primary"
          type="submit"
          disabled={!keyValid || !name || create.isPending}
        >
          Create flag
        </button>
        <button className="btn btn-ghost" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
      <p className="field-hint">New flags start off. Turn them on when you’re ready to serve.</p>
    </form>
  );
}
