"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useController, type Control } from "react-hook-form"

import { frappe } from "@/lib/frappe"
import EmployeeSearch, { type EmployeeOption } from "@/components/sms/EmployeeSearch"

/**
 * Bridges EmployeeSearch's `selected: EmployeeOption | null` / `onSelect`
 * contract to react-hook-form, for any spec whose `employee` field is a
 * Link to Personnel Info. The form itself only ever holds/submits the
 * plain docname string (field.value) — this component's only extra job is
 * resolving that string BACK into a full EmployeeOption when editing an
 * existing record (or when a defaultEmployee query-param prefill sets the
 * form value before the user has clicked anything), so EmployeeSearch can
 * render the employee's real name instead of falling back to its own
 * search box every time.
 *
 * Same "wire a shared component into react-hook-form via useController"
 * pattern as EmployeeDetailTabs.tsx's DepartmentField.
 */
export function EmployeeSearchField({
  control,
  label,
  idPrefix,
}: {
  control: Control<Record<string, unknown>>
  label: string
  idPrefix: string
}) {
  const { field } = useController({ control, name: "employee", defaultValue: "" })
  const currentValue = (field.value as string) ?? ""

  const [resolved, setResolved] = useState<EmployeeOption | null>(null)

  // Only fires when the form already holds a docname we haven't resolved
  // to a full EmployeeOption yet (editing an existing record, or a
  // defaultEmployee prefill) — never fires once `resolved` is set.
  const resolveQuery = useQuery({
    queryKey: ["Personnel Info", "resolve", currentValue],
    queryFn: () =>
      frappe.getDoc<{ name: string; employee_id: string | null; first_name: string; last_name: string }>(
        "Personnel Info",
        currentValue
      ),
    enabled: !!currentValue && !resolved,
  })

  useEffect(() => {
    if (resolveQuery.data) {
      setResolved({
        name: resolveQuery.data.name,
        employee_id: resolveQuery.data.employee_id,
        first_name: resolveQuery.data.first_name,
        last_name: resolveQuery.data.last_name,
      })
    }
  }, [resolveQuery.data])

  // If the form value is cleared, or changes to a docname that doesn't
  // match what's already resolved (e.g. switching records), drop the
  // stale resolved option so EmployeeSearch falls back to its own search
  // UI instead of showing the wrong person.
  useEffect(() => {
    if (resolved && resolved.name !== currentValue) {
      setResolved(null)
    }
    if (!currentValue) {
      setResolved(null)
    }
  }, [currentValue, resolved])

  return (
    <div className="grid gap-1.5">
      <label htmlFor={`${idPrefix}-employee-search`}>{label}</label>
      <EmployeeSearch
        idPrefix={idPrefix}
        selected={resolved}
        onSelect={(option) => {
          setResolved(option)
          field.onChange(option ? option.name : "")
        }}
      />
    </div>
  )
}
