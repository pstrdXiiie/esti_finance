import Link from "next/link"
import {
  ArrowUpRight,
  UserCheck,
  Building2,
  Receipt,
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
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
      },
      {
        title: "Sundry Account",
        href: "/finance/transactions/sundry_acc",
        icon: Building2,
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
      },
      {
        title: "Payments / Cash Receipt Entry",
        href: "/finance/transactions/payments_cash_entry",
        icon: Receipt,
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
      },
    ],
  },
  {
    category: "Procurement",
    items: [
      {
        // Entry form and approval table live on one page now -- see
        // src/components/ui/finance/transactions/purchase-requisition/.
        title: "Purchase Requisition",
        href: "/finance/transactions/purchase_requisition",
        width: "sm:col-span-2",
        height: "min-h-[160px]",
        icon: FileCheck2,
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
      },
      {
        title: "Purchase Order",
        href: "/finance/transactions/purchase_order",
        icon: ShoppingBag,
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
      },
      {
        title: "Purchase Order Receiving",
        href: "/finance/transactions/purchase_order_receiving",
        icon: PackageCheck,
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
      },
      {
        title: "Due Purchase Order Payable",
        href: "/finance/transactions/due_purchase_order_payables",
        icon: Clock,
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
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
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
      },
      {
        title: "Journal Voucher Entry",
        href: "/finance/transactions/journal_voucher_entry",
        icon: BookOpen,
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
      },
      {
        title: "Petty Cash Voucher Entry",
        href: "/finance/transactions/petty_cash_entry",
        icon: Coins,
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
      },
      {
        title: "Petty Cash Canteen Entry",
        href: "/finance/canteen-pcv/new",
        width: "sm:col-span-2",
        height: "min-h-[160px]",
        icon: Store,
        badgeBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        glowBg: "bg-primary/15 group-hover:bg-primary/35",
        hoverBorder: "hover:border-primary/50",
        iconColor: "text-primary",
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