"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

export interface TransactionListWithFormProps {
  /** Panel heading, shown at the top left. */
  title: string
  /** Toggle button label while the form is closed, e.g. "Add Purchase Order". */
  addLabel: string
  isFormOpen: boolean
  /**
   * Called when the single toggle button is pressed, in either direction.
   * The caller decides what "closing" means for its own draft state (e.g.
   * reset the draft before calling closeForm) — this component only renders
   * the button and flips its label/variant, it never touches form state itself.
   */
  onToggle: () => void
  /** Rendered before the toggle button (e.g. a refresh/filter control). Optional. */
  actions?: ReactNode
  /** Rendered directly above `table`, only while the form is open. */
  form: ReactNode
  /** Always rendered, below the (optional, currently-visible) form. */
  table: ReactNode
}

/**
 * Presentational show/hide chrome for an "inline create" list screen: a title
 * on the left, an optional actions slot plus a single toggle button on the
 * right, a form slot rendered above a table slot only while open, and the
 * table slot always rendered below. Knows nothing about what a "Purchase
 * Requisition" or "Purchase Order" is — form/table/actions are opaque ReactNode
 * render props supplied by the caller, so this component stays fully generic
 * and reusable across every module panel.
 */
export function TransactionListWithForm({
  title,
  addLabel,
  isFormOpen,
  onToggle,
  actions,
  form,
  table,
}: TransactionListWithFormProps) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <div className="flex items-center gap-2">
          {actions}
          <Button
            type="button"
            variant={isFormOpen ? "outline" : "default"}
            onClick={onToggle}
            aria-expanded={isFormOpen}
          >
            {isFormOpen ? "Cancel" : addLabel}
          </Button>
        </div>
      </div>
      {isFormOpen ? <div className="grid gap-4">{form}</div> : null}
      {table}
    </div>
  )
}
