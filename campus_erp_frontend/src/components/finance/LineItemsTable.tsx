"use client"

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

export interface LineItemColumn<Row> {
  /** Key into the row object this column edits (or, if `computed`, reads). */
  key: keyof Row & string
  label: string
  /** Input type for editable columns. Ignored when `computed` is set. Defaults to "text". */
  type?: "text" | "number"
  align?: "left" | "right"
  /**
   * When set, the column renders read-only derived text instead of an Input
   * (e.g. a per-row Amount computed from Qty * Unit Price). The row's raw
   * field values stay caller-defined strings; formatting/parsing happens here.
   */
  computed?: (row: Row) => string
}

export interface LineItemsTableProps<Row> {
  columns: LineItemColumn<Row>[]
  rows: Row[]
  onChange: (rows: Row[]) => void
  /**
   * Row appended by "+ Add Row". A fresh object is spread off this on every
   * add, so passing the same `emptyRow` reference on every render is safe —
   * rows are never aliased to it or to each other.
   */
  emptyRow: Row
  /** Shown as a full-width row when `rows` is empty. */
  emptyStateLabel?: string
}

/**
 * Generic, typed-columns version of the ChildTableGrid pattern
 * (src/components/sms/ChildTableGrid.tsx): a <Table> of editable rows with an
 * Input per editable cell (or read-only text for `computed` columns), a "✕"
 * ghost Button to remove a row, a "+ Add Row" outline Button below the table
 * that appends `emptyRow`, and an empty-state row when there are zero line
 * items. Rows use their array index as the React key — the accepted
 * convention in this codebase for line items inside a single open form,
 * where the whole grid is local draft state discarded or replaced wholesale
 * on save/cancel (never spliced by identity). This is NOT the right pattern
 * for the outer list of already-saved records, which must key by a stable id.
 */
export function LineItemsTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  onChange,
  emptyRow,
  emptyStateLabel = "No line items yet.",
}: LineItemsTableProps<Row>) {
  function updateCell(index: number, key: keyof Row & string, value: string) {
    const next = rows.slice()
    next[index] = { ...next[index], [key]: value } as Row
    onChange(next)
  }

  function addRow() {
    onChange([...rows, { ...emptyRow }])
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  const columnCount = columns.length + 1 // + the trailing row-actions column

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={col.align === "right" ? "text-right" : undefined}
                >
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="w-10">
                <span className="sr-only">Row actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="text-center text-sm text-muted-foreground"
                >
                  {emptyStateLabel}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.computed ? (
                        <span
                          className={
                            col.align === "right"
                              ? "block text-right text-sm"
                              : "block text-sm"
                          }
                        >
                          {col.computed(row)}
                        </span>
                      ) : (
                        <Input
                          aria-label={`${col.label}, row ${i + 1}`}
                          type={col.type ?? "text"}
                          inputMode={col.type === "number" ? "decimal" : undefined}
                          value={String(row[col.key] ?? "")}
                          onChange={(e) => updateCell(i, col.key, e.target.value)}
                          className={col.align === "right" ? "text-right" : undefined}
                        />
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove row ${i + 1}`}
                      onClick={() => removeRow(i)}
                    >
                      ✕
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        + Add Row
      </Button>
    </div>
  )
}
