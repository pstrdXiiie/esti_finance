"use client"

import { useQuery } from "@tanstack/react-query"
import type { Control, FieldValues, Path } from "react-hook-form"
import type { FieldSpec } from "@/lib/forms/types"
import { frappe } from "@/lib/frappe"
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
 * Renders one form field from a FieldSpec (blueprint §5.1's data-driven
 * screen model: changing a field's type/label is a spec edit, not a
 * template-code change).
 */
export function DynamicField<T extends FieldValues>({
  control,
  spec,
}: {
  control: Control<T>
  spec: FieldSpec
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
                defaultValue={field.value}
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
