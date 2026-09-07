"use client"

import type { ChildTableSpec } from "@/lib/forms/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
  function updateCell(index: number, fieldname: string, value: string) {
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
                    <Input
                      value={String(row[c.fieldname] ?? "")}
                      onChange={(e) => updateCell(i, c.fieldname, e.target.value)}
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
