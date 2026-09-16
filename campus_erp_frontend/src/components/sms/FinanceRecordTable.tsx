"use client"

import type { ReactNode } from "react"

export interface FinanceRecordColumn<T> {
  key: string
  label: string
  align?: "right"
  render: (row: T) => ReactNode
}

/**
 * Generic "search & select a record" table used across finance
 * transaction screens (requisition/PO lookups, due-payables list, etc.)
 * — replaces per-page hand-rolled <table>/div-grid row lists.
 */
export function FinanceRecordTable<T>({
  columns,
  rows,
  rowKey,
  selectedRowKey,
  onSelectRow,
  isLoading,
  emptyMessage = "No records found.",
}: {
  columns: FinanceRecordColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  selectedRowKey?: string
  onSelectRow?: (row: T) => void
  isLoading?: boolean
  emptyMessage?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-1.5 pr-2 font-medium ${col.align === "right" ? "text-right" : ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={columns.length} className="py-4 text-center text-muted-foreground">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-4 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
          {!isLoading &&
            rows.map((row) => {
              const key = rowKey(row)
              return (
                <tr
                  key={key}
                  onClick={() => onSelectRow?.(row)}
                  className={`border-b border-border last:border-b-0 ${
                    onSelectRow ? "cursor-pointer hover:bg-muted/50" : ""
                  } ${selectedRowKey === key ? "bg-muted/50" : ""}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-1.5 pr-2 ${col.align === "right" ? "text-right font-mono" : ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}