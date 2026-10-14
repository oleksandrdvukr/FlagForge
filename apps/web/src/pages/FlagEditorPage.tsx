import type { FlagDto } from '@flagforge/shared';
import { useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useArchiveFlag, useFlag, useUpdateFlag } from '../api/hooks';
import { BucketGrid } from '../components/BucketGrid';
import { RuleBuilder } from '../components/RuleBuilder';
import { Toggle } from '../components/Toggle';
import type { ShellContext } from '../layout/Shell';
import { emptyDraft, parseDraft, toDraft, type RuleDraft } from '../lib/rules';

export function FlagEditorPage() {
  const { flagId = '' } = useParams();
  const flag = useFlag(flagId);
  if (flag.isError) {
    return <p className="muted">This flag doesn’t exist or has been archived.</p>;
  }
  if (!flag.data) return <div className="loading">Loading…</div>;
  return <FlagEditor key={flag.data.id} flag={flag.data} />;
}

function FlagEditor({ flag }: { flag: FlagDto }) {
  const { workspaceId, environment } = useOutletContext<ShellContext>();
  const navigate = useNavigate();
  const update = useUpdateFlag(environment.id);
  const archive = useArchiveFlag(environment.id);
  const [percentage, setPercentage] = useState(flag.percentageRollout);
  const [drafts, setDrafts] = useState<RuleDraft[]>(flag.targetingRules.map(toDraft));
  const [base, setBase] = useState(flag);
  // A newer server version (a save, the kill-switch, another tab) refreshes the form only
  // if it holds no unsaved edits, so toggling the flag never discards a draft.
  if (flag.updatedAt !== base.updatedAt) {
    const untouched =
      percentage === base.percentageRollout &&
      JSON.stringify(drafts) === JSON.stringify(base.targetingRules.map(toDraft));
    setBase(flag);
    if (untouched) {
      setPercentage(flag.percentageRollout);
      setDrafts(flag.targetingRules.map(toDraft));
    }
  }
  const [confirmArchive, setConfirmArchive] = useState(false);
  const listUrl = `/w/${workspaceId}/e/${environment.id}/flags`;

  const parsed = drafts.map(parseDraft);
  const rules = parsed.flatMap((p) => (p.ok ? [p.rule] : []));
  const valid = rules.length === drafts.length;
  const dirty =
    percentage !== flag.percentageRollout ||
    JSON.stringify(rules) !== JSON.stringify(flag.targetingRules) ||
    !valid;

  function save() {
    update.mutate({ id: flag.id, body: { percentageRollout: percentage, targetingRules: rules } });
  }

  async function doArchive() {
    await archive.mutateAsync(flag.id);
    navigate(listUrl);
  }

  return (
    <section>
      <Link className="back" to={listUrl}>
        ← Flags
      </Link>
      <header className="page-header">
        <div>
          <h1 className="page-title mono">{flag.key}</h1>
          <p className="muted">
            {flag.name}
            {flag.description ? ` — ${flag.description}` : ''}
          </p>
        </div>
        <Toggle
          checked={flag.isEnabled}
          disabled={update.isPending}
          label={`${flag.isEnabled ? 'Turn off' : 'Turn on'} ${flag.key}`}
          onChange={(isEnabled) => update.mutate({ id: flag.id, body: { isEnabled } })}
        />
      </header>

      {!flag.isEnabled && (
        <p className="notice">
          This flag is off: every user gets <strong>Off</strong>, whatever the rules and rollout
          say.
        </p>
      )}

      <div className="panel">
        <h2 className="panel-title">Targeting rules</h2>
        <p className="muted small">Checked top to bottom. The first rule that matches decides.</p>
        <RuleBuilder drafts={drafts} onChange={setDrafts} />
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setDrafts([...drafts, emptyDraft()])}
        >
          Add rule
        </button>
      </div>

      <div className="panel rollout">
        <div className="rollout-controls">
          <h2 className="panel-title">Percentage rollout</h2>
          <p className="muted small">
            Users matched by no rule. Each user lands in one of 100 fixed buckets.
          </p>
          <div className="rollout-input">
            <input
              type="range"
              min={0}
              max={100}
              value={percentage}
              aria-label="Rollout percentage"
              onChange={(e) => setPercentage(Number(e.target.value))}
            />
            <input
              className="input mono rollout-number"
              type="number"
              min={0}
              max={100}
              value={percentage}
              aria-label="Rollout percentage value"
              onChange={(e) =>
                setPercentage(Math.max(0, Math.min(100, Math.round(Number(e.target.value)))))
              }
            />
            <span className="mono">%</span>
          </div>
          <p className="small">
            Buckets <span className="mono">0–{Math.max(0, percentage - 1)}</span> get On
            {percentage === 0 ? ' — none right now.' : '.'} Raising the percentage only adds users.
          </p>
        </div>
        <BucketGrid percentage={percentage} disabled={!flag.isEnabled} />
      </div>

      {update.error && (
        <p className="field-error" role="alert">
          {update.error instanceof ApiError ? update.error.message : 'Could not save changes.'}
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || !valid || update.isPending}
          onClick={save}
        >
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
        {!valid && <span className="field-error">Fix the highlighted rules to save.</span>}
        <span className="spacer" />
        {confirmArchive ? (
          <>
            <span className="small">
              Archived flags can’t be restored, and the key stays taken.
            </span>
            <button
              type="button"
              className="btn btn-danger"
              disabled={archive.isPending}
              onClick={doArchive}
            >
              Archive {flag.key}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmArchive(false)}
            >
              Keep
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmArchive(true)}>
            Archive flag…
          </button>
        )}
      </div>
    </section>
  );
}
