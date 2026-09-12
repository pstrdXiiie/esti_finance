"use client";

import { useState } from "react";

export interface FieldSpec {
  fieldname: string;
  label: string;
  fieldtype: "Select" | "Date" | "Link" | "Text";
  options?: string;
  required?: boolean;
}

export interface EntrySpec {
  doctype: string;
  title: string;
  fields: FieldSpec[];
}

export function EntryForm({
  spec,
  onSubmit,
}: {
  spec: EntrySpec;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const set = (name: string, v: string) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <h2>{spec.title}</h2>
      {spec.fields.map((f) => (
        <div key={f.fieldname} style={{ marginBottom: 12 }}>
          <label>
            {f.label}
            {f.required && " *"}
          </label>

          {f.fieldtype === "Select" && (
            <select
              required={f.required}
              value={values[f.fieldname] ?? ""}
              onChange={(e) => set(f.fieldname, e.target.value)}
            >
              <option value="">Select...</option>
              {f.options?.split("\n").map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}

          {f.fieldtype === "Date" && (
            <input
              type="date"
              required={f.required}
              value={values[f.fieldname] ?? ""}
              onChange={(e) => set(f.fieldname, e.target.value)}
            />
          )}

          {(f.fieldtype === "Link" || f.fieldtype === "Text") && (
            <input
              type="text"
              required={f.required}
              placeholder={f.fieldtype === "Link" ? `Link to ${f.options}` : undefined}
              value={values[f.fieldname] ?? ""}
              onChange={(e) => set(f.fieldname, e.target.value)}
            />
          )}
        </div>
      ))}
      <button type="submit">Save</button>
    </form>
  );
}