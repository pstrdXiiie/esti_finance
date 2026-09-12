"use client"

import { useEffect, useState, type ReactNode, type ChangeEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useController, useForm, type Control } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { employeeSpec } from "@/lib/forms/personnel"
import { computePayrollFields } from "@/lib/payroll"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trash2Icon } from "lucide-react"

type EmployeeDoc = Record<string, string>

/**
 * Department is the one field of employeeSpec.fields rendered by hand
 * instead of via DynamicField: its options come from a live query against
 * "SMS Personnel Departments" (see the useQuery below), not a static
 * "\n"-joined options string the way every other Select field on this spec
 * works, so DynamicField's generic Select branch can't drive it. Wired to
 * the same react-hook-form `control` as everything else via useController
 * so it behaves like any other field in the form (tracked, submitted,
 * reset on reload) rather than living in parallel state.
 */
function DepartmentField({
  control,
  label,
  departments,
}: {
  control: Control<Record<string, unknown>>
  label: string
  departments: Array<{ name: string; department: string | null }>
}) {
  const { field } = useController({ control, name: "department", defaultValue: "" })

  return (
    <div className="grid gap-1.5">
      <label htmlFor="info-department">{label}</label>
      <Select value={(field.value as string) ?? ""} onValueChange={(v) => field.onChange(v ?? "")}>
        <SelectTrigger id="info-department" className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {/*
            Personnel Info.department stores the department's DISPLAY NAME
            (e.g. "Human Resources"), not the SMS Personnel Departments
            record's own docname (an auto-generated id) — match/key on
            d.department, not d.name, or a saved value never matches any
            option. Skip any department record missing its name.
          */}
          {departments
            .filter((d): d is { name: string; department: string } => !!d.department)
            .map((d) => (
              <SelectItem key={d.name} value={d.department}>
                {d.department}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

/**
 * `infractions` is a CONFIRMED real Table field on Personnel Info
 * (-> SMS Personnel Infractions — see 05-PERSONNEL-IMPLEMENTATION-PLAN.md
 * §0/§row 60), so it already comes back in the same frappe.getDoc() call
 * this component makes for Info/Payroll — no new read-side backend work.
 *
 * UNCONFIRMED: SMS Personnel Infractions' own field names. There is no
 * `add_infraction` RPC anywhere in campus_erp/api/, and no bench-console
 * dump of this child doctype's meta the way gross_pay/etc. were confirmed
 * for Personnel Info itself. The four fields below are a best guess,
 * matching the naming convention of the sibling Education/Seminar child
 * tables (violation_date/violation/action_taken/remarks) — confirm via
 * `bench --site education.localhost console` -> frappe.get_meta("SMS
 * Personnel Infractions") and rename here if it differs before relying on
 * this for real records.
 */
interface InfractionRow {
  name?: string
  violation_date?: string
  violation?: string
  action_taken?: string
  remarks?: string
}

const EMPTY_INFRACTION_ROW: InfractionRow = {
  violation_date: "",
  violation: "",
  action_taken: "",
  remarks: "",
}

/**
 * `employee` on SMS Employee Benefit now correctly points at Personnel Info
 * (see the personnel.ts fix — options: "Employee" -> "Personnel Info"),
 * confirmed safe since all five affected doctypes had zero existing records
 * to migrate. Filtering this list by docName is on solid ground.
 */
interface EmployeeBenefitRow {
  name: string
  amount?: number
  benefit_date?: string
  available_fund?: number
  consumed_fund?: number
  docstatus?: number
}

/**
 * `employee` on SMS Employee Loan now correctly points at Personnel Info —
 * same fix, same confirmation, as EmployeeBenefitRow above (all five
 * affected specs were rewired together in the same pass, and all five had
 * zero existing records to migrate). The "wrong fieldname" guess flagged
 * in the original implementation plan turned out to be moot: it was never
 * a fieldname problem, it was the doctype the Link pointed at.
 */
interface EmployeeLoanRow {
  name: string
  loan_type?: string
  amount?: number
  loan_balance?: number
  closed?: number
}

/**
 * `leaves` is a child table on Personnel Info itself — confirmed since
 * add_leave_application/list_recent_leaves in campus_erp/api/personnel.py
 * read/write this table directly on the Personnel Info doc. It's already
 * present in `data` (the same getDoc call backing Info/Payroll/Violations/
 * Benefits above), so — like `infractions` — no separate fetch is needed.
 */
interface EmployeeLeaveRow {
  name?: string
  leave_type?: string
  from_date?: string
  to_date?: string
  status?: string
  days_approved?: number
}

/**
 * CONFIRMED against the real `Personnel Info` DocType via
 * `bench --site education.localhost console` -> frappe.get_meta("Personnel Info").
 * All fourteen fields below are genuine `Int` fields on that DocType.
 * (Previous guesses `basic_pay` and `night_differential_rate` do not exist;
 * `overtime_rate` was a wrong name for the real `reg_ot_per_hour`.)
 *
 * `computed` marks fields whose values are derived from Gross Pay by
 * campus_erp's payroll rules (src/lib/payroll.ts's computePayrollFields) —
 * these get filled in by the "Compute" button below rather than typed by
 * hand, though they stay editable so HR can override a specific case.
 */
const PAYROLL_FIELDS: { fieldname: string; label: string; computed?: boolean }[] = [
  { fieldname: "gross_pay", label: "Gross Pay" },
  { fieldname: "allowance", label: "Allowance" },
  { fieldname: "reg_rate_pre_hour", label: "Regular Rate / Hour", computed: true },
  { fieldname: "reg_ot_per_hour", label: "Regular OT / Hour", computed: true },
  { fieldname: "sunday_rate_per_hour", label: "Sunday Rate / Hour", computed: true },
  { fieldname: "sunday_ot_per_hour", label: "Sunday OT / Hour", computed: true },
  { fieldname: "holiday_rate_per_hour", label: "Holiday Rate / Hour", computed: true },
  { fieldname: "holiday_ot_per_hour", label: "Holiday OT / Hour", computed: true },
  { fieldname: "late_rate_per_hour", label: "Late Rate / Hour", computed: true },
  { fieldname: "undertime_rate_per_hour", label: "Undertime Rate / Hour", computed: true },
  { fieldname: "with_holding_tax", label: "Withholding Tax", computed: true },
  { fieldname: "sss_deduction", label: "SSS Deduction", computed: true },
  { fieldname: "philhealth_deduction", label: "PhilHealth Deduction", computed: true },
  { fieldname: "pagibig_deduction", label: "Pag-IBIG Deduction", computed: true },
]

interface EmployeeDetailTabsProps {
  docName: string
  basePath: string
}

export function EmployeeDetailTabs({ docName, basePath }: EmployeeDetailTabsProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: [employeeSpec.doctype, docName],
    queryFn: () => frappe.getDoc<EmployeeDoc>(employeeSpec.doctype, docName),
  })

  const infoForm = useForm<Record<string, unknown>>({
    defaultValues: data ?? {},
    values: data,
  })
  const [payroll, setPayroll] = useState<EmployeeDoc>({})
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string>("")

  useEffect(() => {
    if (!data) return
    setPayroll(data)
    // Don't stomp an unsaved local pick when this re-runs after a save
    // (queryClient invalidation refetches `data`).
    setProfilePreviewUrl((prev) => (prev.startsWith("blob:") ? prev : data.profile ?? ""))
  }, [data])

  // Same deferred-upload pattern as EmployeeWizard.tsx / registrar's Add
  // Student page — stage locally, upload inside the mutation on Save.
  function handleProfileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileFile(file)
    setProfilePreviewUrl((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  // department is now a Link field (options: "SMS Personnel Departments").
  // Fetch the live list instead of parsing a baked-in choice string — same
  // query shape as DepartmentMaintenance.tsx.
  const { data: departments } = useQuery({
    queryKey: ["SMS Personnel Departments", "list", "employee-detail-tabs"],
    queryFn: () =>
      frappe.list<{ name: string; department: string | null }>("SMS Personnel Departments", {
        fields: ["name", "department"],
        order_by: "department asc",
        limit_page_length: 500,
      }),
  })

  const infoMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload: Record<string, unknown> = { ...values }
      if (profileFile) {
        const uploaded = await frappe.uploadFile(profileFile, { isPrivate: true })
        payload.profile = uploaded.file_url
      }
      return frappe.updateDoc(employeeSpec.doctype, docName, payload)
    },
    onSuccess: async () => {
      toast.success("Employee info saved")
      setProfileFile(null)
      await queryClient.invalidateQueries({ queryKey: [employeeSpec.doctype] })
    },
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  const payrollMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {}
      for (const f of PAYROLL_FIELDS) payload[f.fieldname] = payroll[f.fieldname]
      return frappe.updateDoc(employeeSpec.doctype, docName, payload)
    },
    onSuccess: () => toast.success("Payroll info saved"),
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  // infractions rides in on the same Personnel Info doc `data` already
  // holds (it's a real child-table field, see InfractionRow's comment) —
  // no separate fetch needed to read it.
  const infractions = ((data as unknown as { infractions?: InfractionRow[] } | undefined)
    ?.infractions ?? []) as InfractionRow[]
  const [newViolation, setNewViolation] = useState<InfractionRow>(EMPTY_INFRACTION_ROW)

  // Same "no bespoke RPC" shape used everywhere else in this app for a
  // Table field with nothing to call (see ChildTableGrid/EntryScreen and
  // this component's own payrollMutation above): send the whole child
  // table array back through a plain updateDoc on the parent doc.
  const addViolationMutation = useMutation({
    mutationFn: () =>
      frappe.updateDoc(employeeSpec.doctype, docName, {
        infractions: [...infractions, newViolation],
      }),
    onSuccess: async () => {
      toast.success("Violation recorded")
      setNewViolation(EMPTY_INFRACTION_ROW)
      await queryClient.invalidateQueries({ queryKey: [employeeSpec.doctype, docName] })
    },
    onError: (error) => toast.error(`Could not record violation: ${getErrorMessage(error)}`),
  })

  const employeeBenefitsQuery = useQuery({
    queryKey: ["SMS Employee Benefit", "list", "by-employee", docName],
    queryFn: () =>
      frappe.list<EmployeeBenefitRow>("SMS Employee Benefit", {
        filters: { employee: docName },
        fields: ["name", "amount", "benefit_date", "available_fund", "consumed_fund", "docstatus"],
        order_by: "benefit_date desc",
        limit_page_length: 20,
      }),
  })

  // Confirmed-good now that all five specs (Loan Application, Employee
  // Loan, Employee Benefit, Overtime, Travel Order) point their `employee`
  // Link at Personnel Info instead of ERPNext's stock Employee doctype —
  // this filter matches docName correctly rather than silently returning
  // nothing.
  const employeeLoansQuery = useQuery({
    queryKey: ["SMS Employee Loan", "list", "by-employee", docName],
    queryFn: () =>
      frappe.list<EmployeeLoanRow>("SMS Employee Loan", {
        filters: { employee: docName },
        fields: ["name", "loan_type", "amount", "loan_balance", "closed"],
        order_by: "modified desc",
        limit_page_length: 20,
      }),
  })

  // Free ride on the same getDoc call `infractions` already uses above —
  // `leaves` is a child table directly on this Personnel Info doc, no
  // separate network request needed.
  const leaves = ((data as unknown as { leaves?: EmployeeLeaveRow[] } | undefined)?.leaves ??
    []) as EmployeeLeaveRow[]

  const deleteViolationMutation = useMutation({
    mutationFn: (index: number) =>
      frappe.updateDoc(employeeSpec.doctype, docName, {
        infractions: infractions.filter((_, i) => i !== index),
      }),
    onSuccess: async () => {
      toast.success("Violation removed")
      await queryClient.invalidateQueries({ queryKey: [employeeSpec.doctype, docName] })
    },
    onError: (error) => toast.error(`Could not remove violation: ${getErrorMessage(error)}`),
  })

  const canAddViolation =
    !!newViolation.violation_date && !!newViolation.violation && !addViolationMutation.isPending

  /**
   * Runs Gross Pay through the shared payroll module (src/lib/payroll.ts)
   * and writes every derived field back into local `payroll` state. This
   * is a pure client-side calculation — nothing is persisted until the
   * regular "Save" button below is pressed — mirroring the "Compute Terms"
   * button on Loan Applications (personnel/loan-applications/[name]),
   * which computes into the same react-hook-form instance without saving.
   */
  function handleComputePayroll() {
    const result = computePayrollFields(payroll.gross_pay)
    setPayroll((prev) => ({
      ...prev,
      sss_deduction: String(result.sss_deduction),
      philhealth_deduction: String(result.philhealth_deduction),
      pagibig_deduction: String(result.pagibig_deduction),
      with_holding_tax: String(result.with_holding_tax),
      reg_rate_pre_hour: String(result.reg_rate_pre_hour),
      reg_ot_per_hour: String(result.reg_ot_per_hour),
      sunday_rate_per_hour: String(result.sunday_rate_per_hour),
      sunday_ot_per_hour: String(result.sunday_ot_per_hour),
      holiday_rate_per_hour: String(result.holiday_rate_per_hour),
      holiday_ot_per_hour: String(result.holiday_ot_per_hour),
      late_rate_per_hour: String(result.late_rate_per_hour),
      undertime_rate_per_hour: String(result.undertime_rate_per_hour),
    }))
    toast.success("Payroll fields computed from Gross Pay — review, then Save")
  }

  const grossPayEntered = Number(payroll.gross_pay) > 0

  if (isLoading || !data) {
    return <div className="rounded-2xl border border-border p-7">Loading…</div>
  }

  return (
    <div className="rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">
          {data.first_name} {data.last_name}
        </h1>
        <Button type="button" variant="outline" size="sm" onClick={() => router.push(basePath)}>
          Back
        </Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="violations">Violation List</TabsTrigger>
          <TabsTrigger value="loans-leave">Loan/Leave</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="pt-4">
          <Form {...infoForm}>
            <form onSubmit={infoForm.handleSubmit((values) => infoMutation.mutate(values))}>
              <div className="flex gap-4 items-start pb-4">
                <label
                  htmlFor="info-profile"
                  className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-muted text-[10px] text-muted-foreground"
                >
                  {profilePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePreviewUrl} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    "No Photo"
                  )}
                  <input
                    id="info-profile"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileChange}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {employeeSpec.fields.map((f) =>
                  f.fieldname === "department" ? (
                    <DepartmentField
                      key={f.fieldname}
                      control={infoForm.control}
                      label={f.label}
                      departments={departments ?? []}
                    />
                  ) : (
                    <DynamicField key={f.fieldname} control={infoForm.control} spec={f} />
                  )
                )}
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={infoMutation.isPending}>
                  {infoMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="payroll" className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {PAYROLL_FIELDS.filter((f) => !f.computed).map((f) => (
              <Field key={f.fieldname} id={`payroll-${f.fieldname}`} label={f.label}>
                <Input
                  id={`payroll-${f.fieldname}`}
                  type="number"
                  value={payroll[f.fieldname] ?? ""}
                  onChange={(e) => setPayroll((prev) => ({ ...prev, [f.fieldname]: e.target.value }))}
                />
              </Field>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              disabled={!grossPayEntered}
              onClick={handleComputePayroll}
            >
              Compute from Gross Pay
            </Button>
            {!grossPayEntered && (
              <p className="text-sm text-muted-foreground">Enter Gross Pay first.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-4">
            <p className="col-span-full text-sm font-medium text-muted-foreground">
              Computed — filled in by &quot;Compute from Gross Pay&quot;, still editable for a
              manual override before Save.
            </p>
            {PAYROLL_FIELDS.filter((f) => f.computed).map((f) => (
              <Field key={f.fieldname} id={`payroll-${f.fieldname}`} label={f.label}>
                <Input
                  id={`payroll-${f.fieldname}`}
                  type="number"
                  value={payroll[f.fieldname] ?? ""}
                  onChange={(e) => setPayroll((prev) => ({ ...prev, [f.fieldname]: e.target.value }))}
                />
              </Field>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <Button type="button" disabled={payrollMutation.isPending} onClick={() => payrollMutation.mutate()}>
              {payrollMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="violations" className="pt-4 grid gap-5">
          <div className="grid gap-2">
            <h2 className="font-semibold">Violation History</h2>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Violation</TableHead>
                    <TableHead>Action Taken</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {infractions.map((row, i) => (
                    <TableRow key={row.name ?? i}>
                      <TableCell>{row.violation_date ?? ""}</TableCell>
                      <TableCell>{row.violation ?? ""}</TableCell>
                      <TableCell>{row.action_taken ?? ""}</TableCell>
                      <TableCell>{row.remarks ?? ""}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Remove violation"
                          disabled={deleteViolationMutation.isPending}
                          onClick={() => deleteViolationMutation.mutate(i)}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {infractions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        No violations on record.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border p-4">
            <h2 className="font-semibold">Record a Violation</h2>
            <p className="text-sm text-muted-foreground">
              Field names here are a best guess pending confirmation against SMS Personnel
              Infractions&apos; real schema — see the InfractionRow comment in this file.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="violation-date" label="Date">
                <Input
                  id="violation-date"
                  type="date"
                  value={newViolation.violation_date ?? ""}
                  onChange={(e) =>
                    setNewViolation((prev) => ({ ...prev, violation_date: e.target.value }))
                  }
                />
              </Field>
              <Field id="violation-type" label="Violation">
                <Input
                  id="violation-type"
                  value={newViolation.violation ?? ""}
                  onChange={(e) => setNewViolation((prev) => ({ ...prev, violation: e.target.value }))}
                />
              </Field>
              <Field id="violation-action" label="Action Taken">
                <Input
                  id="violation-action"
                  value={newViolation.action_taken ?? ""}
                  onChange={(e) =>
                    setNewViolation((prev) => ({ ...prev, action_taken: e.target.value }))
                  }
                />
              </Field>
              <Field id="violation-remarks" label="Remarks">
                <Input
                  id="violation-remarks"
                  value={newViolation.remarks ?? ""}
                  onChange={(e) => setNewViolation((prev) => ({ ...prev, remarks: e.target.value }))}
                />
              </Field>
            </div>
            <Button
              type="button"
              className="w-fit"
              disabled={!canAddViolation}
              onClick={() => addViolationMutation.mutate()}
            >
              {addViolationMutation.isPending ? "Saving…" : "Add Violation"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="loans-leave" className="pt-4 grid gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Loan &amp; Leave History</h2>
            <Link
              href="/administration/approvals"
              className="text-sm font-medium text-muted-foreground hover:underline"
            >
              View Pending Approvals →
            </Link>
          </div>

          <div className="grid gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Employee Loans</h3>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan</TableHead>
                    <TableHead>Loan Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeLoansQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : (employeeLoansQuery.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        No loans on record.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (employeeLoansQuery.data ?? []).map((loan) => (
                      <TableRow key={loan.name}>
                        <TableCell>
                          <Link
                            href={`/personnel/loans/${encodeURIComponent(loan.name)}`}
                            className="font-medium hover:underline"
                          >
                            {loan.name}
                          </Link>
                        </TableCell>
                        <TableCell>{loan.loan_type ?? ""}</TableCell>
                        <TableCell>{loan.amount ?? ""}</TableCell>
                        <TableCell>{loan.loan_balance ?? ""}</TableCell>
                        <TableCell>{loan.closed ? "Closed" : "Active"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Leave Applications</h3>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Days Approved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        No leave applications on record.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaves.map((row, i) => (
                      <TableRow key={row.name ?? i}>
                        <TableCell>{row.leave_type ?? ""}</TableCell>
                        <TableCell>{row.from_date ?? ""}</TableCell>
                        <TableCell>{row.to_date ?? ""}</TableCell>
                        <TableCell>{row.status ?? ""}</TableCell>
                        <TableCell>{row.days_approved ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="benefits" className="pt-4 grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Employee Benefits</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push(`/personnel/benefits/new?employee=${encodeURIComponent(docName)}`)}
            >
              Add Benefit
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benefit</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Available Fund</TableHead>
                  <TableHead>Consumed Fund</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeBenefitsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : (employeeBenefitsQuery.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      No benefits on record.
                    </TableCell>
                  </TableRow>
                ) : (
                  (employeeBenefitsQuery.data ?? []).map((benefit) => (
                    <TableRow key={benefit.name}>
                      <TableCell>
                        <Link
                          href={`/personnel/benefits/${encodeURIComponent(benefit.name)}`}
                          className="font-medium hover:underline"
                        >
                          {benefit.name}
                        </Link>
                      </TableCell>
                      <TableCell>{benefit.benefit_date ?? ""}</TableCell>
                      <TableCell>{benefit.amount ?? ""}</TableCell>
                      <TableCell>{benefit.available_fund ?? ""}</TableCell>
                      <TableCell>{benefit.consumed_fund ?? ""}</TableCell>
                      <TableCell>{benefit.docstatus === 1 ? "Submitted" : "Draft"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}