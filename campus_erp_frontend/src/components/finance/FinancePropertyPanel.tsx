import type { ReactNode } from "react"
import { financeAccentDot, financePrimaryButton, financeSecondaryButton } from "@/lib/finance-ui"

export function FinancePropertyPanel({
  title,
  onCancel,
  onSave,
  saveLabel = "Save",
  isSaving,
  children,
}: {
  title: string
  onCancel?: () => void
  onSave?: () => void
  saveLabel?: string
  isSaving?: boolean
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <span className={financeAccentDot} />
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        {(onCancel || onSave) && (
          <div className="flex gap-1.5">
            {onCancel && (
              <button type="button" className={financeSecondaryButton} onClick={onCancel}>
                Cancel
              </button>
            )}
            {onSave && (
              <button type="button" className={financePrimaryButton} onClick={onSave} disabled={isSaving}>
                {isSaving ? "Saving…" : saveLabel}
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export function FinancePropertyRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center border-b border-border px-5 py-2.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function FinancePropertySection({
  title,
  right,
  children,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="border-t border-border px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}
