import type { ReactNode } from 'react';

export function NumberField(props: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label>
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </label>
      <div className="inputwrap">
        <input
          type="number"
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Number(e.target.value) || 0)}
        />
        {props.unit && <span className="unit" aria-hidden="true">{props.unit}</span>}
      </div>
    </div>
  );
}

export function PercentField(props: {
  label: string;
  hint?: string;
  value: number; // fração 0..1
  step?: number;
  onChange: (fraction: number) => void;
}) {
  return (
    <div className="field">
      <label>
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </label>
      <div className="inputwrap">
        <input
          type="number"
          value={Math.round(props.value * 1000) / 10}
          min={0}
          max={100}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100)}
        />
        <span className="unit" aria-hidden="true">%</span>
      </div>
    </div>
  );
}

export function TextField(props: {
  label: string;
  hint?: string;
  value: string;
  type?: 'text' | 'date' | 'url';
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field full">
      <label>
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </label>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

export function Toggle<T extends string | number>(props: {
  label?: string;
  hint?: string;
  value: T;
  options: readonly { readonly v: T; readonly label: string }[];
  onChange: (v: T) => void;
}) {
  const body = (
    <div className="toggle" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          aria-pressed={o.v === props.value}
          onClick={() => props.onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
  if (!props.label) return body;
  return (
    <div className="field full">
      <label>
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </label>
      {body}
    </div>
  );
}

export function SelectField<T extends string>(props: {
  label: string;
  hint?: string;
  value: T;
  options: readonly { readonly v: T; readonly label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field full">
      <label>
        {props.label}
        {props.hint && <small>{props.hint}</small>}
      </label>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Panel(props: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="panel">
      <h2>{props.title}</h2>
      {props.sub && <p className="sub">{props.sub}</p>}
      {props.children}
    </div>
  );
}
