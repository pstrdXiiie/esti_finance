import Link from "next/link"
import { ArrowUpRight, Scale, Receipt, ClipboardList, HandCoins, Users } from "lucide-react"

export default function FinancialReportPage() {
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Financial Reports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a report below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/finance/financialreport/trial_balance"
          className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/50 min-h-[110px]"
        >
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                <Scale className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
            </div>
            <span className="text-sm font-medium leading-snug text-foreground transition-colors duration-300">
              Trial Balance
            </span>
          </div>
        </Link>

        <Link
          href="/finance/financialreport/collection_for_the_period"
          className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/50 dark:border-zinc-800 dark:bg-zinc-950 min-h-[110px]"
        >
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 transition-colors duration-300 group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                <Receipt className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
            </div>
            <span className="text-sm font-medium leading-snug text-zinc-900 transition-colors duration-300 group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-white">
              Collection for the Period
            </span>
          </div>
        </Link>

        <Link
          href="/finance/financialreport/assessment_for_the_period"
          className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/50 dark:border-zinc-800 dark:bg-zinc-950 min-h-[110px]"
        >
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 transition-colors duration-300 group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                <ClipboardList className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
            </div>
            <span className="text-sm font-medium leading-snug text-zinc-900 transition-colors duration-300 group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-white">
              Assessment for the Period
            </span>
          </div>
        </Link>

        <Link
          href="/finance/financialreport/tuition_fee_receivables"
          className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/50 dark:border-zinc-800 dark:bg-zinc-950 min-h-[110px]"
        >
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 transition-colors duration-300 group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                <HandCoins className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
            </div>
            <span className="text-sm font-medium leading-snug text-zinc-900 transition-colors duration-300 group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-white">
              Tuition Fee Receivables
            </span>
          </div>
        </Link>
                <Link
          href="/finance/financialreport/subsidiary_reports"
          className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/50 dark:border-zinc-800 dark:bg-zinc-950 min-h-[110px]"
        >
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 transition-colors duration-300 group-hover:bg-blue-600 group-hover:text-white dark:text-blue-400">
                <Users className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
            </div>
            <span className="text-sm font-medium leading-snug text-zinc-900 transition-colors duration-300 group-hover:text-zinc-950 dark:text-zinc-100 dark:group-hover:text-white">
              Subsidiary Reports
            </span>
          </div>
        </Link>
      </div>
    </div>
  )
}