import { useState } from 'react';
import type { ReactNode } from 'react';
import { valueSetByName } from '../fhir/spec';
import { useSim } from '../sim/simContext';
import type { FacilityState } from '../sim/state';
import type { ActivityDef, ActivityOutput, FieldDef } from '../sim/types';
import { SimOutput } from './SimOutput';

interface Props {
  activity: ActivityDef;
  onValidate: (json: unknown, title?: string) => void;
}

interface Concept {
  code: string;
  display?: string;
  system?: string;
}

const conceptsOf = (valueSet: string): Concept[] => {
  const vs = valueSetByName.get(valueSet);
  return vs
    ? vs.includes.flatMap((inc) => inc.concepts.map((c) => ({ code: c.code, display: c.display, system: inc.system })))
    : [];
};

const shapeCoded = (c: Concept, shape: FieldDef['shape'] = 'CodeableConcept'): unknown => {
  if (shape === 'code') return c.code;
  const coding = { system: c.system, code: c.code, display: c.display };
  return shape === 'Coding' ? coding : { coding: [coding] };
};

const isEmpty = (v: unknown): boolean => v === undefined || v === null || v === '';

function initialValues(activity: ActivityDef): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of activity.fields) {
    if (f.default !== undefined) out[f.path] = f.default;
    else if (f.input === 'select' && f.valueSet) {
      // Pre-shape a default coded value so generated output is complete out of the box.
      const first = conceptsOf(f.valueSet)[0];
      if (first && f.required) out[f.path] = shapeCoded(first, f.shape);
    }
  }
  return out;
}

export function SimActivityForm({ activity, onValidate }: Props) {
  const { facility, commit } = useSim();
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(activity));
  const [output, setOutput] = useState<ActivityOutput | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const set = (path: string, value: unknown) => setValues((v) => ({ ...v, [path]: value }));

  function generate() {
    const gaps = activity.fields.filter((f) => f.required && isEmpty(values[f.path])).map((f) => f.label);
    setMissing(gaps);
    if (gaps.length > 0) {
      setOutput(null);
      return;
    }
    const out = activity.build(values, facility);
    commit(out.entity);
    setOutput(out);
  }

  return (
    <div className="sim__form">
      <div className="sim__form-head">
        <h3>
          {activity.title} <span className="sim__uc">{activity.ucRef}</span>
        </h3>
        <p>{activity.summary}</p>
      </div>

      <div className="sim__fields">
        {activity.fields.map((f) => (
          <Field key={f.path} field={f} value={values[f.path]} facility={facility} onChange={(val) => set(f.path, val)} />
        ))}
      </div>

      {missing.length > 0 && <p className="sim__errors">Please fill in: {missing.join(', ')}.</p>}

      <button type="button" className="json-action json-action--accent sim__generate" onClick={generate}>
        Generate FHIR →
      </button>

      {output && <SimOutput output={output} onValidate={onValidate} />}
    </div>
  );
}

function Field({
  field,
  value,
  facility,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  facility: FacilityState;
  onChange: (v: unknown) => void;
}) {
  const id = `sim-${field.path}`;
  const str = typeof value === 'string' ? value : '';
  let control: ReactNode;

  if (field.input === 'select' && field.valueSet) {
    const concepts = conceptsOf(field.valueSet);
    const currentCode =
      value && typeof value === 'object'
        ? ((value as { coding?: { code?: string }[] }).coding?.[0]?.code ?? '')
        : str;
    control =
      concepts.length === 0 ? (
        <input
          id={id}
          type="text"
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${field.valueSet} is not enumerated — enter a code`}
        />
      ) : (
        <select
          id={id}
          value={currentCode}
          onChange={(e) => {
            const c = concepts.find((x) => x.code === e.target.value);
            onChange(c ? shapeCoded(c, field.shape) : '');
          }}
        >
          <option value="">— choose —</option>
          {concepts.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.display}
            </option>
          ))}
        </select>
      );
  } else if (field.input === 'select') {
    control = (
      <select id={id} value={str} onChange={(e) => onChange(e.target.value)}>
        <option value="">— choose —</option>
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field.input === 'entityRef') {
    const list = field.entityType ? facility.entities[field.entityType] : [];
    control = (
      <select id={id} value={str} onChange={(e) => onChange(e.target.value)}>
        <option value="">{list.length ? '— choose —' : '— none created yet —'}</option>
        {list.map((e) => (
          <option key={e.key} value={e.key}>
            {e.label}
          </option>
        ))}
      </select>
    );
  } else if (field.input === 'boolean') {
    control = <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
  } else if (field.input === 'textarea') {
    control = <textarea id={id} value={str} onChange={(e) => onChange(e.target.value)} />;
  } else if (field.input === 'number') {
    control = (
      <input
        id={id}
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  } else {
    const htmlType = field.input === 'date' ? 'date' : field.input === 'time' ? 'time' : 'text';
    control = (
      <input id={id} type={htmlType} value={str} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
    );
  }

  return (
    <div className="sim__field">
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="sim__req"> *</span>}
      </label>
      {control}
      {field.help && <span className="sim__help">{field.help}</span>}
    </div>
  );
}
