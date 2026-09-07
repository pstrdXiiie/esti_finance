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

interface SubjectRow {
  name: string
  course_name: string
  subject_code: string | null
  unit: number | null
  course_desc: string | null
}

interface SubjectFormState {
  course_name: string
  subject_code: string
  unit: string
  course_desc: string
}

const BLANK_FORM: SubjectFormState = {
  course_name: "",
  subject_code: "",
  unit: "",
  course_desc: "",
}

function docToForm(doc: SubjectRow): SubjectFormState {
  return {
    course_name: doc.course_name ?? "",
    subject_code: doc.subject_code ?? "",
    unit: doc.unit != null ? String(doc.unit) : "",
    course_desc: doc.course_desc ?? "",
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

const textareaClassName =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 resize-y"

/**
 * "Subject Description" (Maintenance tab): a Subject (Course doctype) master
 * browsed one record at a time — read-only until Edit or Add is pressed,
 * matching the same Add/Edit/Delete/Find pattern as Courses Offered.
 */
export default function SubjectDescription() {
  const queryClient = useQueryClient()

  const subjectsQuery = useQuery({
    queryKey: ["Course", "list", "subject-description"],
    queryFn: () =>
      frappe.list<SubjectRow>("Course", {
        fields: ["name", "course_name", "subject_code", "unit", "course_desc"],
        order_by: "course_name asc",
        limit_page_length: 500,
      }),
  })

  const subjects = subjectsQuery.data ?? []

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<SubjectFormState>(BLANK_FORM)
  const [isEditing, setIsEditing] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findOpen, setFindOpen] = useState(false)

  if (!initialized && subjects.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? subjects[selectedIndex] : null

  if (selected && selected.name !== syncedName) {
    setSyncedName(selected.name)
    setForm(docToForm(selected))
  }

  if (pendingSelectName) {
    const idx = subjects.findIndex((s) => s.name === pendingSelectName)
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
    if (idx < 0 || idx >= subjects.length) return
    setSelectedIndex(idx)
  }

  const findMatches = findQuery.trim()
    ? subjects.filter(
        (s) =>
          s.subject_code?.toLowerCase().includes(findQuery.trim().toLowerCase()) ||
          s.course_name?.toLowerCase().includes(findQuery.trim().toLowerCase())
      )
    : []

  function jumpToSubject(name: string) {
    const idx = subjects.findIndex((s) => s.name === name)
    if (idx !== -1) setSelectedIndex(idx)
    setFindOpen(false)
  }

  function handleFind() {
    const query = findQuery.trim().toLowerCase()
    if (!query) return
    const idx = subjects.findIndex(
      (s) =>
        s.subject_code?.toLowerCase().includes(query) ||
        s.course_name?.toLowerCase().includes(query)
    )
    if (idx === -1) {
      toast.info(`No subject found matching "${findQuery}"`)
      return
    }
    setSelectedIndex(idx)
    setFindOpen(false)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        course_name: form.course_name,
        subject_code: form.subject_code || undefined,
        unit: form.unit ? Number(form.unit) : undefined,
        course_desc: form.course_desc || undefined,
      }
      return selected
        ? frappe.updateDoc<SubjectRow>("Course", selected.name, payload)
        : frappe.createDoc<SubjectRow>("Course", payload)
    },
    onSuccess: async (saved) => {
      toast.success("Subject saved")
      setPendingSelectName(saved.name)
      setIsEditing(false)
      await queryClient.invalidateQueries({ queryKey: ["Course"] })
    },
    onError: (error) => toast.error(`Could not save subject: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("Course", selected!.name),
    onSuccess: async () => {
      toast.success("Subject deleted")
      setSelectedIndex(null)
      setSyncedName(undefined)
      setForm(BLANK_FORM)
      await queryClient.invalidateQueries({ queryKey: ["Course"] })
    },
    onError: (error) => toast.error(`Could not delete subject: ${getErrorMessage(error)}`),
  })

  const canSave = !!form.course_name && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-black/20 h-full p-7">
      <div className="flex flex-wrap items-center gap-2 pb-5">
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
            placeholder="Find by code or name…"
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
                findMatches.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    className="w-full text-left rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => jumpToSubject(s.name)}
                  >
                    {s.subject_code ? `${s.subject_code} — ` : ""}
                    {s.course_name}
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

      <div className="grid gap-4 max-w-2xl">
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="subject-code" label="Subject Code">
            <Input
              id="subject-code"
              value={form.subject_code}
              disabled={!isEditing}
              onChange={(e) => setForm((prev) => ({ ...prev, subject_code: e.target.value }))}
            />
          </Field>
          <Field id="subject-unit" label="Unit">
            <Input
              id="subject-unit"
              type="number"
              value={form.unit}
              disabled={!isEditing}
              onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
            />
          </Field>
        </div>
        <Field id="subject-name" label="Subject Name">
          <Input
            id="subject-name"
            value={form.course_name}
            disabled={!isEditing || !!selected}
            onChange={(e) => setForm((prev) => ({ ...prev, course_name: e.target.value }))}
          />
        </Field>
        <Field id="subject-description" label="Description">
          <textarea
            id="subject-description"
            rows={5}
            className={textareaClassName}
            value={form.course_desc}
            disabled={!isEditing}
            onChange={(e) => setForm((prev) => ({ ...prev, course_desc: e.target.value }))}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-black/10 pt-4 mt-6">
        <div className="text-sm text-muted-foreground">
          {selectedIndex !== null && subjects.length > 0
            ? `Record ${selectedIndex + 1} of ${subjects.length}`
            : "New Subject"}
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
            disabled={isEditing || selectedIndex === null || selectedIndex >= subjects.length - 1}
            onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex >= subjects.length - 1}
            onClick={() => selectRecord(subjects.length - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
