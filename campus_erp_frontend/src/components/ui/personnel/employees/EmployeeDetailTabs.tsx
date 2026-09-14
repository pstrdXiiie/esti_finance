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

// Option lists mirrored from EmployeeWizard.tsx's Step 0 — kept identical
// so Add and Edit never disagree about what a valid value looks like.
const EMPLOYEE_STATUS_OPTIONS = ["Contractual", "Part Timer", "Probationary", "Regular"]
const WORK_STATUS_OPTIONS = ["In Active", "Active", "Executive", "Consultant"]
const GENDER_OPTIONS = ["Male", "Female", "Others"]
const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed", "Separated"]
const NATIONALITY_OPTIONS = ["Filipino", "American"]

/**
 * Department is the one field of employeeSpec.fields rendered by hand
 * instead of via a plain Input/register: its options come from a live
 * query against "SMS Personnel Departments" (see the useQuery below), not
 * a static list. Wired to the same react-hook-form `control` as everything
 * else via useController so it behaves like any other field in the form
 * (tracked, submitted, reset on reload) rather than living in parallel
 * state.
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
            Personnel Info.department is a Link field to SMS Personnel
            Departments, so it must store that doctype's actual docname
            (d.name), not the human-readable label — matching
            EmployeeWizard.tsx's Select. Storing d.department here breaks
            Link validation on save (backend rejects any value that isn't
            a real docname) and also breaks re-selecting the current value
            when editing an existing employee.
          */}
          {departments.map((d) => (
            <SelectItem key={d.name} value={d.name}>
              {d.department ?? d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Position is the same shape as DepartmentField above: a Link field to
 * "SMS Personnel Position", so its options come from a live query rather
 * than a static list, and it must store the target doctype's docname
 * (p.name), not the human-readable position_name — same Link-validation
 * reasoning as DepartmentField's comment.
 */
function PositionField({
  control,
  label,
  positions,
}: {
  control: Control<Record<string, unknown>>
  label: string
  positions: Array<{ name: string; position_name: string | null }>
}) {
  const { field } = useController({ control, name: "position", defaultValue: "" })

  return (
    <div className="grid gap-1.5">
      <label htmlFor="info-position">{label}</label>
      <Select value={(field.value as string) ?? ""} onValueChange={(v) => field.onChange(v ?? "")}>
        <SelectTrigger id="info-position" className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {positions.map((p) => (
            <SelectItem key={p.name} value={p.name}>
              {p.position_name ?? p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Generic Select bound to react-hook-form via useController, for the
 * plain static-option Select fields (Gender, Marital Status, etc.) —
 * same option lists and behavior as EmployeeWizard.tsx's Step 0. */
function SelectField({
  control,
  name,
  id,
  label,
  options,
}: {
  control: Control<Record<string, unknown>>
  name: string
  id: string
  label: string
  options: string[]
}) {
  const { field } = useController({ control, name, defaultValue: "" })
  return (
    <Field id={id} label={label}>
      <Select value={(field.value as string) ?? ""} onValueChange={(v) => field.onChange(v ?? "")}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
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

/** Check-type fields (paid_holiday, leave_credits, etc.) come back from
 * getDoc as 0/1, not booleans — check against 1 or "1" so an existing
 * saved value renders correctly, and always write back a plain 1/0 so the
 * payload matches what the backend's Check fieldtype expects. */
function CheckboxField({
  control,
  name,
  id,
  label,
}: {
  control: Control<Record<string, unknown>>
  name: string
  id: string
  label: string
}) {
  const { field } = useController({ control, name, defaultValue: 0 })
  const checked = field.value === 1 || field.value === "1" || field.value === true
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => field.onChange(e.target.checked ? 1 : 0)}
        className="h-4 w-4 rounded border-border"
      />
      {label}
    </label>
  )
}

/**
 * Native <fieldset>/<legend> so the divider line is the fieldset's own
 * border — it automatically spans full width and breaks around the legend
 * text, unlike a manually-drawn line which gets cut off by its container.
 */
function Section({
  title,
  children,
  wide = false,
}: {
  title: string
  children: ReactNode
  /** Set true for sections in the wide left column, which have room for
   * up to 4 fields per row. Narrow sidebar sections (e.g. Employment
   * Details, in the 260px column) stay single-column. */
  wide?: boolean
}) {
  return (
    <fieldset className="col-span-full rounded-md border border-border px-4 pb-4 pt-2 mt-3 first:mt-0">
      <legend className="px-2 text-sm font-medium text-muted-foreground">{title}</legend>
      <div className={`grid gap-3 ${wide ? "sm:grid-cols-2 md:grid-cols-4" : ""}`}>{children}</div>
    </fieldset>
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

  // position is a Link field (options: "SMS Personnel Position"). Fetch the
  // live list the same way departments is fetched above — same query shape,
  // just a different doctype/label field.
  const { data: positions } = useQuery({
    queryKey: ["SMS Personnel Position", "list", "employee-detail-tabs"],
    queryFn: () =>
      frappe.list<{ name: string; position_name: string | null }>("SMS Personnel Position", {
        fields: ["name", "position_name"],
        order_by: "position_name asc",
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

        {/* Info tab: mirrors EmployeeWizard.tsx's Step 0 layout exactly —
            same two-column grid (fields left, photo + Employment Details
            sidebar right), same section groupings and option lists — just
            bound to infoForm (this doc's own react-hook-form instance)
            instead of the Wizard's local `form` state. */}
        <TabsContent value="info" className="pt-4">
          <Form {...infoForm}>
            <form onSubmit={infoForm.handleSubmit((values) => infoMutation.mutate(values))}>
              <div className="grid gap-6 md:grid-cols-[1fr_260px]">
                <div className="grid gap-3">
                  <Section title="System Identification" wide>
                    <Field id="info-employee-id" label="Employee ID">
                      <Input id="info-employee-id" {...infoForm.register("employee_id")} />
                    </Field>
                    <Field id="info-rfid" label="RFID">
                      <Input id="info-rfid" {...infoForm.register("rfid")} />
                    </Field>
                  </Section>

                  <Section title="Personal Information" wide>
                    <Field id="info-first-name" label="First Name">
                      <Input id="info-first-name" {...infoForm.register("first_name")} />
                    </Field>
                    <Field id="info-middle-name" label="Middle Name">
                      <Input id="info-middle-name" {...infoForm.register("middle_name")} />
                    </Field>
                    <Field id="info-last-name" label="Last Name">
                      <Input id="info-last-name" {...infoForm.register("last_name")} />
                    </Field>
                    <Field id="info-title" label="Title">
                      <Input id="info-title" {...infoForm.register("title")} />
                    </Field>
                    <Field id="info-birthdate" label="Birthdate">
                      <Input id="info-birthdate" type="date" {...infoForm.register("birthdate")} />
                    </Field>
                    <SelectField
                      control={infoForm.control}
                      name="gender"
                      id="info-gender"
                      label="Gender"
                      options={GENDER_OPTIONS}
                    />
                    <Field id="info-num-dependents" label="Number of Dependents">
                      <Input id="info-num-dependents" type="number" {...infoForm.register("number_of_dependents")} />
                    </Field>
                    <SelectField
                      control={infoForm.control}
                      name="marital_status"
                      id="info-marital-status"
                      label="Marital Status"
                      options={MARITAL_STATUS_OPTIONS}
                    />
                    <SelectField
                      control={infoForm.control}
                      name="nationality"
                      id="info-nationality"
                      label="Nationality"
                      options={NATIONALITY_OPTIONS}
                    />
                    <Field id="info-religion" label="Religion">
                      <Input id="info-religion" {...infoForm.register("religion")} />
                    </Field>
                  </Section>

                  <Section title="Contact & Location" wide>
                    <Field id="info-contact-number" label="Contact Number">
                      <Input id="info-contact-number" {...infoForm.register("contact_number")} />
                    </Field>
                    <Field id="info-birthplace" label="Birthplace">
                      <Input id="info-birthplace" {...infoForm.register("birthplace")} />
                    </Field>
                    <Field id="info-mailing-address" label="Mailing Address">
                      <Input id="info-mailing-address" {...infoForm.register("mailing_address")} />
                    </Field>
                  </Section>

                  <Section title="Government IDs" wide>
                    <Field id="info-tin-number" label="TIN Number">
                      <Input id="info-tin-number" {...infoForm.register("tin_number")} />
                    </Field>
                    <Field id="info-sss-number" label="SSS Number">
                      <Input id="info-sss-number" {...infoForm.register("sss_number")} />
                    </Field>
                    <Field id="info-philhealth" label="PhilHealth">
                      <Input id="info-philhealth" {...infoForm.register("philhealth")} />
                    </Field>
                    <Field id="info-pag-ibig" label="Pag-IBIG">
                      <Input id="info-pag-ibig" {...infoForm.register("pag_ibig")} />
                    </Field>
                  </Section>
                </div>

                <div className="flex flex-col gap-5">
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Profile Photo</p>
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

                  <Section title="Employment Details">
                    <SelectField
                      control={infoForm.control}
                      name="employee_status"
                      id="info-employee-status"
                      label="Employee Status"
                      options={EMPLOYEE_STATUS_OPTIONS}
                    />
                    <Field id="info-date-hired" label="Date Hired">
                      <Input id="info-date-hired" type="date" {...infoForm.register("date_hired")} />
                    </Field>
                    <DepartmentField control={infoForm.control} label="Department" departments={departments ?? []} />
                    <PositionField control={infoForm.control} label="Position" positions={positions ?? []} />
                    <SelectField
                      control={infoForm.control}
                      name="work_status"
                      id="info-work-status"
                      label="Work Status"
                      options={WORK_STATUS_OPTIONS}
                    />
                  </Section>
                </div>
              </div>

              {/* Fields on employeeSpec that aren't part of the Wizard's
                  Step 0 layout (so they were missing from this tab
                  entirely until now): emergency_contacts,
                  family_dependents, skills, vacation_leave, sick_leave,
                  and the five policy Check fields. Rendered as a full-width
                  block below the two-column layout above. */}
              <div className="grid gap-3 mt-3">
                <Section title="Additional Details" wide>
                  <Field id="info-emergency-contacts" label="Emergency Contacts">
                    <Input id="info-emergency-contacts" {...infoForm.register("emergency_contacts")} />
                  </Field>
                  <Field id="info-family-dependents" label="Family/Dependents">
                    <Input id="info-family-dependents" {...infoForm.register("family_dependents")} />
                  </Field>
                  <Field id="info-skills" label="Skills">
                    <Input id="info-skills" {...infoForm.register("skills")} />
                  </Field>
                  <Field id="info-vacation-leave" label="Vacation Leave">
                    <Input id="info-vacation-leave" type="number" step="0.5" {...infoForm.register("vacation_leave")} />
                  </Field>
                  <Field id="info-sick-leave" label="Sick Leave">
                    <Input id="info-sick-leave" type="number" step="0.5" {...infoForm.register("sick_leave")} />
                  </Field>
                </Section>

                <Section title="Policies" wide>
                  <CheckboxField control={infoForm.control} name="paid_holiday" id="info-paid-holiday" label="Paid Holiday" />
                  <CheckboxField control={infoForm.control} name="leave_credits" id="info-leave-credits" label="Leave Credits" />
                  <CheckboxField control={infoForm.control} name="official_business" id="info-official-business" label="Official Business" />
                  <CheckboxField control={infoForm.control} name="late_immunity" id="info-late-immunity" label="Late Immunity" />
                  <CheckboxField control={infoForm.control} name="absent_immunity" id="info-absent-immunity" label="Absent Immunity" />
                </Section>
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