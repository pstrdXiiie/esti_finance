"use client"

import { useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { formatAcademicYearLabel } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import StudentSearch, { StudentOption } from "@/components/sms/StudentSearch"

interface AssessmentRow {
  name: string
  program: string
  school_year: string
  school_term: string
  semester: number
  docstatus: number
  total_fee: number
  payment: number
  receivable: number
  receivable_account: string | null
}

type ModeOfPayment = "Cash" | "Cheque"

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function formatCurrency(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * "Payments / Cash Receipt Entry" (Finance > Transactions): find a student's
 * submitted assessment and record a payment against it — a student-search
 * driven front end for the already-built
 * campus_erp.api.finance_billing.record_payment. Only "from Assessment"
 * payments are wired up; the legacy screen's "other than Assessment" option
 * has no equivalent business rule yet, so it's shown but disabled rather
 * than silently accepting input that goes nowhere.
 *
 * `initialStudentName` pre-selects a student (looked up once, then applied
 * the same "adjust state during render" way as this app's other
 * auto-default fields) — the Pre-Enrollment screen's "Go to Payment" button
 * deep-links here with it once an assessment is submitted, so the cashier
 * isn't stuck re-searching for the same student they were just looking at.
 */
export default function PaymentsCashReceipt({
  initialStudentName,
}: {
  initialStudentName?: string
} = {}) {
  const queryClient = useQueryClient()

  const [student, setStudent] = useState<StudentOption | null>(null)
  const [selectedAssessment, setSelectedAssessment] = useState("")
  const [paymentMode, setPaymentMode] = useState<"assessment" | "other">("assessment")
  const [accountCharged, setAccountCharged] = useState("")
  const [amount, setAmount] = useState("")
  const [modeOfPayment, setModeOfPayment] = useState<ModeOfPayment>("Cash")
  const [referenceNo, setReferenceNo] = useState("")
  const [lastOrNumber, setLastOrNumber] = useState<string | null>(null)

  const [appliedInitialStudent, setAppliedInitialStudent] = useState(false)
  const initialStudentQuery = useQuery({
    queryKey: ["Student", "get", initialStudentName],
    queryFn: () =>
      frappe.list<StudentOption>("Student", {
        filters: [["name", "=", initialStudentName!]],
        fields: ["name", "student_name", "stdnt_cno"],
        limit_page_length: 1,
      }),
    enabled: !!initialStudentName && !appliedInitialStudent,
  })
  if (!appliedInitialStudent && initialStudentQuery.isFetched) {
    setAppliedInitialStudent(true)
    if (initialStudentQuery.data?.[0]) setStudent(initialStudentQuery.data[0])
  }

  const assessmentsQuery = useQuery({
    queryKey: ["SMS Student Assessment", "for-payment", student?.name],
    queryFn: () =>
      frappe.list<AssessmentRow>("SMS Student Assessment", {
        filters: [
          ["student", "=", student!.name],
          ["docstatus", "!=", 2],
        ],
        fields: [
          "name",
          "program",
          "school_year",
          "school_term",
          "semester",
          "docstatus",
          "total_fee",
          "payment",
          "receivable",
          "receivable_account",
        ],
        order_by: "posting_date desc",
        limit_page_length: 20,
      }),
    enabled: !!student,
  })

  const assessments = assessmentsQuery.data ?? []

  const accountsQuery = useQuery({
    queryKey: ["Account", "leaf", "for-payment"],
    queryFn: () =>
      frappe.list<{ name: string }>("Account", {
        fields: ["name"],
        filters: [["is_group", "=", 0]],
        limit_page_length: 500,
      }),
  })
  const accounts = accountsQuery.data ?? []

  const [syncedStudentForAssessment, setSyncedStudentForAssessment] = useState<string | undefined>(undefined)
  if (student && student.name !== syncedStudentForAssessment && assessmentsQuery.isFetched) {
    setSyncedStudentForAssessment(student.name)
    setSelectedAssessment(assessments[0]?.name ?? "")
    setLastOrNumber(null)
  }

  const assessment = assessments.find((a) => a.name === selectedAssessment) ?? null
  const canPay =
    paymentMode === "assessment"
      ? !!assessment && assessment.docstatus === 1
      : !!student && !!accountCharged

  function resetForNewPayment() {
    setStudent(null)
    setSelectedAssessment("")
    setAmount("")
    setModeOfPayment("Cash")
    setReferenceNo("")
    setLastOrNumber(null)
    setPaymentMode("assessment")
    setAccountCharged("")
  }

  const paymentMutation = useMutation({
    mutationFn: () =>
      paymentMode === "assessment"
        ? frappe.call<{ payment_entry: string; assessment_payment: number; assessment_receivable: number }>(
            "campus_erp.api.finance_billing.record_payment",
            {
              assessment: assessment!.name,
              amount: Number(amount),
              mode_of_payment: modeOfPayment,
              reference_no: referenceNo || undefined,
            }
          )
        : frappe.call<{ payment_entry: string }>(
            "campus_erp.api.finance_billing.record_payment_other_than_assessment",
            {
              student: student!.name,
              account_charged: accountCharged,
              amount: Number(amount),
              mode_of_payment: modeOfPayment,
              reference_no: referenceNo || undefined,
            }
          ),
    onSuccess: async (result) => {
      toast.success(`Payment recorded — OR# ${result.payment_entry}`)
      setLastOrNumber(result.payment_entry)
      setAmount("")
      setReferenceNo("")
      await queryClient.invalidateQueries({ queryKey: ["SMS Student Assessment", "for-payment", student?.name] })
    },
    onError: (error) => toast.error(`Could not record payment: ${getErrorMessage(error)}`),
  })

  const canSave = canPay && !!amount && Number(amount) > 0 && !paymentMutation.isPending

  return (
    <div className="rounded-2xl border border-border h-full p-6 flex flex-col gap-5 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <h2 className="text-lg font-semibold">Cash Receipt Transaction</h2>
        <Button type="button" variant="outline" onClick={resetForNewPayment}>
          New Payment
        </Button>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            className="h-4 w-4"
            checked={paymentMode === "assessment"}
            onChange={() => setPaymentMode("assessment")}
          />
          Student Payment (From Assessment)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            className="h-4 w-4"
            checked={paymentMode === "other"}
            onChange={() => setPaymentMode("other")}
          />
          Student Payment (Other than Assessment)
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
        <Field label="Student">
          <StudentSearch selected={student} onSelect={setStudent} idPrefix="cash-receipt" />
        </Field>

        {paymentMode === "assessment" && assessments.length > 1 && (
          <Field label="Assessment (School Year - Semester)">
            <Select value={selectedAssessment} onValueChange={(v) => setSelectedAssessment(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an assessment…" />
              </SelectTrigger>
              <SelectContent>
                {assessments.map((a) => (
                  <SelectItem key={a.name} value={a.name}>
                    {a.school_term} {a.docstatus === 0 ? "(Draft)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      {paymentMode === "assessment" && student && assessmentsQuery.isFetching && (
        <div className="text-sm text-muted-foreground">Loading…</div>
      )}

      {paymentMode === "assessment" && student && !assessmentsQuery.isFetching && assessments.length === 0 && (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          {student.student_name} has no assessment on record yet — prescribe classes and create an
          assessment first (Registrar &gt; Enrollment &gt; Pre-Enrollment).
        </div>
      )}

      {paymentMode === "assessment" && assessment && assessment.docstatus === 0 && (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          This assessment hasn&apos;t been submitted yet — submit it under Finance &gt; Student
          Assessments before recording a payment.
        </div>
      )}

      {paymentMode === "assessment" ? (
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl rounded-md border p-4">
          <Field label="Course">
            <div className="text-sm font-medium">{assessment?.program ?? "—"}</div>
          </Field>
          <Field label="School Year / Semester">
            <div className="text-sm font-medium">
              {assessment
                ? `${formatAcademicYearLabel(assessment.school_year)} — Sem ${assessment.semester}`
                : "—"}
            </div>
          </Field>
          <Field label="Assessment">
            <div className="text-sm font-medium">₱{formatCurrency(assessment?.total_fee)}</div>
          </Field>
          <Field label="Total Payments">
            <div className="text-sm font-medium">₱{formatCurrency(assessment?.payment)}</div>
          </Field>
          <Field label="Payment Due (Balance)">
            <div className="text-sm font-semibold">₱{formatCurrency(assessment?.receivable)}</div>
          </Field>
          <Field label="Account Charged">
            <div className="text-sm font-medium">{assessment?.receivable_account || "—"}</div>
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl rounded-md border p-4">
          <Field label="Account Charged">
            <Select value={accountCharged} onValueChange={(v) => setAccountCharged(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an account…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.name} value={a.name}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <div className="grid gap-4 max-w-3xl">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="OR #">
            <Input value={lastOrNumber ?? "Auto Generated"} disabled className="text-muted-foreground" />
          </Field>
          <Field label="Date">
            <Input value={new Date().toLocaleDateString()} disabled className="text-muted-foreground" />
          </Field>
          <Field label="Amount">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              disabled={!canPay}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Reference No.">
            <Input
              placeholder="Cheque no., etc."
              value={referenceNo}
              disabled={!canPay}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </Field>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-xs text-muted-foreground mb-1">Mode of Payment</legend>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                className="h-4 w-4"
                checked={modeOfPayment === "Cash"}
                disabled={!canPay}
                onChange={() => setModeOfPayment("Cash")}
              />
              Cash
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                className="h-4 w-4"
                checked={modeOfPayment === "Cheque"}
                disabled={!canPay}
                onChange={() => setModeOfPayment("Cheque")}
              />
              Cheque
            </label>
          </div>
        </fieldset>

        <div>
          <Button type="button" disabled={!canSave} onClick={() => paymentMutation.mutate()}>
            {paymentMutation.isPending ? "Saving…" : "Save Payment"}
          </Button>
        </div>
      </div>
    </div>
  )
}
