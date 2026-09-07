"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StudentOption } from "@/components/sms/StudentSearch"

interface MiscItem {
  particular: string
  amount: number
}

interface ExtraItem {
  particular: string
  amount: number
}

interface Assessment {
  name: string
  docstatus: number
  status: string
  student: string
  student_name: string
  program_enrollment: string
  program: string
  school_year: string
  school_term: string
  semester: number
  year_level: string
  posting_date: string
  tuition: number
  tuition_rate: number
  total_units: number
  misc_fee: number
  misc_fee_header: string | null
  misc_items: MiscItem[]
  other_fee: number
  extra_items: ExtraItem[]
  assessment: number
  discount_type: string | null
  discount_percent: number
  tuition_discount: number
  misc_discount: number
  new_tuition: number
  total_fee: number
  payment: number
  receivable: number
  payment_mode: "Cash" | "Installment"
  installment_months: number
  auto_enrollment: {
    enrolled: Array<{ subject: string; student_group: string }>
    skipped: Array<{ subject: string; reason: string }>
    failed: Array<{ subject: string; reason: string }>
  } | null
}

interface MiscHeaderOption {
  name: string
  particular: string
}

interface DiscountOption {
  name: string
  discount_code: string
  description: string
}

interface MiscHeaderDoc {
  name: string
  details: MiscItem[]
}

function formatCurrency(value: number): string {
  return (value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

export default function AssessmentDialog({
  open,
  onOpenChange,
  preEnrollmentName,
  student,
  program,
  academicYearLabel,
  semester,
  yearLevel,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preEnrollmentName: string
  student: StudentOption
  program: string
  academicYearLabel: string
  semester: number
  yearLevel: number
  onSaved?: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const assessmentQuery = useQuery({
    queryKey: ["SMS Student Assessment", "for-pre-enrollment", preEnrollmentName],
    queryFn: () =>
      frappe.call<Assessment>("campus_erp.api.finance_billing.get_or_create_assessment", {
        pre_enrollment: preEnrollmentName,
      }),
    enabled: open,
  })

  const assessment = assessmentQuery.data

  const miscHeadersQuery = useQuery({
    queryKey: ["SMS Fee Header", "list", "Miscellaneous"],
    queryFn: () =>
      frappe.list<MiscHeaderOption>("SMS Fee Header", {
        filters: [["code_type", "=", "Miscellaneous"]],
        fields: ["name", "particular"],
        order_by: "particular asc",
        limit_page_length: 500,
      }),
    enabled: open,
  })

  const [miscHeader, setMiscHeader] = useState("")
  const [checkedParticulars, setCheckedParticulars] = useState<Set<string>>(new Set())
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Installment">("Cash")
  const [installmentMonths, setInstallmentMonths] = useState("1")
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([])
  const [newExtraParticular, setNewExtraParticular] = useState("")
  const [newExtraAmount, setNewExtraAmount] = useState("")
  const [discountType, setDiscountType] = useState("")

  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  if (assessment && assessment.name !== syncedName) {
    setSyncedName(assessment.name)
    setMiscHeader(assessment.misc_fee_header || "")
    setPaymentMode(assessment.payment_mode || "Cash")
    setInstallmentMonths(String(assessment.installment_months || 1))
    setExtraItems(assessment.extra_items)
    setDiscountType(assessment.discount_type || "")
  }

  const discountsQuery = useQuery({
    queryKey: ["SMS Discount", "list", "active"],
    queryFn: () =>
      frappe.list<DiscountOption>("SMS Discount", {
        filters: [["is_disabled", "=", 0]],
        fields: ["name", "discount_code", "description"],
        order_by: "discount_code asc",
        limit_page_length: 500,
      }),
    enabled: open,
  })

  function handleAddExtraItem() {
    const particular = newExtraParticular.trim()
    const amount = Number(newExtraAmount)
    if (!particular || !newExtraAmount || Number.isNaN(amount)) return
    setExtraItems((prev) => [...prev, { particular, amount }])
    setNewExtraParticular("")
    setNewExtraAmount("")
  }

  function removeExtraItem(index: number) {
    setExtraItems((prev) => prev.filter((_, i) => i !== index))
  }

  const headerDetailQuery = useQuery({
    queryKey: ["SMS Fee Header", "detail", miscHeader],
    queryFn: () => frappe.getDoc<MiscHeaderDoc>("SMS Fee Header", miscHeader),
    enabled: open && !!miscHeader,
  })

  // Re-derive the checked set whenever a (possibly new) header's Detail rows
  // arrive: if this is the header the assessment was already saved with,
  // restore exactly the previously-checked particulars; otherwise (the
  // registrar just picked a different header from the dropdown) default to
  // every row checked, same as a brand-new assessment starts.
  const [syncedHeaderKey, setSyncedHeaderKey] = useState<string | undefined>(undefined)
  const headerKey = assessment ? `${assessment.name}:${miscHeader}` : undefined
  if (assessment && headerDetailQuery.data && headerKey !== syncedHeaderKey) {
    setSyncedHeaderKey(headerKey)
    const isPersistedHeader = miscHeader === assessment.misc_fee_header
    const persisted = new Set(assessment.misc_items.map((i) => i.particular))
    setCheckedParticulars(
      new Set(
        headerDetailQuery.data.details
          .filter((row) => (isPersistedHeader ? persisted.has(row.particular) : true))
          .map((row) => row.particular)
      )
    )
  }

  const detailRows = headerDetailQuery.data?.details ?? []
  const checkedRows = detailRows.filter((row) => checkedParticulars.has(row.particular))
  const miscFeeTotal = checkedRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const tuition = assessment?.tuition ?? 0

  const discountPreviewQuery = useQuery({
    queryKey: ["compute_discount", discountType, tuition, miscFeeTotal],
    queryFn: () =>
      frappe.call<{ tuition_discount: number; misc_discount: number }>(
        "campus_erp.api.finance_billing.compute_discount",
        { discount_code: discountType, tuition, misc_fee: miscFeeTotal }
      ),
    enabled: open && !!discountType,
  })
  const tuitionDiscount = discountType ? discountPreviewQuery.data?.tuition_discount ?? 0 : 0
  const miscDiscountAmount = discountType ? discountPreviewQuery.data?.misc_discount ?? 0 : 0

  const extraFeeTotal = extraItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const previewTotal = tuition + miscFeeTotal + extraFeeTotal - tuitionDiscount - miscDiscountAmount
  const months = Math.max(1, Number(installmentMonths) || 1)
  const perInstallment = previewTotal / months

  const toggleRow = (particular: string, checked: boolean) => {
    setCheckedParticulars((prev) => {
      const next = new Set(prev)
      if (checked) next.add(particular)
      else next.delete(particular)
      return next
    })
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      frappe.call<Assessment>("campus_erp.api.finance_billing.save_assessment", {
        name: assessment!.name,
        misc_fee_header: miscHeader || null,
        misc_items: checkedRows.map((row) => ({ particular: row.particular, amount: row.amount })),
        extra_items: extraItems,
        discount_type: discountType || null,
        payment_mode: paymentMode,
        installment_months: months,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(
        ["SMS Student Assessment", "for-pre-enrollment", preEnrollmentName],
        result
      )
      toast.success("Assessment saved and submitted — ready for payment under Cash Receipt")
      const autoEnrollment = result.auto_enrollment
      if (autoEnrollment && autoEnrollment.enrolled.length > 0) {
        const count = autoEnrollment.enrolled.length
        toast.success(`Enrolled in ${count} class${count === 1 ? "" : "es"} from prescribed subjects`)
      }
      if (autoEnrollment) {
        const needsAttention = autoEnrollment.skipped.length + autoEnrollment.failed.length
        if (needsAttention > 0) {
          toast.info(
            `${needsAttention} prescribed subject${needsAttention === 1 ? "" : "s"} could not be auto-enrolled — see Add/Remove Subjects`
          )
        }
      }
      onSaved?.()
      onOpenChange(false)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assessment</DialogTitle>
        </DialogHeader>

        {assessmentQuery.isLoading && (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        )}

        {assessment && (
          <div className="grid gap-5">
            <section className="grid gap-3">
              <h3 className="text-sm font-semibold">Student Info</h3>
              <div className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-3">
                <Field label="Student No.">
                  <div className="text-sm font-medium">{student.stdnt_cno || "—"}</div>
                </Field>
                <Field label="Student Name">
                  <div className="text-sm font-medium">{student.student_name}</div>
                </Field>
                <Field label="Program">
                  <div className="text-sm font-medium">{program}</div>
                </Field>
                <Field label="School Year">
                  <div className="text-sm font-medium">{academicYearLabel}</div>
                </Field>
                <Field label="Semester">
                  <div className="text-sm font-medium">{semester}</div>
                </Field>
                <Field label="Year Level">
                  <div className="text-sm font-medium">{yearLevel}</div>
                </Field>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 items-baseline">
              <div className="grid gap-3 content-start">
                <section className="grid gap-3 rounded-md border p-3 min-h-0 items-baseline">
                  <h3 className="text-sm font-semibold">Miscellaneous</h3>
                  <Field label="Header">
                    <Select value={miscHeader} onValueChange={(v) => setMiscHeader(v ?? "")}>
                      <SelectTrigger className="w-full">
                        {/* SelectValue's automatic value->label lookup doesn't
                            resolve here since the item list loads async after
                            mount, so the label is passed explicitly instead of
                            falling back to the raw doc name. */}
                        <SelectValue placeholder="Select a header…">
                          {(miscHeadersQuery.data ?? []).find((h) => h.name === miscHeader)?.particular}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(miscHeadersQuery.data ?? []).map((h) => (
                          <SelectItem key={h.name} value={h.name}>
                            {h.particular}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="max-h-[220px] min-h-0 overflow-y-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b">
                          <th className="w-8 p-2" />
                          <th className="p-2 text-left font-medium">Particular</th>
                          <th className="p-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {headerDetailQuery.isFetching && (
                          <tr>
                            <td colSpan={3} className="p-3 text-center text-muted-foreground">
                              Loading…
                            </td>
                          </tr>
                        )}
                        {!headerDetailQuery.isFetching && !miscHeader && (
                          <tr>
                            <td colSpan={3} className="p-3 text-center text-muted-foreground">
                              Select a header to list its fees.
                            </td>
                          </tr>
                        )}
                        {!headerDetailQuery.isFetching && miscHeader && detailRows.length === 0 && (
                          <tr>
                            <td colSpan={3} className="p-3 text-center text-muted-foreground">
                              No fees under this header.
                            </td>
                          </tr>
                        )}
                        {!headerDetailQuery.isFetching &&
                          detailRows.map((row) => (
                            <tr key={row.particular} className="border-b last:border-b-0">
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={checkedParticulars.has(row.particular)}
                                  onChange={(e) => toggleRow(row.particular, e.target.checked)}
                                  aria-label={`Include ${row.particular}`}
                                />
                              </td>
                              <td className="p-2">{row.particular}</td>
                              <td className="p-2 text-right">{formatCurrency(row.amount)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Miscellaneous Fee</span>
                    <span className="font-semibold">₱{formatCurrency(miscFeeTotal)}</span>
                  </div>
                </section>

                <section className="grid gap-3 rounded-md border p-3">
                  <h3 className="text-sm font-semibold">Discount</h3>
                  <Field label="Discount Code">
                    <Select value={discountType} onValueChange={(v) => setDiscountType(v ?? "")}>
                      <SelectTrigger className="w-full">
                        {/* Same async value->label caveat as the Miscellaneous
                            header Select above: the list loads after mount, so
                            the label is resolved explicitly here. */}
                        <SelectValue placeholder="No discount">
                          {discountType
                            ? (discountsQuery.data ?? []).find((d) => d.name === discountType)?.discount_code
                            : "No discount"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No discount</SelectItem>
                        {(discountsQuery.data ?? []).map((d) => (
                          <SelectItem key={d.name} value={d.name}>
                            {d.discount_code} — {d.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {discountType && (
                    <div className="grid gap-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tuition Discount</span>
                        <span className="font-semibold">−₱{formatCurrency(tuitionDiscount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Misc Fee Discount</span>
                        <span className="font-semibold">−₱{formatCurrency(miscDiscountAmount)}</span>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <section className="grid gap-3 rounded-md border p-3 content-start">
                <h3 className="text-sm font-semibold">Assessment Fees</h3>
                <Field label="Tuition Fee">
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                    ₱{formatCurrency(tuition)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {assessment.total_units} unit{assessment.total_units === 1 ? "" : "s"} × ₱
                    {formatCurrency(assessment.tuition_rate)} per unit (rate set in Finance &gt;
                    Maintenance &gt; Tuition Fee for {program}).
                  </p>
                </Field>

                <section className="grid gap-3 rounded-md border p-3">
                  <h4 className="text-sm font-semibold">Additional Fees</h4>
                  <div className="max-h-[160px] min-h-0 overflow-y-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b">
                          <th className="p-2 text-left font-medium">Particular</th>
                          <th className="p-2 text-right font-medium">Amount</th>
                          <th className="w-8 p-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {extraItems.length === 0 && (
                          <tr>
                            <td colSpan={3} className="p-3 text-center text-muted-foreground">
                              No additional fees.
                            </td>
                          </tr>
                        )}
                        {extraItems.map((item, index) => (
                          <tr key={`${item.particular}-${index}`} className="border-b last:border-b-0">
                            <td className="p-2">{item.particular}</td>
                            <td className="p-2 text-right">{formatCurrency(item.amount)}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => removeExtraItem(index)}
                                aria-label={`Remove ${item.particular}`}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Particular">
                      <Input
                        placeholder="e.g. Back Subject"
                        className="w-40"
                        value={newExtraParticular}
                        onChange={(e) => setNewExtraParticular(e.target.value)}
                      />
                    </Field>
                    <Field label="Amount">
                      <Input
                        type="number"
                        className="w-28"
                        value={newExtraAmount}
                        onChange={(e) => setNewExtraAmount(e.target.value)}
                      />
                    </Field>
                    <Button type="button" variant="outline" disabled={!newExtraParticular.trim() || !newExtraAmount} onClick={handleAddExtraItem}>
                      Add
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Additional Fees Total</span>
                    <span className="font-semibold">₱{formatCurrency(extraFeeTotal)}</span>
                  </div>
                </section>

                <section className="grid gap-3 rounded-md border p-3">
                  <h4 className="text-sm font-semibold">Payment Option</h4>
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Cash or Installment">
                      <Select
                        value={paymentMode}
                        onValueChange={(v) => setPaymentMode((v as "Cash" | "Installment") ?? "Cash")}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Installment">Installment</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    {paymentMode === "Installment" && (
                      <Field label="No. of Months">
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={installmentMonths}
                          onChange={(e) => setInstallmentMonths(e.target.value)}
                        />
                      </Field>
                    )}
                  </div>
                  {paymentMode === "Installment" && (
                    <div className="text-sm text-muted-foreground">
                      ≈ ₱{formatCurrency(perInstallment)} / month for {months} month{months === 1 ? "" : "s"}
                    </div>
                  )}
                </section>
              </section>
            </div>

            <section className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total Fees</span>
                <span className="text-xl font-bold">₱{formatCurrency(previewTotal)}</span>
              </div>
            </section>
          </div>
        )}

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={!assessment}
            onClick={() => router.push(`/finance/assessments/${assessment!.name}`)}
          >
            View Full Assessment
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={!assessment || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
