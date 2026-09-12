"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { employeeLoanSpec } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import { EmployeeSearchField } from "@/components/ui/personnel/EmployeeSearchField"
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

interface EmployeeLoanDoc extends Record<string, unknown> {
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
const listColumns = employeeLoanSpec.fields.filter((f) => f.inListView)

/**
 * Bespoke — replaces the generic EntryScreen. employeeLoanSpec isn't
 * submittable, so unlike LoanApplicationEntry.tsx there's no Workflow
 * Actions section here; RecordPaymentPanel/PaymentHistoryTable are moved
 * over unchanged from the old personnel/loans/[name]/page.tsx (recording a
 * payment is a whitelisted business-rule call, not plain field editing —
 * record_loan_payment fully recomputes loan_balance from the SMS Loan
 * Payment ledger).
 *
 * Same docName-optional pattern as LoanApplicationEntry.tsx: renders as the
 * Loans-tab landing view (docName undefined) or the per-record editor at
 * its own URL.
 */
export function LoanApplicationsPanel({ docName }: { docName?: string }) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: doc, isLoading } = useQuery({
    queryKey: [employeeLoanSpec.doctype, docName],
    queryFn: () => frappe.getDoc<EmployeeLoanDoc>(employeeLoanSpec.doctype, docName!),
    enabled: !!docName,
  })

  const recentQuery = useQuery({
    queryKey: [employeeLoanSpec.doctype, "list"],
    queryFn: () =>
      frappe.list<Record<string, unknown>>(employeeLoanSpec.doctype, {
        fields: ["name", ...employeeLoanSpec.fields.map((f) => f.fieldname)],
        order_by: "modified desc",
        limit_page_length: 20,
      }),
  })

  const form = useForm<Record<string, unknown>>({
    defaultValues: doc ?? {},
    values: doc,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      docName
        ? frappe.updateDoc(employeeLoanSpec.doctype, docName, values)
        : frappe.createDoc(employeeLoanSpec.doctype, values),
    onSuccess: (saved) => {
      toast.success(`${employeeLoanSpec.title} saved`)
      queryClient.invalidateQueries({ queryKey: [employeeLoanSpec.doctype] })
      if (!docName) {
        const newName = (saved as { name?: string } | undefined)?.name
        if (newName) {
          router.push(`/personnel/loans/${encodeURIComponent(newName)}`)
        }
      }
    },
    onError: (error) =>
      toast.error(`Could not save ${employeeLoanSpec.title}: ${getErrorMessage(error)}`),
  })

  if (docName && isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <div className="grid gap-6 w-full">
      <div className="w-full rounded-2xl border border-border p-7">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            className="grid gap-6"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {employeeLoanSpec.fields.map((f) =>
                f.fieldname === "employee" ? (
                  <EmployeeSearchField key={f.fieldname} control={form.control} label={f.label} idPrefix={f.fieldname} />
                ) : (
                  <DynamicField key={f.fieldname} control={form.control} spec={f} />
                )
              )}
            </div>
            <Button type="submit" className="w-fit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </Form>

        {docName && <RecordPaymentPanel name={docName} />}
      </div>

      {docName && <PaymentHistoryTable name={docName} />}

      <div className="w-full">
        <h2 className="text-lg font-semibold mb-3">Recent Employee Loans</h2>
        {recentQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {listColumns.map((c) => (
                    <TableHead key={c.fieldname}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentQuery.data ?? []).map((row) => (
                  <TableRow
                    key={String(row.name)}
                    className={
                      docName && String(row.name) === docName
                        ? "bg-muted/50"
                        : "cursor-pointer hover:bg-muted/30"
                    }
                    onClick={() => {
                      if (docName && String(row.name) === docName) return
                      router.push(`/personnel/loans/${encodeURIComponent(String(row.name))}`)
                    }}
                  >
                    {listColumns.map((c) => (
                      <TableCell key={c.fieldname}>{String(row[c.fieldname] ?? "")}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {(recentQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={listColumns.length} className="text-muted-foreground text-center">
                      No employee loans yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Moved unchanged from the old personnel/loans/[name]/page.tsx. Shares the
 * same [doctype, name] query key EmployeeLoanEntry uses for its own `doc`
 * fetch — same free-ride reasoning as finance/assessments' AssessmentActions.
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
      <Separator className="my-6" />
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

/** Moved unchanged from the old route file. Read-only ledger, no edit actions. */
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
    <div className="w-full grid gap-2">
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
