import type { ReactNode } from "react"

export function FinancePageShell({
  title,
  subtitle,
  status,
  children,
  actions,
}: {
  title: string
  subtitle?: string
  status?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
        <div>
          <p className="text-base font-semibold text-gray-900">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {status && (
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
            {status}
          </span>
        )}
      </div>

      <div className="grid gap-5 px-6 py-5">{children}</div>

      {actions && (
        <div className="flex justify-end gap-2 rounded-b-lg border-t border-gray-200 bg-gray-50 px-6 py-4">
          {actions}
        </div>
      )}
    </div>
  )
}

export function FinanceDivider() {
  return <div className="-mx-6 border-t border-gray-200" />
}

export function FinanceSectionHeader({
  title,
  right,
}: {
  title: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[13px] font-semibold text-gray-900">{title}</p>
      {right}
    </div>
  )
}
