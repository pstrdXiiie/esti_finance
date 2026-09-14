import Link from "next/link"
import {
  ArrowUpRight,
  UserCheck,
  Building2,
  Receipt,
  FileText,
  FileCheck2,
  ShoppingBag,
  PackageCheck,
  Clock,
  BadgeCheck,
  BookOpen,
  Coins,
  Store,
  LucideIcon,
} from "lucide-react"

type Item = {
  title: string
  href: string
  width?: string
  height?: string
  icon: LucideIcon
  badgeBg: string
  glowBg: string
  hoverBorder: string
  iconColor: string
}

const GROUPS: Array<{ category: string; items: Item[] }> = [
  {
    category: "Accounts & Cash",
    items: [
      {
        title: "Student Account",
        href: "/finance/transactions/student_acc",
        width: "sm:col-span-2",
        height: "min-h-[160px]",
        icon: UserCheck,
        badgeBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white",
        glowBg: "bg-blue-500/15 group-hover:bg-blue-500/35",
        hoverBorder: "hover:border-blue-500/50",
        iconColor: "text-blue-600",
      },
      {
        title: "Sundry Account",
        href: "/finance/transactions/sundry_acc",
        icon: Building2,
        badgeBg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white",
        glowBg: "bg-cyan-500/15 group-hover:bg-cyan-500/35",
        hoverBorder: "hover:border-cyan-500/50",
        iconColor: "text-cyan-600",
      },
      {
        title: "Payments / Cash Receipt Entry",
        href: "/finance/transactions/payments_cash_entry",
        icon: Receipt,
        badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white",
        glowBg: "bg-emerald-500/15 group-hover:bg-emerald-500/35",
        hoverBorder: "hover:border-emerald-500/50",
        iconColor: "text-emerald-600",
      },
    ],
  },
  {
    category: "Procurement",
    items: [
      {
        title: "Purchase Requisition",
        href: "/finance/transactions/purchase_requisition",
        icon: FileText,
        badgeBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white",
        glowBg: "bg-violet-500/15 group-hover:bg-violet-500/35",
        hoverBorder: "hover:border-violet-500/50",
        iconColor: "text-violet-600",
      },
      {
        title: "Purchase Requisition Approval",
        href: "/finance/transactions/purchase_requisition_approval",
        width: "sm:col-span-2",
        height: "min-h-[160px]",
        icon: FileCheck2,
        badgeBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white",
        glowBg: "bg-indigo-500/15 group-hover:bg-indigo-500/35",
        hoverBorder: "hover:border-indigo-500/50",
        iconColor: "text-indigo-600",
      },
      {
        title: "Purchase Order",
        href: "/finance/transactions/purchase_order",
        icon: ShoppingBag,
        badgeBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white",
        glowBg: "bg-purple-500/15 group-hover:bg-purple-500/35",
        hoverBorder: "hover:border-purple-500/50",
        iconColor: "text-purple-600",
      },
      {
        title: "Purchase Order Receiving",
        href: "/finance/transactions/purchase_order_receiving",
        icon: PackageCheck,
        badgeBg: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 group-hover:bg-fuchsia-600 group-hover:text-white",
        glowBg: "bg-fuchsia-500/15 group-hover:bg-fuchsia-500/35",
        hoverBorder: "hover:border-fuchsia-500/50",
        iconColor: "text-fuchsia-600",
      },
      {
        title: "Due Purchase Order Payable",
        href: "/finance/transactions/due_purchase_order_payables",
        icon: Clock,
        badgeBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white",
        glowBg: "bg-rose-500/15 group-hover:bg-rose-500/35",
        hoverBorder: "hover:border-rose-500/50",
        iconColor: "text-rose-600",
      },
    ],
  },
  {
    category: "Vouchers",
    items: [
      {
        title: "Cheque Voucher Entry",
        href: "/finance/transactions/cheque_voucher_entry",
        width: "sm:col-span-2",
        height: "min-h-[160px]",
        icon: BadgeCheck,
        badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white",
        glowBg: "bg-amber-500/15 group-hover:bg-amber-500/35",
        hoverBorder: "hover:border-amber-500/50",
        iconColor: "text-amber-600",
      },
      {
        title: "Journal Voucher Entry",
        href: "/finance/transactions/journal_voucher_entry",
        icon: BookOpen,
        badgeBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white",
        glowBg: "bg-orange-500/15 group-hover:bg-orange-500/35",
        hoverBorder: "hover:border-orange-500/50",
        iconColor: "text-orange-600",
      },
      {
        title: "Petty Cash Voucher Entry",
        href: "/finance/transactions/petty_cash_entry",
        icon: Coins,
        badgeBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:bg-teal-600 group-hover:text-white",
        glowBg: "bg-teal-500/15 group-hover:bg-teal-500/35",
        hoverBorder: "hover:border-teal-500/50",
        iconColor: "text-teal-600",
      },
      {
        title: "Petty Cash Canteen Entry",
        href: "/finance/canteen-pcv/new",
        width: "sm:col-span-2",
        height: "min-h-[160px]",
        icon: Store,
        badgeBg: "bg-lime-500/10 text-lime-600 dark:text-lime-400 group-hover:bg-lime-600 group-hover:text-white",
        glowBg: "bg-lime-500/15 group-hover:bg-lime-500/35",
        hoverBorder: "hover:border-lime-500/50",
        iconColor: "text-lime-600",
      },
    ],
  },
]

export default function TransactionsPage() {
  return (
    <div className="grid gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a transaction type below.
        </p>
      </div>

      {/* Groups */}
      {GROUPS.map((group) => (
        <div key={group.category} className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.category}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                    item.hoverBorder
                  } ${item.width ?? ""} ${item.height ?? "min-h-[110px]"}`}
                >
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    {/* Top Row: Icon badge + Arrow */}
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-300 ${item.badgeBg}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                    </div>

                    {/* Bottom Title */}
                    <span className="text-sm font-medium leading-snug text-foreground transition-colors duration-300 group-hover:text-foreground">
                      {item.title}
                    </span>
                  </div>

                  {/* Soft Background Radial Glow */}
                  <div
                    className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-xl transition-all duration-500 group-hover:scale-150 ${item.glowBg}`}
                  />
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}