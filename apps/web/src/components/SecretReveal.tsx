import { useState } from 'react';

interface SecretRevealProps {
  label: string;
  value: string;
}

/** FR-04: a raw SDK key is shown exactly once, so make copying it obvious. */
export function SecretReveal({ label, value }: SecretRevealProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="secret">
      <div className="secret-label">{label}</div>
      <div className="secret-row">
        <code className="secret-value">{value}</code>
        <button type="button" className="btn btn-small" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="secret-note">
        This key won’t be shown again. Store it in your app’s secrets now.
      </p>
    </div>
  );
}
