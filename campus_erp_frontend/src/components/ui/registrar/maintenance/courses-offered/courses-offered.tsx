"use client"

import { useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  SearchIcon,
} from "lucide-react"

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

interface CourseRow {
  name: string
  program_name: string
  course_code: string | null
  department: string | null
  semesters: string | null
}

interface DepartmentRow {
  name: string
  department_name: string
}

const SEMESTER_OPTIONS = ["1", "2", "3"]

const ACADEMIC_DEPARTMENTS = [
  "Administration Department",
  "Computer Science Department",
  "Electronics Department",
  "Finance Department",
  "General Services Department",
  "High School Department",
  "Hotel & Restaurant Department",
  "Human Resources",
  "Marine Department",
  "Property Custodian",
  "Registrar",
  "Science Department",
  "Tourism Department",
]

interface CourseFormState {
  program_name: string
  course_code: string
  department: string
  semesters: string
}

const BLANK_FORM: CourseFormState = {
  program_name: "",
  course_code: "",
  department: "",
  semesters: "",
}

function docToForm(doc: CourseRow): CourseFormState {
  return {
    program_name: doc.program_name ?? "",
    course_code: doc.course_code ?? "",
    department: doc.department ?? "",
    semesters: doc.semesters ?? "",
  }
}

/** Small local label+control wrapper — only consumer is this component. */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

/**
 * "Courses Offered" (Maintenance tab): a Course (Program) master browsed one
 * record at a time — read-only until Edit or Add is pressed, matching the
 * legacy screen's Add/Edit/Delete/Find toolbar rather than an always-open form.
 */
export default function CoursesOffered() {
  const queryClient = useQueryClient()

  const coursesQuery = useQuery({
    queryKey: ["Program", "list", "courses-offered"],
    queryFn: () =>
      frappe.list<CourseRow>("Program", {
        fields: ["name", "program_name", "course_code", "department", "semesters"],
        order_by: "program_name asc",
        limit_page_length: 500,
      }),
  })

  const departmentsQuery = useQuery({
    queryKey: ["Department", "list", "courses-offered"],
    queryFn: () =>
      frappe.list<DepartmentRow>("Department", {
        filters: [["department_name", "in", ACADEMIC_DEPARTMENTS]],
        fields: ["name", "department_name"],
        order_by: "department_name asc",
        limit_page_length: 500,
      }),
  })

  const courses = coursesQuery.data ?? []

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<CourseFormState>(BLANK_FORM)
  const [isEditing, setIsEditing] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findOpen, setFindOpen] = useState(false)

  if (!initialized && courses.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? courses[selectedIndex] : null

  if (selected && selected.name !== syncedName) {
    setSyncedName(selected.name)
    setForm(docToForm(selected))
  }

  if (pendingSelectName) {
    const idx = courses.findIndex((c) => c.name === pendingSelectName)
    if (idx !== -1) {
      setSelectedIndex(idx)
      setPendingSelectName(null)
    }
  }

  function handleAdd() {
    setSelectedIndex(null)
    setSyncedName(undefined)
    setForm(BLANK_FORM)
    setIsEditing(true)
  }

  function handleEdit() {
    if (!selected) return
    setForm(docToForm(selected))
    setIsEditing(true)
  }

  function handleCancel() {
    if (selected) {
      setForm(docToForm(selected))
    } else {
      setForm(BLANK_FORM)
    }
    setIsEditing(false)
  }

  function selectRecord(idx: number) {
    if (idx < 0 || idx >= courses.length) return
    setSelectedIndex(idx)
  }

  const findMatches = findQuery.trim()
    ? courses.filter(
        (c) =>
          c.course_code?.toLowerCase().includes(findQuery.trim().toLowerCase()) ||
          c.program_name?.toLowerCase().includes(findQuery.trim().toLowerCase())
      )
    : []

  function jumpToCourse(name: string) {
    const idx = courses.findIndex((c) => c.name === name)
    if (idx !== -1) setSelectedIndex(idx)
    setFindOpen(false)
  }

  function handleFind() {
    const query = findQuery.trim().toLowerCase()
    if (!query) return
    const idx = courses.findIndex(
      (c) =>
        c.course_code?.toLowerCase().includes(query) ||
        c.program_name?.toLowerCase().includes(query)
    )
    if (idx === -1) {
      toast.info(`No course found matching "${findQuery}"`)
      return
    }
    setSelectedIndex(idx)
    setFindOpen(false)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        program_name: form.program_name,
        course_code: form.course_code || undefined,
        department: form.department || undefined,
        semesters: form.semesters || undefined,
      }
      return selected
        ? frappe.updateDoc<CourseRow>("Program", selected.name, payload)
        : frappe.createDoc<CourseRow>("Program", payload)
    },
    onSuccess: async (saved) => {
      toast.success("Course saved")
      setPendingSelectName(saved.name)
      setIsEditing(false)
      await queryClient.invalidateQueries({ queryKey: ["Program"] })
    },
    onError: (error) => toast.error(`Could not save course: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("Program", selected!.name),
    onSuccess: async () => {
      toast.success("Course deleted")
      setSelectedIndex(null)
      setSyncedName(undefined)
      setForm(BLANK_FORM)
      await queryClient.invalidateQueries({ queryKey: ["Program"] })
    },
    onError: (error) => toast.error(`Could not delete course: ${getErrorMessage(error)}`),
  })

  const canSave = !!form.program_name && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-black/20 h-full p-6 grid gap-5 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-4">
        <Button type="button" disabled={isEditing} onClick={handleAdd}>
          <PlusIcon /> Add
        </Button>
        <Button type="button" variant="outline" disabled={isEditing || !selected} onClick={handleEdit}>
          <PencilIcon /> Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isEditing || !selected || deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2Icon /> Delete
        </Button>

        <div
          className="relative flex items-center gap-2 ml-4"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFindOpen(false)
          }}
        >
          <Input
            placeholder="Find by code or description…"
            className="w-64"
            value={findQuery}
            disabled={isEditing}
            onChange={(e) => {
              setFindQuery(e.target.value)
              setFindOpen(true)
            }}
            onFocus={() => setFindOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleFind()
              } else if (e.key === "Escape") {
                setFindOpen(false)
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" disabled={isEditing} onClick={handleFind}>
            <SearchIcon />
          </Button>

          {findOpen && findQuery.trim() && !isEditing && (
            <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 max-h-64 overflow-y-auto p-1">
              {findMatches.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No matches.</div>
              ) : (
                findMatches.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className="w-full text-left rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => jumpToCourse(c.name)}
                  >
                    {c.course_code ? `${c.course_code} — ` : ""}
                    {c.program_name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {isEditing && (
          <div className="ml-auto flex gap-2">
            <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
        <Field id="course-code" label="Course Code">
          <Input
            id="course-code"
            value={form.course_code}
            disabled={!isEditing}
            onChange={(e) => setForm((prev) => ({ ...prev, course_code: e.target.value }))}
          />
        </Field>
        <Field id="course-description" label="Description">
          <Input
            id="course-description"
            value={form.program_name}
            disabled={!isEditing || !!selected}
            onChange={(e) => setForm((prev) => ({ ...prev, program_name: e.target.value }))}
          />
        </Field>
        <Field id="course-department" label="Department">
          <Select
            value={form.department}
            disabled={!isEditing}
            onValueChange={(v) => setForm((prev) => ({ ...prev, department: v ?? "" }))}
          >
            <SelectTrigger id="course-department" className="w-full">
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              {(departmentsQuery.data ?? []).map((d) => (
                <SelectItem key={d.name} value={d.name}>
                  {d.department_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="course-semesters" label="Semesters">
          <Select
            value={form.semesters}
            disabled={!isEditing}
            onValueChange={(v) => setForm((prev) => ({ ...prev, semesters: v ?? "" }))}
          >
            <SelectTrigger id="course-semesters" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {SEMESTER_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-black/10 pt-4 mt-auto">
        <div className="text-sm text-muted-foreground">
          {selectedIndex !== null && courses.length > 0
            ? `Record ${selectedIndex + 1} of ${courses.length}`
            : "New Course"}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord(0)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord((selectedIndex ?? 0) - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex >= courses.length - 1}
            onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex >= courses.length - 1}
            onClick={() => selectRecord(courses.length - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
