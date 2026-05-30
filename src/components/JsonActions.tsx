import { useState } from 'react';
import type { ReactNode } from 'react';
import { SPEC } from '../fhir/spec';

interface Props {
  /** A JSON value or a pre-stringified payload. */
  json: unknown;
  /** Download filename. */
  filename: string;
  /** Optional extra action(s), e.g. a "Validate this" button. */
  extra?: ReactNode;
}

/** Copy-to-clipboard and download buttons for a JSON payload. */
export function JsonActions({ json, filename, extra }: Props) {
  const [copied, setCopied] = useState(false);
  const text = typeof json === 'string' ? json : JSON.stringify(json, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked; ignore silently
    }
  }

  function download() {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Stamp the IG package version into the filename so a saved payload
    // declares which SERIS build it reflects.
    a.download = filename.replace(/\.json$/i, `.${SPEC.meta.packageVersion}.json`);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="json-actions">
      <button type="button" className="json-action" onClick={copy}>
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
      <button type="button" className="json-action" onClick={download}>
        Download
      </button>
      {extra}
    </div>
  );
}
