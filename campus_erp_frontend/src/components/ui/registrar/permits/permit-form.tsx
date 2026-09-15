"use client"

import { useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { permitSpec } from "@/lib/forms/registrar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import StudentSearch, { StudentOption } from "@/components/sms/StudentSearch"
import { ChildTableGrid } from "@/components/sms/ChildTableGrid"

interface AssessmentOption {
  name: string
  program: string
  year_level: string | number | null
  semester: number
  school_year: string
  school_term: string
  docstatus: number
  total_fee: number
  payment: number
  receivable: number
}

interface CourseEnrollmentRow {
  course: string
  student_group: string | null
}

interface PermitRecord {
  name: string
  docstatus: number
  student: string
  course: string | null
  year_level: number | null
  semester: number | null
  school_year: string | null
  term: string | null
  assessment: string | null
  total_fee: number
  payment: number
  due_payment: number
  status: string
  permit_no: string | null
  subjects: Array<Record<string, unknown>>
}

const STATUS_OPTIONS = ["Pending", "Eligible", "Issued"]

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
 * Bespoke Permit to Take Exam form (create/edit) — replaces the generic
 * EntryScreen for this doctype so Student can be a search-by-name-or-ID
 * control that auto-populates Program/Year Level/Semester/School Year and
 * fee details from the student's SMS Student Assessment, the same way
 * Payments/Cash Receipt Entry and Pre-Enrollment already do (StudentSearch +
 * the "adjust state during render" sync idiom used on those screens).
 *
 * Total Fee/Payment/Due Payment are read-only display only: SMSPermit's
 * controller always recomputes them server-side from the linked Assessment,
 * so this form never sends them — showing them as editable would be
 * misleading about which value actually wins.
 */
export function PermitForm({
  name,
  basePath,
}: {
  /** Existing document name to load, or undefined for a new permit. */
  name?: string
  basePath: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [student, setStudent] = useState<StudentOption | null>(null)
  const [selectedAssessment, setSelectedAssessment] = useState("")
  const [course, setCourse] = useState("")
  const [yearLevel, setYearLevel] = useState("")
  const [semester, setSemester] = useState("")
  const [schoolYear, setSchoolYear] = useState("")
  const [term, setTerm] = useState("")
  const [status, setStatus] = useState("Pending")
  const [permitNo, setPermitNo] = useState("")
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])

  const { data: doc, isLoading } = useQuery({
    queryKey: [permitSpec.doctype, name],
    queryFn: () => frappe.getDoc<PermitRecord>(permitSpec.doctype, name!),
    enabled: !!name,
  })

  // Resolve the full StudentOption (name + student_name + stdnt_cno) an
  // existing permit's plain `student` id refers to, so StudentSearch can
  // show it the same way a freshly-searched student would be shown.
  const [appliedInitialStudent, setAppliedInitialStudent] = useState(false)
  const initialStudentQuery = useQuery({
    queryKey: ["Student", "get", doc?.student],
    queryFn: () =>
      frappe.list<StudentOption>("Student", {
        filters: [["name", "=", doc!.student]],
        fields: ["name", "student_name", "stdnt_cno"],
        limit_page_length: 1,
      }),
    enabled: !!doc?.student && !appliedInitialStudent,
  })

  const [syncedAssessmentForStudent, setSyncedAssessmentForStudent] = useState<string | undefined>(undefined)
  // Keyed on student+assessment (not just student) so switching assessments
  // in the dropdown also refreshes Subjects to that term's enrolled classes.
  const [syncedSubjectsKey, setSyncedSubjectsKey] = useState<string | undefined>(undefined)

  // Seed every field from a loaded document exactly once, using the same
  // "adjust state during render" idiom EntryScreen itself uses for its rows
  // (not a useEffect) — see EntryScreen.tsx's own sync comment.
  if (doc && !appliedInitialStudent && (!doc.student || initialStudentQuery.isFetched)) {
    setAppliedInitialStudent(true)
    const resolvedStudent = doc.student ? initialStudentQuery.data?.[0] ?? null : null
    setStudent(resolvedStudent)
    // Prevents the "pick a new student -> default to their first
    // assessment" sync below from clobbering this doc's own saved
    // assessment once the assessments list for this student loads.
    if (resolvedStudent) {
      setSyncedAssessmentForStudent(resolvedStudent.name)
      // Same reasoning, for the enrolled-classes -> Subjects auto-fill below:
      // an existing permit's saved Subjects rows are the source of truth,
      // not a fresh guess from the student's current class enrollment.
      setSyncedSubjectsKey(`${resolvedStudent.name}|${doc.assessment ?? ""}`)
    }
    setSelectedAssessment(doc.assessment ?? "")
    setCourse(doc.course ?? "")
    setYearLevel(doc.year_level != null ? String(doc.year_level) : "")
    setSemester(doc.semester != null ? String(doc.semester) : "")
    setSchoolYear(doc.school_year ?? "")
    setTerm(doc.term ?? "")
    setStatus(doc.status || "Pending")
    setPermitNo(doc.permit_no ?? "")
    setRows(Array.isArray(doc.subjects) ? doc.subjects : [])
  }

  const assessmentsQuery = useQuery({
    queryKey: ["SMS Student Assessment", "for-permit", student?.name],
    queryFn: () =>
      frappe.list<AssessmentOption>("SMS Student Assessment", {
        filters: [
          ["student", "=", student!.name],
          ["docstatus", "!=", 2],
        ],
        fields: [
          "name",
          "program",
          "year_level",
          "semester",
          "school_year",
          "school_term",
          "docstatus",
          "total_fee",
          "payment",
          "receivable",
        ],
        order_by: "posting_date desc",
        limit_page_length: 20,
      }),
    enabled: !!student,
  })

  const assessments = assessmentsQuery.data ?? []

  function applyAssessment(a: AssessmentOption | null) {
    setSelectedAssessment(a?.name ?? "")
    setCourse(a?.program ?? "")
    setYearLevel(a?.year_level != null ? String(a.year_level) : "")
    setSemester(a?.semester != null ? String(a.semester) : "")
    setSchoolYear(a?.school_year ?? "")
  }

  // Default to the student's most recent assessment the moment they're
  // found via search — the registrar can still pick a different one below
  // if more than one exists. Guarded so this never re-fires for a student
  // whose assessment was just restored from an existing permit (see above).
  if (student && student.name !== syncedAssessmentForStudent && assessmentsQuery.isFetched) {
    setSyncedAssessmentForStudent(student.name)
    applyAssessment(assessments[0] ?? null)
  }

  // Subjects auto-fill: the student's currently enrolled classes for this
  // permit's term (subject + class/Student Group) — not the Pre-Enrollment
  // "prescribed" listing, which has no class assigned yet and so can't fill
  // both of Permit Subject's columns.
  const enrolledClassesQuery = useQuery({
    queryKey: ["Course Enrollment", "for-permit", student?.name, selectedAssessment],
    queryFn: () =>
      frappe.list<CourseEnrollmentRow>("Course Enrollment", {
        filters: [
          ["student", "=", student!.name],
          ["status", "=", "Enrolled"],
          ["program", "=", course],
          ["year_level", "=", Number(yearLevel)],
          ["semester", "=", Number(semester)],
        ],
        fields: ["course", "student_group"],
        limit_page_length: 100,
      }),
    enabled: !!student && !!selectedAssessment && !!course && yearLevel !== "" && semester !== "",
  })

  // Fires whenever the (student, assessment) pair changes — both the
  // auto-default-to-latest-assessment case above and an explicit switch via
  // the Assessment dropdown — but never re-fires for the same pair, so
  // manually edited rows aren't clobbered afterward.
  const subjectsKey = student ? `${student.name}|${selectedAssessment}` : undefined
  if (
    subjectsKey &&
    subjectsKey !== syncedSubjectsKey &&
    (!selectedAssessment || enrolledClassesQuery.isFetched)
  ) {
    setSyncedSubjectsKey(subjectsKey)
    setRows(
      selectedAssessment
        ? (enrolledClassesQuery.data ?? []).map((ce) => ({ subject: ce.course, class: ce.student_group }))
        : []
    )
  }

  const assessment = assessments.find((a) => a.name === selectedAssessment) ?? null
  // Fall back to the permit's own last-saved fee snapshot while assessments
  // are still loading for an existing permit, so the read-only fee display
  // doesn't flash "—" before the matching assessment resolves.
  const feePreview = assessment
    ? { total_fee: assessment.total_fee, payment: assessment.payment, due_payment: assessment.receivable }
    : doc && selectedAssessment
      ? { total_fee: doc.total_fee, payment: doc.payment, due_payment: doc.due_payment }
      : null

  function handleStudentSelect(next: StudentOption | null) {
    setStudent(next)
    if (!next) {
      applyAssessment(null)
      setSyncedAssessmentForStudent(undefined)
      setSyncedSubjectsKey(undefined)
      setRows([])
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        student: student!.name,
        course: course || null,
        year_level: yearLevel !== "" ? Number(yearLevel) : null,
        semester: semester !== "" ? Number(semester) : null,
        school_year: schoolYear || null,
        term: term || null,
        assessment: selectedAssessment || null,
        status,
        subjects: rows,
      }
      return name
        ? frappe.updateDoc(permitSpec.doctype, name, payload)
        : frappe.createDoc(permitSpec.doctype, payload)
    },
    onSuccess: (saved) => {
      toast.success(`${permitSpec.title} saved`)
      queryClient.invalidateQueries({ queryKey: [permitSpec.doctype] })
      if (!name) {
        const newName = (saved as { name?: string })?.name
        if (newName) router.push(`${basePath}/${encodeURIComponent(newName)}`)
      }
    },
    onError: (error) => toast.error(`Could not save permit: ${getErrorMessage(error)}`),
  })

  if (name && isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  const canSave = !!student && !saveMutation.isPending

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{permitSpec.title}</h1>
        {doc?.permit_no && <span className="text-sm text-muted-foreground">{doc.permit_no}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
        <Field label="Student *">
          <StudentSearch selected={student} onSelect={handleStudentSelect} idPrefix="permit" />
        </Field>

        {assessments.length > 1 && (
          <Field label="Assessment (School Year - Semester)">
            <Select
              value={selectedAssessment}
              onValueChange={(v) => applyAssessment(assessments.find((a) => a.name === v) ?? null)}
            >
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

      {student && assessmentsQuery.isFetching && (
        <div className="text-sm text-muted-foreground">Loading assessment…</div>
      )}

      {student && !assessmentsQuery.isFetching && assessments.length === 0 && (
        <div className="rounded-md border p-4 text-sm text-muted-foreground max-w-3xl">
          {student.student_name} has no assessment on record yet — Total Fee/Payment/Due Payment will be
          recorded as 0 until one is linked (Finance &gt; Student Assessments).
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 max-w-3xl">
        <Field label="Program">
          <div className="text-sm font-medium">{course || "—"}</div>
        </Field>
        <Field label="Year Level">
          <div className="text-sm font-medium">{yearLevel || "—"}</div>
        </Field>
        <Field label="Semester">
          <div className="text-sm font-medium">{semester || "—"}</div>
        </Field>
        <Field label="School Year">
          <div className="text-sm font-medium">{schoolYear || "—"}</div>
        </Field>
        <Field label="Exam Period">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Prelim / Midterm / Finals" />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v ?? "Pending")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Permit No.">
          <Input value={permitNo} disabled className="text-muted-foreground" placeholder="Assigned on issue" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl rounded-md border p-4">
        <Field label="Total Fee">
          <div className="text-sm font-medium">₱{formatCurrency(feePreview?.total_fee)}</div>
        </Field>
        <Field label="Payment">
          <div className="text-sm font-medium">₱{formatCurrency(feePreview?.payment)}</div>
        </Field>
        <Field label="Due Payment">
          <div className="text-sm font-semibold">₱{formatCurrency(feePreview?.due_payment)}</div>
        </Field>
      </div>

      <Separator />

      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">
          Auto-filled from the student&apos;s currently enrolled classes for this term — add or remove rows as
          needed.
        </p>
        {student && selectedAssessment && enrolledClassesQuery.isFetching && (
          <p className="text-sm text-muted-foreground">Loading enrolled classes…</p>
        )}
        <ChildTableGrid spec={permitSpec.childTable!} rows={rows} onChange={setRows} />
      </div>

      <div>
        <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
