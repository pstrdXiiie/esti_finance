"use client"

import { useController, type Control } from "react-hook-form"

import { Input } from "@/components/ui/input"

/**
 * Standalone Time field, RHF-wired via useController — same integration
 * pattern as EmployeeSearchField, added because DynamicField's fieldtype
 * union/renderer doesn't have a confirmed "Time" case yet (unverified —
 * DynamicField.tsx hasn't been reviewed). Stores/emits a plain "HH:mm"
 * string, matching a native <input type="time">, so it plugs directly
 * into OvertimeEntry's existing num_hours calculation without any
 * reparsing on that side.
 */
export function TimeField({
  control,
  name,
  label,
}: {
  control: Control<Record<string, unknown>>
  name: string
  label: string
}) {
  const { field } = useController({ control, name, defaultValue: "" })

  return (
    <div className="grid gap-1.5">
      <label htmlFor={`${name}-time`}>{label}</label>
      <Input
        id={`${name}-time`}
        type="time"
        value={(field.value as string) ?? ""}
        onChange={(e) => field.onChange(e.target.value)}
      />
    </div>
  )
}
