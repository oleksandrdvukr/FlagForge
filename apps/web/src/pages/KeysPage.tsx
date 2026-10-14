import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { useRotateSdkKey } from '../api/hooks';
import { SecretReveal } from '../components/SecretReveal';
import type { ShellContext } from '../layout/Shell';

export function KeysPage() {
  const { environment } = useOutletContext<ShellContext>();
  const rotate = useRotateSdkKey();
  const [confirming, setConfirming] = useState(false);

  async function doRotate() {
    await rotate.mutateAsync(environment.id);
    setConfirming(false);
  }

  const newKey = rotate.data?.environmentId === environment.id ? rotate.data.sdkKey : null;

  return (
    <section>
      <header className="page-header">
        <div>
          <h1 className="page-title">SDK key</h1>
          <p className="muted">
            {environment.name} · keys start with <code>{environment.sdkKeyPrefix}</code>
          </p>
        </div>
      </header>

      <div className="panel">
        <p>
          FlagForge stores only a hash of the key, so the current key can’t be shown. If it was lost
          or leaked, rotate it: a new key is issued and the old one stops working immediately.
        </p>
        {newKey ? (
          <SecretReveal label={`New ${environment.name} SDK key`} value={newKey} />
        ) : confirming ? (
          <div className="actions">
            <span className="small">
              Apps using the current key will get 401 until you update them.
            </span>
            <button
              type="button"
              className="btn btn-danger"
              disabled={rotate.isPending}
              onClick={doRotate}
            >
              Rotate {environment.name} key
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirming(true)}>
            Rotate key…
          </button>
        )}
      </div>
    </section>
  );
}
