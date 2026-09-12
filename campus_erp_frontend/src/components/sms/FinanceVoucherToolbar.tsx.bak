"use client"

import type { LucideIcon } from "lucide-react"
import { XCircle } from "lucide-react"

export interface FinanceToolbarAction {
  key: string
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}

/**
 * Legacy-style icon action bar (Save/Delete/Print/Find, etc.) with a
 * separated red Exit action on the right — matches the toolbar shown
 * across the VB-era voucher screens (Accounts Payable, and likely the
 * other voucher_entry screens once ported).
 */
export function FinanceVoucherToolbar({
  actions,
  onExit,
  exitLabel = "Exit",
}: {
  actions: FinanceToolbarAction[]
  onExit?: () => void
  exitLabel?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex gap-1">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className="flex flex-col items-center gap-1 rounded px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            <action.icon className="h-5 w-5" />
            {action.label}
          </button>
        ))}
      </div>
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="flex flex-col items-center gap-1 rounded px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
        >
          <XCircle className="h-5 w-5" />
          {exitLabel}
        </button>
      )}
    </div>
  )
}
