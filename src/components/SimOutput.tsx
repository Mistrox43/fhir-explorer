import { useMemo } from 'react';
import { validateResource } from '../fhir/validate';
import { inspectBundle } from '../fhir/bundle';
import { ExampleViewer } from './ExampleViewer';
import type { ActivityOutput } from '../sim/types';
import type { TemplateExample } from '../fhir/types';

interface Props {
  output: ActivityOutput;
  onValidate: (json: unknown, title?: string) => void;
}

/** Shows the FHIR a built activity transmits, auto-checked with the same engine as Validate. */
export function SimOutput({ output, onValidate }: Props) {
  const check = useMemo(() => {
    if (output.kind === 'message') {
      const r = inspectBundle(output.payload);
      const errors =
        [...r.structural, ...r.entries.flatMap((e) => e.validation.findings)].filter(
          (f) => f.severity === 'error',
        ).length + r.danglingRefs.length;
      return {
        ok: errors === 0,
        label: errors === 0 ? 'Message inspects clean — 0 errors, 0 dangling refs' : `${errors} issue(s) found`,
      };
    }
    const r = validateResource(output.payload);
    const errors = r.findings.filter((f) => f.severity === 'error').length;
    return {
      ok: errors === 0,
      label: errors === 0 ? `Conforms to ${r.profileName ?? 'its profile'} — 0 errors` : `${errors} error(s) found`,
    };
  }, [output]);

  const heading = output.kind === 'message' ? 'Generated message' : `${output.method} ${output.endpoint}`;
  const example: TemplateExample = {
    title: heading,
    description:
      output.kind === 'message'
        ? 'The complete message Bundle this activity transmits to SERIS.'
        : `The resource this activity submits over REST (${output.method} ${output.endpoint}).`,
    json: output.payload,
    annotations: [],
  };

  return (
    <section className="sim__output">
      <div className="sim__output-head">
        <h4>{heading}</h4>
        <span className={`sim__check sim__check--${check.ok ? 'ok' : 'bad'}`}>
          {check.ok ? '✓' : '✕'} {check.label}
        </span>
      </div>
      <ExampleViewer example={example} onValidate={onValidate} />
    </section>
  );
}
