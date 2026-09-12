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
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500">
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
              <td colSpan={columns.length} className="py-4 text-center text-zinc-500">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-4 text-center text-zinc-500">
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
                  className={`border-b border-zinc-100 last:border-b-0 ${
                    onSelectRow ? "cursor-pointer hover:bg-zinc-50" : ""
                  } ${selectedRowKey === key ? "bg-zinc-50" : ""}`}
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
