"use client"

import { useQuery } from "@tanstack/react-query"
import type { Control, FieldValues, Path } from "react-hook-form"
import type { FieldSpec } from "@/lib/forms/types"
import { frappe } from "@/lib/frappe"
import { LinkSearchField } from "@/components/sms/LinkSearchField"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

/**
 * Options for a Link field spec'd with `dropdown: true` — the list of
 * records of its target doctype (`spec.options`), rather than the usual
 * type-the-exact-name Data input.
 */
function useLinkDropdownOptions(spec: FieldSpec) {
  const enabled = spec.fieldtype === "Link" && !!spec.dropdown && !!spec.options
  return useQuery({
    queryKey: ["Link", "dropdown-options", spec.options],
    queryFn: () =>
      frappe.list<{ name: string }>(spec.options as string, {
        fields: ["name"],
        limit_page_length: 500,
      }),
    enabled,
  })
}

/**
 * After a searchable Link field's value is picked (spec.autofill), copies
 * matching data into other fields on the same form -- directly from the
 * picked record, and/or from its newest related record (e.g. a Student's
 * latest Program Enrollment). Best-effort: a failed related-record lookup
 * just leaves those fields as-is rather than blocking the selection.
 */
async function applyAutofill(
  spec: FieldSpec,
  row: Record<string, unknown>,
  setValue?: (name: string, value: unknown) => void
) {
  if (!spec.autofill || !setValue) return
  if (spec.autofill.fields) {
    for (const [srcField, destField] of Object.entries(spec.autofill.fields)) {
      setValue(destField, row[srcField] ?? "")
    }
  }
  if (spec.autofill.relatedRecord) {
    const { doctype, linkField, orderBy, fields } = spec.autofill.relatedRecord
    try {
      const related = await frappe.list<Record<string, unknown>>(doctype, {
        fields: ["name", ...Object.keys(fields)],
        filters: [[linkField, "=", row.name as string]],
        order_by: `${orderBy} desc`,
        limit_page_length: 1,
      })
      const match = related[0]
      if (match) {
        for (const [srcField, destField] of Object.entries(fields)) {
          setValue(destField, match[srcField] ?? "")
        }
      }
    } catch {
      // best-effort -- leave related fields untouched on failure
    }
  }
}

/**
 * Renders one form field from a FieldSpec (blueprint §5.1's data-driven
 * screen model: changing a field's type/label is a spec edit, not a
 * template-code change).
 */
export function DynamicField<T extends FieldValues>({
  control,
  spec,
  setValue,
}: {
  control: Control<T>
  spec: FieldSpec
  /** Loosely typed on purpose -- autofill destination fieldnames come from spec data, not this component's own T. */
  setValue?: (name: string, value: unknown) => void
}) {
  const linkDropdownQuery = useLinkDropdownOptions(spec)

  return (
    <FormField
      control={control}
      name={spec.fieldname as Path<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {spec.label}
            {spec.required ? " *" : ""}
          </FormLabel>
          <FormControl>
            {spec.fieldtype === "Select" ? (
              <Select
                onValueChange={field.onChange}
                value={field.value ?? ""}
                disabled={spec.readOnly}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue className="block min-w-0 truncate" />
                </SelectTrigger>
                <SelectContent>
                  {(spec.options ?? "")
                    .split("\n")
                    .filter(Boolean)
                    .map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : spec.fieldtype === "Link" && spec.searchable ? (
              <LinkSearchField
                spec={spec}
                value={(field.value as string | undefined) ?? ""}
                disabled={spec.readOnly}
                onChange={field.onChange}
                onSelect={(row) => applyAutofill(spec, row, setValue)}
              />
            ) : spec.fieldtype === "Link" && spec.dropdown ? (
              <Select
                onValueChange={field.onChange}
                value={(field.value as string | undefined) ?? ""}
                disabled={spec.readOnly}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue
                    className="block min-w-0 truncate"
                    placeholder={linkDropdownQuery.isLoading ? "Loading…" : `Select ${spec.label}`}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(linkDropdownQuery.data ?? []).map((opt) => (
                    <SelectItem key={opt.name} value={opt.name}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : spec.fieldtype === "Check" ? (
              <input
                type="checkbox"
                checked={!!field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                disabled={spec.readOnly}
                className="h-4 w-4"
              />
            ) : (
              <Input
                type={
                  spec.fieldtype === "Date"
                    ? "date"
                    : spec.fieldtype === "Datetime"
                      ? "datetime-local"
                      : spec.fieldtype === "Int" || spec.fieldtype === "Float" || spec.fieldtype === "Currency"
                        ? "number"
                        : "text"
                }
                readOnly={spec.readOnly}
                {...field}
                // field.value is undefined for any field with no default on a
                // brand-new record (e.g. MasterDetailScreen's Add New does
                // form.reset({})) -- Input would render uncontrolled on the
                // first keystroke, then controlled once field.value becomes a
                // real string, which is exactly the class of bug React warns
                // about ("changing an uncontrolled input to be controlled")
                // and can leave the DOM's actual value out of sync with what
                // react-hook-form believes it submitted. Coerce to "" so the
                // input is controlled from the very first render.
                value={(field.value as string | number | undefined) ?? ""}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
