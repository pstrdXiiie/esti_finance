"use client"

import { use, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { employeeLoanSpec } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface EmployeeLoanDoc {
  name: string
  loan_balance?: number
  closed?: number
}

interface RecordLoanPaymentResult {
  payment: string
  loan_balance: number
  closed: number
}

interface LoanPaymentRow {
  name: string
  payment_date: string
  detail?: string
  amount: number
  balance_after?: number
  reference_no?: string
}

const PAYMENT_DETAILS = ["Principal", "Interest", "Other"] as const

export default function EmployeeLoanEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    <div className="grid gap-6">
      <EntryScreen spec={employeeLoanSpec} name={docName} basePath="/personnel/loans" />
      {docName && <RecordPaymentPanel name={docName} />}
      {docName && <PaymentHistoryTable name={docName} />}
    </div>
  )
}

/**
 * Bespoke panel alongside the generic EntryScreen: recording a payment is a
 * whitelisted business-rule call (record_loan_payment fully recomputes
 * loan_balance from the SMS Loan Payment ledger — never increments a cached
 * value), not plain field editing. Shares the same [doctype, name] query key
 * EntryScreen uses internally for its own `doc` fetch — same free-ride
 * reasoning as finance/assessments' AssessmentActions.
 */
function RecordPaymentPanel({ name }: { name: string }) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState("")
  const [detail, setDetail] = useState<string>("Principal")

  const { data: doc, isLoading } = useQuery({
    queryKey: [employeeLoanSpec.doctype, name],
    queryFn: () => frappe.getDoc<EmployeeLoanDoc>(employeeLoanSpec.doctype, name),
  })

  const paymentMutation = useMutation({
    mutationFn: () =>
      frappe.call<RecordLoanPaymentResult>("campus_erp.api.personnel.record_loan_payment", {
        employee_loan: name,
        amount: Number(amount),
        detail,
      }),
    onSuccess: (result) => {
      toast.success(`Payment recorded. Loan balance: ${result.loan_balance}`)
      setAmount("")
      queryClient.invalidateQueries({ queryKey: [employeeLoanSpec.doctype, name] })
      queryClient.invalidateQueries({ queryKey: ["SMS Loan Payment", "list", name] })
    },
    onError: (error) => toast.error(`Could not record payment: ${getErrorMessage(error)}`),
  })

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }
  if (!doc) {
    return null
  }

  return (
    <>
      <Separator />
      <div className="grid gap-3 rounded-md border p-4">
        <h2 className="font-semibold">Record Payment</h2>
        <p className="text-sm text-muted-foreground">
          Current loan balance: {doc.loan_balance ?? 0}
          {doc.closed ? " — closed" : ""}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Amount</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              className="w-40"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Detail</label>
            <Select value={detail} onValueChange={(value) => setDetail(value ?? "Principal")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_DETAILS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={!amount || Number(amount) <= 0 || !!doc.closed || paymentMutation.isPending}
            onClick={() => paymentMutation.mutate()}
          >
            {paymentMutation.isPending ? "Recording…" : "Record Payment"}
          </Button>
        </div>
      </div>
    </>
  )
}

/** Read-only ledger of this loan's SMS Loan Payment rows — no edit actions. */
function PaymentHistoryTable({ name }: { name: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["SMS Loan Payment", "list", name],
    queryFn: () =>
      frappe.list<LoanPaymentRow>("SMS Loan Payment", {
        filters: { employee_loan: name },
        fields: ["name", "payment_date", "detail", "amount", "balance_after", "reference_no"],
        order_by: "payment_date desc",
        limit_page_length: 100,
      }),
  })

  return (
    <div className="grid gap-2">
      <h2 className="font-semibold">Payment History</h2>
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance After</TableHead>
                <TableHead>Reference No</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((row) => (
                <TableRow key={row.name}>
                  <TableCell>{row.payment_date}</TableCell>
                  <TableCell>{row.detail ?? ""}</TableCell>
                  <TableCell>{row.amount}</TableCell>
                  <TableCell>{row.balance_after ?? ""}</TableCell>
                  <TableCell>{row.reference_no ?? ""}</TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
