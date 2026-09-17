"use client"

import type { FieldSpec, ChildTableSpec } from "@/lib/forms/types"
import { useLinkDropdownOptions } from "@/components/sms/DynamicField"
import { LinkSearchField } from "@/components/sms/LinkSearchField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * One row's cell for a column, rendered per `column.fieldtype` the same way
 * DynamicField does for top-level fields — a Select gets its options list, a
 * searchable/dropdown Link gets a search box or a picklist instead of a bare
 * text box a typo can slip through. Everything else falls back to a plain
 * Input (previous behavior), with the same type= mapping DynamicField uses
 * for Date/Datetime/Int/Float/Currency.
 */
function ChildTableCell({
  column,
  value,
  onChange,
}: {
  column: FieldSpec
  value: unknown
  onChange: (value: unknown) => void
}) {
  const linkDropdownQuery = useLinkDropdownOptions(column)

  if (column.fieldtype === "Select") {
    return (
      <Select onValueChange={onChange} value={(value as string | undefined) ?? ""}>
        <SelectTrigger className="w-full min-w-0">
          <SelectValue className="block min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent>
          {(column.options ?? "")
            .split("\n")
            .filter(Boolean)
            .map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    )
  }

  if (column.fieldtype === "Link" && column.searchable) {
    return (
      <LinkSearchField
        spec={column}
        value={(value as string | undefined) ?? ""}
        onChange={onChange}
        onSelect={() => {}}
      />
    )
  }

  if (column.fieldtype === "Link" && column.dropdown) {
    return (
      <Select onValueChange={onChange} value={(value as string | undefined) ?? ""}>
        <SelectTrigger className="w-full min-w-0">
          <SelectValue
            className="block min-w-0 truncate"
            placeholder={linkDropdownQuery.isLoading ? "Loading…" : `Select ${column.label}`}
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
    )
  }

  if (column.fieldtype === "Check") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    )
  }

  return (
    <Input
      type={
        column.fieldtype === "Date"
          ? "date"
          : column.fieldtype === "Datetime"
            ? "datetime-local"
            : column.fieldtype === "Int" || column.fieldtype === "Float" || column.fieldtype === "Currency"
              ? "number"
              : "text"
      }
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** Shared editable grid for a Frappe child table, used by EntryScreen. */
export function ChildTableGrid({
  spec,
  rows,
  onChange,
}: {
  spec: ChildTableSpec
  rows: Array<Record<string, unknown>>
  onChange: (rows: Array<Record<string, unknown>>) => void
}) {
  function updateCell(index: number, fieldname: string, value: unknown) {
    const next = rows.slice()
    next[index] = { ...next[index], [fieldname]: value }
    onChange(next)
  }

  function addRow() {
    onChange([...rows, {}])
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {spec.columns.map((c) => (
                <TableHead key={c.fieldname}>{c.label}</TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {spec.columns.map((c) => (
                  <TableCell key={c.fieldname}>
                    <ChildTableCell
                      column={c}
                      value={row[c.fieldname]}
                      onChange={(value) => updateCell(i, c.fieldname, value)}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(i)}
                  >
                    ✕
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        + Add Row
      </Button>
    </div>
  )
}
