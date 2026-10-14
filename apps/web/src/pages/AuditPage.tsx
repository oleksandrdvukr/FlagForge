import type { AuditLogDto } from '@flagforge/shared';
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { PAGE_SIZE, useAuditLogs } from '../api/hooks';
import { Pager } from '../components/Pager';
import type { ShellContext } from '../layout/Shell';
import { diffFlagStates } from '../lib/diff';

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  isEnabled: 'Serving',
  percentageRollout: 'Rollout',
  targetingRules: 'Rules',
  archivedAt: 'Archived',
};

function show(field: string, value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (field === 'isEnabled') return value ? 'On' : 'Off';
  if (field === 'percentageRollout') return `${String(value)}%`;
  if (field === 'archivedAt') return new Date(String(value)).toLocaleString();
  if (field === 'targetingRules') {
    const rules = value as {
      attribute: string;
      operator: string;
      values: unknown[];
      value: boolean;
    }[];
    return rules.length === 0
      ? 'none'
      : rules
          .map(
            (r) => `${r.attribute} ${r.operator} ${r.values.join(',')} → ${r.value ? 'On' : 'Off'}`,
          )
          .join('; ');
  }
  return String(value);
}

export function AuditPage() {
  const { environment } = useOutletContext<ShellContext>();
  const [page, setPage] = useState(1);
  const logs = useAuditLogs(environment.id, page);

  return (
    <section>
      <header className="page-header">
        <div>
          <h1 className="page-title">Audit log</h1>
          <p className="muted">
            Every change to {environment.name} flags. Entries can’t be edited or deleted.
          </p>
        </div>
      </header>

      {logs.data?.items.length === 0 && <div className="empty">No changes yet.</div>}
      <ol className="audit">
        {logs.data?.items.map((entry) => (
          <AuditEntry key={entry.id} entry={entry} />
        ))}
      </ol>
      {logs.data && (
        <Pager page={page} pageSize={PAGE_SIZE} total={logs.data.total} onPage={setPage} />
      )}
    </section>
  );
}

function AuditEntry({ entry }: { entry: AuditLogDto }) {
  const changes = diffFlagStates(entry.previousState, entry.newState);
  return (
    <li className="audit-entry">
      <div className="audit-head">
        <span className="badge" data-action={entry.action}>
          {entry.action.toLowerCase()}
        </span>
        <span className="mono">{entry.newState.key}</span>
        <span className="muted">by {entry.actorId}</span>
        <time className="muted audit-time" dateTime={entry.timestamp}>
          {new Date(entry.timestamp).toLocaleString()}
        </time>
      </div>
      {changes.length > 0 && entry.action !== 'CREATED' && (
        <table className="diff">
          <tbody>
            {changes.map((c) => (
              <tr key={c.field}>
                <th scope="row">{FIELD_LABELS[c.field] ?? c.field}</th>
                <td className="mono diff-before">{show(c.field, c.before)}</td>
                <td aria-hidden>→</td>
                <td className="mono diff-after">{show(c.field, c.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}
