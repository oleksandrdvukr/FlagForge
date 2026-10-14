import type { AttributeValue, EvaluationResponse } from '@flagforge/shared';
import { useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router';
import { ApiError, evaluateWithKey } from '../api/client';
import { useFlags } from '../api/hooks';
import { BucketGrid } from '../components/BucketGrid';
import type { ShellContext } from '../layout/Shell';
import { bucket } from '../lib/bucket';
import type { ValueType } from '../lib/rules';

interface AttributeRow {
  name: string;
  value: string;
  type: ValueType;
}

const REASON_TEXT: Record<EvaluationResponse['reason'], string> = {
  DISABLED: 'The flag is off.',
  TARGETING_MATCH: 'A targeting rule matched.',
  PERCENTAGE_ROLLOUT: 'The user’s bucket is inside the rollout.',
  MISSING_USER_ID: 'No user ID, so the rollout can’t place this user.',
  DEFAULT: 'The user’s bucket is outside the rollout.',
};

function toValue(row: AttributeRow): AttributeValue {
  if (row.type === 'number') return Number(row.value);
  if (row.type === 'boolean') return row.value === 'true';
  return row.value;
}

/** Sends a real request to POST /api/v1/evaluate with the environment's SDK key. */
export function PlaygroundPage() {
  const { environment } = useOutletContext<ShellContext>();
  const storageKey = `flagforge.sdkKey.${environment.id}`;
  const [sdkKey, setSdkKey] = useState(() => sessionStorage.getItem(storageKey) ?? '');
  const [flagKey, setFlagKey] = useState('');
  const [userId, setUserId] = useState('usr_1001');
  const [rows, setRows] = useState<AttributeRow[]>([
    { name: 'plan', value: 'enterprise', type: 'string' },
  ]);
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [userBucket, setUserBucket] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flags = useFlags(environment.id, '', 1);
  const flag = flags.data?.items.find((f) => f.key === flagKey);

  async function run(e: FormEvent) {
    e.preventDefault();
    setError(null);
    sessionStorage.setItem(storageKey, sdkKey);
    const attributes = Object.fromEntries(
      rows.filter((r) => r.name).map((r) => [r.name, toValue(r)]),
    );
    try {
      setResult(
        await evaluateWithKey<EvaluationResponse>(sdkKey, {
          flagKey,
          ...(userId ? { userId } : {}),
          attributes,
        }),
      );
      setUserBucket(userId ? await bucket(userId, flagKey) : null);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof ApiError && err.status === 401
          ? `That isn’t the current ${environment.name} SDK key. Rotate the key on the SDK key page if you’ve lost it.`
          : err instanceof ApiError
            ? err.message
            : 'The request failed.',
      );
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h1 className="page-title">Playground</h1>
          <p className="muted">
            Evaluate a flag exactly as your app would, against {environment.name}.
          </p>
        </div>
      </header>

      <div className="playground">
        <form className="panel" onSubmit={run}>
          <label className="field">
            <span className="field-label">{environment.name} SDK key</span>
            <input
              className="input mono"
              required
              placeholder={`${environment.sdkKeyPrefix}…`}
              value={sdkKey}
              onChange={(e) => setSdkKey(e.target.value)}
            />
            <span className="field-hint">Kept in this browser tab only.</span>
          </label>
          <label className="field">
            <span className="field-label">Flag</span>
            <select
              className="input mono"
              required
              value={flagKey}
              onChange={(e) => setFlagKey(e.target.value)}
            >
              <option value="">Choose a flag</option>
              {flags.data?.items.map((f) => (
                <option key={f.id} value={f.key}>
                  {f.key}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">User ID</span>
            <input
              className="input mono"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </label>

          <fieldset className="field">
            <legend className="field-label">Attributes</legend>
            {rows.map((row, i) => (
              <div className="attr-row" key={i}>
                <input
                  className="input mono"
                  aria-label={`Attribute ${i + 1} name`}
                  placeholder="name"
                  value={row.name}
                  onChange={(e) =>
                    setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                  }
                />
                <input
                  className="input mono"
                  aria-label={`Attribute ${i + 1} value`}
                  placeholder="value"
                  value={row.value}
                  onChange={(e) =>
                    setRows(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                  }
                />
                <select
                  className="input"
                  aria-label={`Attribute ${i + 1} type`}
                  value={row.type}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, j) =>
                        j === i ? { ...r, type: e.target.value as ValueType } : r,
                      ),
                    )
                  }
                >
                  <option value="string">text</option>
                  <option value="number">number</option>
                  <option value="boolean">true/false</option>
                </select>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Remove attribute ${i + 1}`}
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setRows([...rows, { name: '', value: '', type: 'string' }])}
            >
              Add attribute
            </button>
          </fieldset>

          <button className="btn btn-primary" type="submit">
            Evaluate
          </button>
        </form>

        <div className="panel result" aria-live="polite">
          {error && <p className="field-error">{error}</p>}
          {result ? (
            <>
              <div className="result-value" data-on={result.value || undefined}>
                {result.value ? 'On' : 'Off'}
              </div>
              <div className="mono result-reason">{result.reason}</div>
              <p>{REASON_TEXT[result.reason]}</p>
              {flag && (
                <>
                  <BucketGrid
                    percentage={flag.percentageRollout}
                    highlight={userBucket}
                    disabled={!flag.isEnabled}
                  />
                  <p className="small muted">
                    {userBucket === null
                      ? `${flag.percentageRollout}% rollout.`
                      : `${userId} is in bucket ${userBucket} of a ${flag.percentageRollout}% rollout.`}
                  </p>
                </>
              )}
            </>
          ) : (
            !error && <p className="muted">Results appear here.</p>
          )}
        </div>
      </div>
    </section>
  );
}
