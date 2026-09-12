"use client"

import { useEffect, useState, type ReactNode, type ChangeEvent } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Step labels/groupings match the prototype's `employeeWizardLayout`
// (frappe-bench/apps/esti_erp_frontend/src/lib/forms/personnel.ts), NOT the
// 5-step layout this component used to hardcode. Per explicit instruction,
// this pass only carries over the PLAIN-FIELD groupings — steps that are
// child-table-only in the prototype (Education, Loan Ledgers) or table+note
// (Benefits) are placeholders here; EmployeeWizard.tsx has no ChildTableGrid
// wired in yet (see 05-PERSONNEL-IMPLEMENTATION-PLAN.md Phase 2).
const STEPS = [
  "Personnel Info",
  "Primary Contacts",
  "Education",
  "Skills / Seminars",
  "Payroll Info",
]
// Schedules & Leaves, Benefits, and Loan Ledgers were dropped from this
// wizard on purpose — those records only make sense once the employee
// already exists, so they're edited in EmployeeDetailTabs.tsx's own tabs
// (Loan/Leave, Benefits) instead of at creation time here.
interface EducationRow {
  level: string
  school_name: string
  year_graduated: string
}

const EMPTY_EDUCATION_ROW: EducationRow = { level: "", school_name: "", year_graduated: "" }

// Backend-confirmed via `frappe.get_meta("SMS Personnel Seminar")`:
// seminar_title (Data, reqd), sponsoring_agency (Data), date_from (Date),
// date_to (Date), venue (Data), hours (Float). No Select fields here, so
// no options list to guess at.
interface SeminarRow {
  seminar_title: string
  sponsoring_agency: string
  date_from: string
  date_to: string
  venue: string
  hours: string
}

const EMPTY_SEMINAR_ROW: SeminarRow = {
  seminar_title: "",
  sponsoring_agency: "",
  date_from: "",
  date_to: "",
  venue: "",
  hours: "",
}
// TODO: confirm against SMS Personnel Education's actual `level` Select
// options on the backend — this is a placeholder list, not fetched live.
const EDUCATION_LEVEL_OPTIONS = ["Elementary", "High School", "Vocational", "College", "Graduate Studies"]
const EMPLOYEE_STATUS_OPTIONS = ["Contractual", "Part Timer", "Probationary", "Regular"]
const WORK_STATUS_OPTIONS = ["In Active", "Active", "Executive", "Consultant"]
const GENDER_OPTIONS = ["Male", "Female", "Others"]
const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed", "Separated"]
const NATIONALITY_OPTIONS = ["Filipino", "American"]

// Fields on Personnel Info that src/lib/payroll.ts's computePayrollFields
// derives from Gross Pay. Kept as one list so the auto-compute effect below
// and the save payload's numeric coercion can't drift out of sync with each
// other — add a field here once and both pick it up.
const COMPUTED_PAYROLL_FIELDS = [
  "with_holding_tax", "sss_deduction", "philhealth_deduction", "pagibig_deduction",
  "reg_rate_pre_hour", "reg_ot_per_hour", "sunday_rate_per_hour", "sunday_ot_per_hour",
  "holiday_rate_per_hour", "holiday_ot_per_hour", "late_rate_per_hour", "undertime_rate_per_hour",
] as const

const CHECK_FIELDS = [
  ["with_atm_card", "With ATM Card"],
  ["paid_holiday", "Paid Holiday"],
  ["leave_credits", "Leave Credits"],
  ["official_business", "Official Business"],
  ["late_immunity", "Late Immunity"],
  ["absent_immunity", "Absent Immunity"],
] as const

export type EmployeeFormState = Record<string, string>

const INITIAL_STATE: EmployeeFormState = {
  // Personnel Info
  employee_id: "", rfid: "", first_name: "", middle_name: "", last_name: "", title: "",
  birthdate: "", gender: "", number_of_dependents: "", marital_status: "", nationality: "",
  religion: "", contact_number: "", birthplace: "", mailing_address: "",
  employee_status: "", date_hired: "", department: "",
  // Primary Contacts
  emergency_contacts: "", family_dependents: "",
  // Skills / Seminars
  skills: "",
  // Payroll Info
  tin_number: "", sss_number: "", philhealth: "", pag_ibig: "",
  with_holding_tax: "", sss_deduction: "", philhealth_deduction: "", pagibig_deduction: "",
  gross_pay: "", allowance: "", reg_rate_pre_hour: "", reg_ot_per_hour: "",
  sunday_rate_per_hour: "", sunday_ot_per_hour: "", holiday_rate_per_hour: "", holiday_ot_per_hour: "",
  late_rate_per_hour: "", undertime_rate_per_hour: "", work_status: "", with_atm_card: "",
  paid_holiday: "", leave_credits: "", official_business: "", late_immunity: "", absent_immunity: "",
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="col-span-full mt-2 text-sm font-medium text-muted-foreground first:mt-0">{children}</p>
}

interface EmployeeWizardProps {
  mode: "add" | "edit" | "view"
  onDone: () => void
}

/**
 * Add-only in practice (edit/view now live in EmployeeDetailTabs.tsx — see
 * 05-PERSONNEL-IMPLEMENTATION-PLAN.md Phase 1). `mode` kept for API
 * compatibility with the route that renders this component.
 */
export function EmployeeWizard({ mode, onDone }: EmployeeWizardProps) {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [form, setForm] = useState<EmployeeFormState>(INITIAL_STATE)
  const [educationRows, setEducationRows] = useState<EducationRow[]>([])
  const [seminarRows, setSeminarRows] = useState<SeminarRow[]>([])
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string>("")
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const readOnly = mode === "view"

  // department is now a Link field (options: "SMS Personnel Departments").
  // Fetch the live list instead of parsing a baked-in choice string — same
  // query shape as DepartmentMaintenance.tsx.
  const { data: departments } = useQuery({
    queryKey: ["SMS Personnel Departments", "list", "employee-wizard"],
    queryFn: () =>
      frappe.list<{ name: string; department: string | null }>("SMS Personnel Departments", {
        fields: ["name", "department"],
        order_by: "department asc",
        limit_page_length: 500,
      }),
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Auto-calculate: every time Gross Pay changes, recompute the twelve
  // derived rate/deduction fields via the shared payroll module (same
  // calculation EmployeeDetailTabs.tsx's "Compute from Gross Pay" button
  // runs) and write them straight into form state — this is what was
  // missing before, which is why the Payroll step never filled itself in.
  // Clearing Gross Pay clears the derived fields back out rather than
  // leaving stale numbers behind.
  useEffect(() => {
    if (readOnly) return
    const grossPay = Number(form.gross_pay)
    if (!form.gross_pay || !(grossPay > 0)) {
      setForm((prev) => {
        const cleared = { ...prev }
        for (const field of COMPUTED_PAYROLL_FIELDS) cleared[field] = ""
        return cleared
      })
      return
    }
    const result = computePayrollFields(form.gross_pay)
    setForm((prev) => ({
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
    // Only Gross Pay should re-trigger this — the fields it writes into
    // are intentionally excluded from the dependency list, or every write
    // above would immediately re-fire the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.gross_pay, readOnly])

  function addEducationRow() {
    setEducationRows((prev) => [...prev, { ...EMPTY_EDUCATION_ROW }])
  }
  function updateEducationRow(index: number, field: keyof EducationRow, value: string) {
    setEducationRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }
  function removeEducationRow(index: number) {
    setEducationRows((prev) => prev.filter((_, i) => i !== index))
  }

  function addSeminarRow() {
    setSeminarRows((prev) => [...prev, { ...EMPTY_SEMINAR_ROW }])
  }
  function updateSeminarRow(index: number, field: keyof SeminarRow, value: string) {
    setSeminarRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }
  function removeSeminarRow(index: number) {
    setSeminarRows((prev) => prev.filter((_, i) => i !== index))
  }

  // Deferred-upload pattern, matching registrar/students/new/page.tsx: the
  // file is staged locally with an instant object-URL preview; the actual
  // upload happens inside saveMutation, so nothing hits the server (no
  // orphan file) until Save is pressed.
  function handleProfileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileFile(file)
    setProfilePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { ...form }
      payload.number_of_dependents = form.number_of_dependents ? Number(form.number_of_dependents) : undefined
      payload.vacation_leave = form.vacation_leave ? Number(form.vacation_leave) : undefined
      payload.sick_leave = form.sick_leave ? Number(form.sick_leave) : undefined
      for (const [field] of CHECK_FIELDS) payload[field] = form[field] === "1" ? 1 : 0
      // Gross Pay/Allowance and the twelve computed fields are now genuinely
      // calculated client-side by the effect above (via computePayrollFields),
      // so — unlike before — they're real numbers that should be sent, not
      // stripped out. Coerce each to a number (or drop it if blank, e.g. no
      // Gross Pay was entered) rather than sending it as a string.
      payload.gross_pay = form.gross_pay ? Number(form.gross_pay) : undefined
      payload.allowance = form.allowance ? Number(form.allowance) : undefined
      for (const field of COMPUTED_PAYROLL_FIELDS) {
        payload[field] = form[field] ? Number(form[field]) : undefined
      }
      payload.education = educationRows.filter((r) => r.school_name.trim())
      // seminar_title is `reqd: 1` on the backend, so filter on that (not
      // venue/agency, which are optional). hours is Float on the backend —
      // coerce here the same way number_of_dependents is coerced above.
      payload.seminars_attended = seminarRows
        .filter((r) => r.seminar_title.trim())
        .map((r) => ({ ...r, hours: r.hours ? Number(r.hours) : undefined }))
      if (profileFile) {
        const uploaded = await frappe.uploadFile(profileFile, { isPrivate: true })
        payload.profile = uploaded.file_url
      }
      return frappe.createDoc(employeeSpec.doctype, payload)
    },
    onSuccess: async () => {
      toast.success(`${employeeSpec.title.replace(/s$/, "")} saved`)
      await queryClient.invalidateQueries({ queryKey: [employeeSpec.doctype] })
      onDone()
    },
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  const canProceedStep0 = !!form.employee_id && !!form.first_name && !!form.last_name
  const title = mode === "add" ? "Add Employee" : mode === "edit" ? "Edit Employee" : "View Employee"

  return (
    <div className="flex flex-col gap-3">
      <div className="shrink-0 rounded-2xl border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold">{title}</h1>
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            Back to Employees
          </Button>
        </div>
        <div className="flex items-start overflow-x-auto">
          {STEPS.map((label, idx) => (
            <div key={label} className={`flex items-start ${idx < STEPS.length - 1 ? "flex-1 min-w-24" : "min-w-24"}`}>
              <div className="flex flex-col items-center gap-2">
                {idx <= currentStep ? (
                  <div
                    className={`h-5 w-5 shrink-0 rounded-full bg-primary ${idx === currentStep ? "ring-4 ring-primary/20" : ""
                      }`}
                  />
                ) : (
                  <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-muted-foreground/40" />
                )}
                <span
                  className={`w-24 text-center text-[11px] font-medium ${idx <= currentStep ? "text-foreground" : "text-muted-foreground"
                    }`}
                >
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`mx-2 mt-[10px] h-0.5 flex-1 ${idx <= currentStep ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col rounded-2xl border border-border p-5 gap-4">
        {/* Step 0: Personnel Info — two-column layout matching the prototype:
            left column is the plain field grid, right column is a sidebar
            with the profile-photo upload box on top and Employment Details
            below it. */}
        {currentStep === 0 && (
          <div className="grid gap-6 md:grid-cols-[1fr_260px]">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <SectionLabel>System Identification</SectionLabel>
              <Field id="emp-employee-id" label="Employee ID">
                <Input id="emp-employee-id" disabled={readOnly} value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)} />
              </Field>
              <Field id="emp-rfid" label="RFID">
                <Input id="emp-rfid" disabled={readOnly} value={form.rfid} onChange={(e) => set("rfid", e.target.value)} />
              </Field>

              <SectionLabel>Personal Information</SectionLabel>
              <Field id="emp-first-name" label="First Name">
                <Input id="emp-first-name" disabled={readOnly} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
              </Field>
              <Field id="emp-middle-name" label="Middle Name">
                <Input id="emp-middle-name" disabled={readOnly} value={form.middle_name} onChange={(e) => set("middle_name", e.target.value)} />
              </Field>
              <Field id="emp-last-name" label="Last Name">
                <Input id="emp-last-name" disabled={readOnly} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
              </Field>
              <Field id="emp-title" label="Title">
                <Input id="emp-title" disabled={readOnly} value={form.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field id="emp-birthdate" label="Birthdate">
                <Input id="emp-birthdate" type="date" disabled={readOnly} value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} />
              </Field>
              <Field id="emp-gender" label="Gender">
                <Select value={form.gender} onValueChange={(v) => set("gender", v ?? "")} disabled={readOnly}>
                  <SelectTrigger id="emp-gender" className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{GENDER_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field id="emp-num-dependents" label="Number of Dependents">
                <Input id="emp-num-dependents" type="number" disabled={readOnly} value={form.number_of_dependents} onChange={(e) => set("number_of_dependents", e.target.value)} />
              </Field>
              <Field id="emp-marital-status" label="Marital Status">
                <Select value={form.marital_status} onValueChange={(v) => set("marital_status", v ?? "")} disabled={readOnly}>
                  <SelectTrigger id="emp-marital-status" className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{MARITAL_STATUS_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field id="emp-nationality" label="Nationality">
                <Select value={form.nationality} onValueChange={(v) => set("nationality", v ?? "")} disabled={readOnly}>
                  <SelectTrigger id="emp-nationality" className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{NATIONALITY_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field id="emp-religion" label="Religion">
                <Input id="emp-religion" disabled={readOnly} value={form.religion} onChange={(e) => set("religion", e.target.value)} />
              </Field>

              <SectionLabel>Contact &amp; Location</SectionLabel>
              <Field id="emp-contact-number" label="Contact Number">
                <Input id="emp-contact-number" disabled={readOnly} value={form.contact_number} onChange={(e) => set("contact_number", e.target.value)} />
              </Field>
              <Field id="emp-birthplace" label="Birthplace">
                <Input id="emp-birthplace" disabled={readOnly} value={form.birthplace} onChange={(e) => set("birthplace", e.target.value)} />
              </Field>
              <Field id="emp-mailing-address" label="Mailing Address">
                <Input id="emp-mailing-address" disabled={readOnly} value={form.mailing_address} onChange={(e) => set("mailing_address", e.target.value)} />
              </Field>
              {/* Infractions dialog (child table, prototype's "View Infractions"
                  button) intentionally omitted — no ChildTableGrid wired in yet. */}
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Insert Profile</p>
                <label
                  htmlFor="emp-profile"
                  className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-muted text-[10px] text-muted-foreground"
                >
                  {profilePreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profilePreviewUrl} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    "No Photo"
                  )}
                  {!readOnly && (
                    <input
                      id="emp-profile"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProfileChange}
                    />
                  )}
                </label>
              </div>

              <div className="grid gap-3">
                <SectionLabel>Employment Details</SectionLabel>
                <Field id="emp-employee-status" label="Employee Status">
                  <Select value={form.employee_status} onValueChange={(v) => set("employee_status", v ?? "")} disabled={readOnly}>
                    <SelectTrigger id="emp-employee-status" className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{EMPLOYEE_STATUS_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field id="emp-date-hired" label="Date Hired">
                  <Input id="emp-date-hired" type="date" disabled={readOnly} value={form.date_hired} onChange={(e) => set("date_hired", e.target.value)} />
                </Field>
                <Field id="emp-department" label="Department">
                  <Select value={form.department} onValueChange={(v) => set("department", v ?? "")} disabled={readOnly}>
                    <SelectTrigger id="emp-department" className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {(departments ?? []).map((d) => (
                        <SelectItem key={d.name} value={d.name}>{d.department ?? d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Primary Contacts */}
        {currentStep === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="emp-emergency-contacts" label="Emergency Contacts">
              <Input id="emp-emergency-contacts" disabled={readOnly} value={form.emergency_contacts} onChange={(e) => set("emergency_contacts", e.target.value)} />
            </Field>
            <Field id="emp-family-dependents" label="Family/Dependents">
              <Input id="emp-family-dependents" disabled={readOnly} value={form.family_dependents} onChange={(e) => set("family_dependents", e.target.value)} />
            </Field>
          </div>
        )}

        {/* Step 2: Education — child table (SMS Personnel Education) */}
        {currentStep === 2 && (
          <div className="grid gap-3">
            <SectionLabel>Education</SectionLabel>
            {educationRows.length === 0 && (
              <p className="text-sm text-muted-foreground">No education records added yet.</p>
            )}
            {educationRows.map((row, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_40px] items-end">
                <Field id={`edu-level-${index}`} label={index === 0 ? "Level" : ""}>
                  <Select
                    value={row.level}
                    onValueChange={(v) => updateEducationRow(index, "level", v ?? "")}
                    disabled={readOnly}
                  >
                    <SelectTrigger id={`edu-level-${index}`} className="w-full">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {EDUCATION_LEVEL_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id={`edu-school-${index}`} label={index === 0 ? "School Name" : ""}>
                  <Input
                    id={`edu-school-${index}`}
                    disabled={readOnly}
                    value={row.school_name}
                    onChange={(e) => updateEducationRow(index, "school_name", e.target.value)}
                  />
                </Field>
                <Field id={`edu-year-${index}`} label={index === 0 ? "Year Graduated" : ""}>
                  <Input
                    id={`edu-year-${index}`}
                    type="number"
                    disabled={readOnly}
                    value={row.year_graduated}
                    onChange={(e) => updateEducationRow(index, "year_graduated", e.target.value)}
                  />
                </Field>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeEducationRow(index)}
                    aria-label="Remove row"
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            {!readOnly && (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addEducationRow}>
                + Add Education
              </Button>
            )}
          </div>
        )}

        {/* Step 3: Skills / Seminars Attended */}
        {currentStep === 3 && (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="emp-skills" label="Skills">
                <Input id="emp-skills" disabled={readOnly} value={form.skills} onChange={(e) => set("skills", e.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3">
              <SectionLabel>Seminars / Trainings Attended</SectionLabel>
              {seminarRows.length === 0 && (
                <p className="text-sm text-muted-foreground">No seminars added yet.</p>
              )}
              {seminarRows.map((row, index) => (
                <div
                  key={index}
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_1fr_1fr_1fr_90px_40px] items-end rounded-lg border border-border p-3"
                >
                  <Field id={`sem-title-${index}`} label="Seminar/Training Title">
                    <Input
                      id={`sem-title-${index}`}
                      disabled={readOnly}
                      value={row.seminar_title}
                      onChange={(e) => updateSeminarRow(index, "seminar_title", e.target.value)}
                    />
                  </Field>
                  <Field id={`sem-agency-${index}`} label="Sponsoring Agency">
                    <Input
                      id={`sem-agency-${index}`}
                      disabled={readOnly}
                      value={row.sponsoring_agency}
                      onChange={(e) => updateSeminarRow(index, "sponsoring_agency", e.target.value)}
                    />
                  </Field>
                  <Field id={`sem-date-from-${index}`} label="Date From">
                    <Input
                      id={`sem-date-from-${index}`}
                      type="date"
                      disabled={readOnly}
                      value={row.date_from}
                      onChange={(e) => updateSeminarRow(index, "date_from", e.target.value)}
                    />
                  </Field>
                  <Field id={`sem-date-to-${index}`} label="Date To">
                    <Input
                      id={`sem-date-to-${index}`}
                      type="date"
                      disabled={readOnly}
                      value={row.date_to}
                      onChange={(e) => updateSeminarRow(index, "date_to", e.target.value)}
                    />
                  </Field>
                  <Field id={`sem-venue-${index}`} label="Venue">
                    <Input
                      id={`sem-venue-${index}`}
                      disabled={readOnly}
                      value={row.venue}
                      onChange={(e) => updateSeminarRow(index, "venue", e.target.value)}
                    />
                  </Field>
                  <Field id={`sem-hours-${index}`} label="Hours">
                    <Input
                      id={`sem-hours-${index}`}
                      type="number"
                      disabled={readOnly}
                      value={row.hours}
                      onChange={(e) => updateSeminarRow(index, "hours", e.target.value)}
                    />
                  </Field>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeSeminarRow(index)}
                      aria-label="Remove row"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addSeminarRow}>
                  + Add Seminar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Payroll Info */}
        {currentStep === 4 && (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Field id="emp-tin" label="TIN Number">
              <Input id="emp-tin" disabled={readOnly} value={form.tin_number} onChange={(e) => set("tin_number", e.target.value)} />
            </Field>
            <Field id="emp-sss" label="SSS Number">
              <Input id="emp-sss" disabled={readOnly} value={form.sss_number} onChange={(e) => set("sss_number", e.target.value)} />
            </Field>
            <Field id="emp-philhealth" label="PhilHealth">
              <Input id="emp-philhealth" disabled={readOnly} value={form.philhealth} onChange={(e) => set("philhealth", e.target.value)} />
            </Field>
            <Field id="emp-pagibig" label="Pag-IBIG">
              <Input id="emp-pagibig" disabled={readOnly} value={form.pag_ibig} onChange={(e) => set("pag_ibig", e.target.value)} />
            </Field>

            <Field id="emp-gross-pay" label="Gross Pay">
              <Input id="emp-gross-pay" type="number" disabled={readOnly} value={form.gross_pay} onChange={(e) => set("gross_pay", e.target.value)} />
            </Field>
            <Field id="emp-allowance" label="Allowance">
              <Input id="emp-allowance" type="number" disabled={readOnly} value={form.allowance} onChange={(e) => set("allowance", e.target.value)} />
            </Field>
            <Field id="emp-work-status" label="Work Status">
              <Select value={form.work_status} onValueChange={(v) => set("work_status", v ?? "")} disabled={readOnly}>
                <SelectTrigger id="emp-work-status" className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{WORK_STATUS_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </Field>

            <SectionLabel>
              Auto-calculated from Gross Pay (read-only — enter Gross Pay above to fill these in)
            </SectionLabel>
            <Field id="emp-with-holding-tax" label="Withholding Tax">
              <Input id="emp-with-holding-tax" type="number" disabled value={form.with_holding_tax} />
            </Field>
            <Field id="emp-sss-deduction" label="SSS Deduction">
              <Input id="emp-sss-deduction" type="number" disabled value={form.sss_deduction} />
            </Field>
            <Field id="emp-philhealth-deduction" label="PhilHealth Deduction">
              <Input id="emp-philhealth-deduction" type="number" disabled value={form.philhealth_deduction} />
            </Field>
            <Field id="emp-pagibig-deduction" label="Pag-IBIG Deduction">
              <Input id="emp-pagibig-deduction" type="number" disabled value={form.pagibig_deduction} />
            </Field>
            <Field id="emp-reg-rate" label="Reg. Rate / Hour">
              <Input id="emp-reg-rate" type="number" disabled value={form.reg_rate_pre_hour} />
            </Field>
            <Field id="emp-reg-ot" label="Reg. OT / Hour">
              <Input id="emp-reg-ot" type="number" disabled value={form.reg_ot_per_hour} />
            </Field>
            <Field id="emp-sunday-rate" label="Sunday Rate / Hour">
              <Input id="emp-sunday-rate" type="number" disabled value={form.sunday_rate_per_hour} />
            </Field>
            <Field id="emp-sunday-ot" label="Sunday OT / Hour">
              <Input id="emp-sunday-ot" type="number" disabled value={form.sunday_ot_per_hour} />
            </Field>
            <Field id="emp-holiday-rate" label="Holiday Rate / Hour">
              <Input id="emp-holiday-rate" type="number" disabled value={form.holiday_rate_per_hour} />
            </Field>
            <Field id="emp-holiday-ot" label="Holiday OT / Hour">
              <Input id="emp-holiday-ot" type="number" disabled value={form.holiday_ot_per_hour} />
            </Field>
            <Field id="emp-late-rate" label="Late Rate / Hour">
              <Input id="emp-late-rate" type="number" disabled value={form.late_rate_per_hour} />
            </Field>
            <Field id="emp-undertime-rate" label="Undertime Rate / Hour">
              <Input id="emp-undertime-rate" type="number" disabled value={form.undertime_rate_per_hour} />
            </Field>

            <div className="sm:col-span-2 md:col-span-4 flex items-center gap-4">
              <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
                <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
                  Policy
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Policy</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 pt-2">
                    {CHECK_FIELDS.filter(([f]) => f !== "with_atm_card").map(([field, label]) => (
                      <label key={field} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          disabled={readOnly}
                          checked={form[field] === "1"}
                          onChange={(e) => set(field, e.target.checked ? "1" : "")}
                          className="h-4 w-4 rounded border-border"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setPolicyDialogOpen(false)}>
                      Close
                    </Button>
                    <Button type="button" onClick={() => setPolicyDialogOpen(false)}>
                      Update
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={form.with_atm_card === "1"}
                  onChange={(e) => set("with_atm_card", e.target.checked ? "1" : "")}
                  className="h-4 w-4 rounded border-border"
                />
                With ATM Card
              </label>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          >
            Previous
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button
              type="button"
              disabled={currentStep === 0 && !canProceedStep0}
              onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              Next
            </Button>
          ) : (
            <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}