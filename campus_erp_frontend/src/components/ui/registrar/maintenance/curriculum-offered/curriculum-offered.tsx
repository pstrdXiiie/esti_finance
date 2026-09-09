"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  PlusIcon,
  MinusIcon,
  Trash2Icon,
  PrinterIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface CurriculumRow {
  name: string
  curriculum_code: string
  course: string
  curriculum_year: string | null
  sem_type: string | null
  max_units: number | null
  is_active: number
}

interface CurriculumSubjectRow {
  year_level: number
  semester: number
  subject: string
  prerequisite: string | null
}

interface CurriculumDoc extends CurriculumRow {
  subjects: CurriculumSubjectRow[]
}

interface ProgramRow {
  name: string
  program_name: string
}

interface SubjectMasterRow {
  name: string
  course_name: string
  subject_code: string
  unit: number
}

const SEM_TYPE_OPTIONS = [
  "Quarter",
  "Prelim-Midterm-Finals",
  "Trisemester",
  "Full Payment Only",
]

interface CurriculumFormState {
  curriculum_code: string
  course: string
  curriculum_year: string
  sem_type: string
  max_units: string
  is_active: boolean
}

const BLANK_FORM: CurriculumFormState = {
  curriculum_code: "",
  course: "",
  curriculum_year: "",
  sem_type: "",
  max_units: "",
  is_active: false,
}

function docToForm(doc: CurriculumDoc): CurriculumFormState {
  return {
    curriculum_code: doc.curriculum_code ?? "",
    course: doc.course ?? "",
    curriculum_year: doc.curriculum_year ?? "",
    sem_type: doc.sem_type ?? "",
    max_units: doc.max_units != null ? String(doc.max_units) : "",
    is_active: !!doc.is_active,
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
 * "Curriculum Offered" (Maintenance tab): one curriculum record at a time,
 * paged through like the legacy desktop screen it replaces, with a subject
 * sub-form scoped to a Year Level + Semester bucket underneath. Replaces the
 * standalone /registrar/curriculum list+detail route, which this screen now
 * subsumes end-to-end (browse, add, edit, delete) without a separate list page.
 */
export default function CurriculumOffered() {
  const queryClient = useQueryClient()

  const curriculaQuery = useQuery({
    queryKey: ["SMS Curriculum", "list", "curriculum-offered"],
    queryFn: () =>
      frappe.list<CurriculumRow>("SMS Curriculum", {
        fields: [
          "name",
          "curriculum_code",
          "course",
          "curriculum_year",
          "sem_type",
          "max_units",
          "is_active",
        ],
        order_by: "curriculum_code asc",
        limit_page_length: 500,
      }),
  })

  const programsQuery = useQuery({
    queryKey: ["Program", "list", "curriculum-offered"],
    queryFn: () =>
      frappe.list<ProgramRow>("Program", {
        fields: ["name", "program_name"],
        limit_page_length: 500,
      }),
  })

  const subjectsQuery = useQuery({
    queryKey: ["Course", "list", "curriculum-offered"],
    queryFn: () =>
      frappe.list<SubjectMasterRow>("Course", {
        fields: ["name", "course_name", "subject_code", "unit"],
        limit_page_length: 500,
      }),
  })

  const curricula = curriculaQuery.data ?? []
  const subjectMaster = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data])
  const subjectByName = useMemo(() => {
    const map = new Map<string, SubjectMasterRow>()
    for (const s of subjectMaster) map.set(s.name, s)
    return map
  }, [subjectMaster])

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<CurriculumFormState>(BLANK_FORM)
  const [subjectRows, setSubjectRows] = useState<CurriculumSubjectRow[]>([])
  const [currentYearLevel, setCurrentYearLevel] = useState(1)
  const [currentSemester, setCurrentSemester] = useState(1)
  const [subjectForm, setSubjectForm] = useState({ subject: "", prerequisite: "" })
  const [editingSubjectIndex, setEditingSubjectIndex] = useState<number | null>(null)

  if (!initialized && curricula.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? curricula[selectedIndex] : null

  const { data: fullDoc, isFetching: isLoadingDoc } = useQuery({
    queryKey: ["SMS Curriculum", selected?.name],
    queryFn: () => frappe.getDoc<CurriculumDoc>("SMS Curriculum", selected!.name),
    enabled: !!selected,
  })

  if (fullDoc && fullDoc.name !== syncedName) {
    setSyncedName(fullDoc.name)
    setForm(docToForm(fullDoc))
    setSubjectRows(fullDoc.subjects ?? [])
    setEditingSubjectIndex(null)
    setSubjectForm({ subject: "", prerequisite: "" })
  }

  if (pendingSelectName) {
    const idx = curricula.findIndex((c) => c.name === pendingSelectName)
    if (idx !== -1) {
      setSelectedIndex(idx)
      setPendingSelectName(null)
    }
  }

  function resetSubjectForm() {
    setSubjectForm({ subject: "", prerequisite: "" })
    setEditingSubjectIndex(null)
  }

  function handleAdd() {
    setSelectedIndex(null)
    setSyncedName(undefined)
    setForm(BLANK_FORM)
    setSubjectRows([])
    setCurrentYearLevel(1)
    setCurrentSemester(1)
    resetSubjectForm()
  }

  function handleCancel() {
    if (fullDoc) {
      setForm(docToForm(fullDoc))
      setSubjectRows(fullDoc.subjects ?? [])
    } else {
      setForm(BLANK_FORM)
      setSubjectRows([])
    }
    resetSubjectForm()
  }

  function selectRecord(idx: number) {
    if (idx < 0 || idx >= curricula.length) return
    setSelectedIndex(idx)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        curriculum_code: form.curriculum_code,
        course: form.course,
        curriculum_year: form.curriculum_year || undefined,
        sem_type: form.sem_type || undefined,
        max_units: form.max_units ? Number(form.max_units) : undefined,
        is_active: form.is_active ? 1 : 0,
        subjects: subjectRows.map((r) => ({
          year_level: r.year_level,
          semester: r.semester,
          subject: r.subject,
          prerequisite: r.prerequisite || undefined,
        })),
      }
      return selected
        ? frappe.updateDoc<CurriculumDoc>("SMS Curriculum", selected.name, payload)
        : frappe.createDoc<CurriculumDoc>("SMS Curriculum", payload)
    },
    onSuccess: async (saved) => {
      toast.success("Curriculum saved")
      setPendingSelectName(saved.name)
      await queryClient.invalidateQueries({ queryKey: ["SMS Curriculum"] })
    },
    onError: (error) => toast.error(`Could not save curriculum: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("SMS Curriculum", selected!.name),
    onSuccess: async () => {
      toast.success("Curriculum deleted")
      await queryClient.invalidateQueries({ queryKey: ["SMS Curriculum"] })
      handleAdd()
    },
    onError: (error) => toast.error(`Could not delete curriculum: ${getErrorMessage(error)}`),
  })

  // "Save Subject" reads as a save, but used to only stage the row into
  // local subjectRows state - the row was silently lost unless the
  // separate, visually distant top-toolbar "Save" was clicked afterward
  // too, which looked exactly like "Save Subject doesn't save" from the
  // registrar's side. It now persists immediately (same updateDoc shape as
  // the top-level Save) whenever there's already a saved curriculum record
  // to persist against; for a brand-new, not-yet-created curriculum there's
  // no parent doc yet to attach a child row to, so this still only stages
  // locally - the top-level Save's own createDoc call picks up whatever
  // is staged once the record itself is created.
  const saveSubjectMutation = useMutation({
    mutationFn: async () => {
      const isNewSubject = editingSubjectIndex === null
      const newRow: CurriculumSubjectRow = {
        year_level: currentYearLevel,
        semester: currentSemester,
        subject: subjectForm.subject,
        prerequisite: subjectForm.prerequisite || null,
      }
      const nextRows = isNewSubject
        ? [...subjectRows, newRow]
        : subjectRows.map((r, i) => (i === editingSubjectIndex ? newRow : r))

      if (!selected) {
        return { rows: nextRows, persisted: false as const, isNewSubject, newRow }
      }

      const saved = await frappe.updateDoc<CurriculumDoc>("SMS Curriculum", selected.name, {
        subjects: nextRows.map((r) => ({
          year_level: r.year_level,
          semester: r.semester,
          subject: r.subject,
          prerequisite: r.prerequisite || undefined,
        })),
      })
      return { rows: saved.subjects, persisted: true as const, isNewSubject, newRow }
    },
    onSuccess: async ({ rows, persisted, isNewSubject, newRow }) => {
      setSubjectRows(rows)
      resetSubjectForm()
      if (!persisted) return

      toast.success("Subject saved")
      await queryClient.invalidateQueries({ queryKey: ["SMS Curriculum"] })

      // A brand-new curriculum subject should also reach every student
      // already pre-enrolled for this same program/year/semester whose
      // listing hasn't been assessed yet - see sync_curriculum_subject_
      // to_pre_enrollments for why it's scoped to Subject Listing only.
      if (isNewSubject && form.course) {
        try {
          const { synced } = await frappe.call<{ synced: string[] }>(
            "campus_erp.api.registrar.sync_curriculum_subject_to_pre_enrollments",
            {
              program: form.course,
              subject: newRow.subject,
              year_level: newRow.year_level,
              semester: newRow.semester,
            }
          )
          if (synced.length > 0) {
            toast.success(
              `Added to ${synced.length} student${synced.length === 1 ? "" : "s"} already pre-enrolled this term`
            )
          }
        } catch (error) {
          toast.error(`Subject saved, but syncing to pre-enrolled students failed: ${getErrorMessage(error)}`)
        }
      }
    },
    onError: (error) => toast.error(`Could not save subject: ${getErrorMessage(error)}`),
  })

  function handleSaveSubject() {
    if (!subjectForm.subject) return
    saveSubjectMutation.mutate()
  }

  function handleEditSubjectRow(idx: number) {
    const row = subjectRows[idx]
    setSubjectForm({ subject: row.subject, prerequisite: row.prerequisite ?? "" })
    setEditingSubjectIndex(idx)
  }

  // Same reasoning as saveSubjectMutation above - Remove staying local-only
  // while Save Subject persists immediately would have just traded one
  // "doesn't actually save" surprise for a "deleted it but it came back"
  // one in the opposite direction. Persists immediately against an
  // existing record; still local-only for a brand-new, not-yet-created one.
  const removeSubjectMutation = useMutation({
    mutationFn: async (idx: number) => {
      const nextRows = subjectRows.filter((_, i) => i !== idx)
      if (!selected) {
        return { rows: nextRows, persisted: false as const, idx }
      }
      const saved = await frappe.updateDoc<CurriculumDoc>("SMS Curriculum", selected.name, {
        subjects: nextRows.map((r) => ({
          year_level: r.year_level,
          semester: r.semester,
          subject: r.subject,
          prerequisite: r.prerequisite || undefined,
        })),
      })
      return { rows: saved.subjects, persisted: true as const, idx }
    },
    onSuccess: async ({ rows, persisted, idx }) => {
      setSubjectRows(rows)
      if (editingSubjectIndex === idx) resetSubjectForm()
      if (persisted) {
        toast.success("Subject removed")
        await queryClient.invalidateQueries({ queryKey: ["SMS Curriculum"] })
      }
    },
    onError: (error) => toast.error(`Could not remove subject: ${getErrorMessage(error)}`),
  })

  function handleRemoveSubjectRow(idx: number) {
    removeSubjectMutation.mutate(idx)
  }

  // Save Subject and Remove both read-then-write the full subjectRows array
  // against the same record - letting them overlap risks one clobbering the
  // other with a stale snapshot once both resolve, so each is disabled
  // while the other is in flight (see the Save Subject and Remove buttons).
  const subjectMutationPending = saveSubjectMutation.isPending || removeSubjectMutation.isPending

  function stepYearLevel(delta: number) {
    setCurrentYearLevel((prev) => Math.max(1, prev + delta))
    resetSubjectForm()
  }

  const maxUsedYearLevel = subjectRows.reduce((max, r) => Math.max(max, r.year_level), 0)

  const filteredSubjectEntries = subjectRows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => row.year_level === currentYearLevel && row.semester === currentSemester)

  const totalUnitsForBucket = filteredSubjectEntries.reduce(
    (sum, { row }) => sum + (subjectByName.get(row.subject)?.unit ?? 0),
    0
  )

  const selectedSubjectMaster = subjectForm.subject ? subjectByName.get(subjectForm.subject) : undefined

  const canSave = !!form.curriculum_code && !!form.course && !saveMutation.isPending

  function subjectOptionLabel(s: SubjectMasterRow) {
    return s.subject_code ? `${s.subject_code} — ${s.course_name}` : s.course_name
  }

  return (
    <div className="rounded-2xl border border-border h-full p-6 flex flex-col gap-5 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Button type="button" onClick={handleAdd}>
          <PlusIcon /> Add
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!selected || deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2Icon /> Delete
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <PrinterIcon /> Print
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {selected && isLoadingDoc ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Field id="curr-code" label="Curriculum Code">
              <Input
                id="curr-code"
                value={form.curriculum_code}
                disabled={!!selected}
                onChange={(e) => setForm((prev) => ({ ...prev, curriculum_code: e.target.value }))}
              />
            </Field>
            <Field id="curr-sy" label="S.Y.">
              <Input
                id="curr-sy"
                placeholder="e.g. 2026-2027"
                value={form.curriculum_year}
                onChange={(e) => setForm((prev) => ({ ...prev, curriculum_year: e.target.value }))}
              />
            </Field>
            <Field id="curr-course" label="Course">
              <Select
                
                value={form.course}
                onValueChange={(v) => setForm((prev) => ({ ...prev, course: v ?? "" }))}
              >
                <SelectTrigger id="curr-course" className="w-[250px]">
                  <SelectValue placeholder="Select Course" />
                </SelectTrigger>
                <SelectContent>
                  {(programsQuery.data ?? []).map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.program_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          

          <div className="grid gap-4 md:grid-cols-4 items-end">
            <Field id="curr-max-units" label="Maximum Load of Units">
              <Input
                className="w-[150px]"
                id="curr-max-units"
                type="number"
                value={form.max_units}
                onChange={(e) => setForm((prev) => ({ ...prev, max_units: e.target.value }))}
              />
            </Field>
            <div className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                id="curr-is-active"
                className="h-4 w-4"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              <label htmlFor="curr-is-active">Current Curriculum</label>
            </div>
              <div className="flex flex-col gap-2">
                <span>Semester</span>
                  <Select
                    value={String(currentSemester)}
                    onValueChange={(v) => { setCurrentSemester(Number(v)); resetSubjectForm() }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              <div className="flex flex-col gap-2">
                <span>Year Level</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={currentYearLevel <= 1}
                    onClick={() => stepYearLevel(-1)}
                    aria-label="Decrease year level"
                  >
                    <MinusIcon />
                  </Button>
                  <span className="w-6 text-center font-medium">{currentYearLevel}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => stepYearLevel(1)}
                    aria-label="Increase year level"
                  >
                    <PlusIcon />
                  </Button>
                </div>
                {maxUsedYearLevel > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Subjects on file up to Year {maxUsedYearLevel}
                  </span>
                )}
              </div>
          </div>

          <div className="grid gap-3 rounded-md border p-4">
            <span className="text-sm font-semibold text-muted-foreground">Prescribed Subjects</span>

            <div className="flex flex-wrap items-end gap-4">
              <Field id="subj-code" label="Subject">
                <Select
                  value={subjectForm.subject}
                  onValueChange={(v) => setSubjectForm((prev) => ({ ...prev, subject: v ?? "" }))}
                >
                  <SelectTrigger id="subj-code" className="w-64">
                    <SelectValue placeholder="Select a subject…" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectMaster.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {subjectOptionLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="subj-unit" label="Unit">
                <Input id="subj-unit" className="w-20" value={selectedSubjectMaster?.unit ?? ""} disabled />
              </Field>
              <Field id="subj-description" label="Description">
                <Input
                  id="subj-description"
                  className="w-64"
                  value={selectedSubjectMaster?.course_name ?? ""}
                  disabled
                />
              </Field>
              <Field id="subj-prereq" label="PreRequisite">
                <Select
                  value={subjectForm.prerequisite}
                  onValueChange={(v) => setSubjectForm((prev) => ({ ...prev, prerequisite: v ?? "" }))}
                >
                  <SelectTrigger id="subj-prereq" className="w-64">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectMaster.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {subjectOptionLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                type="button"
                variant="outline"
                disabled={!subjectForm.subject || subjectMutationPending}
                onClick={handleSaveSubject}
              >
                {saveSubjectMutation.isPending
                  ? "Saving…"
                  : editingSubjectIndex !== null
                    ? "Update Subject"
                    : "Save Subject"}
              </Button>
              <div className="ml-auto text-right">
                <div className="text-xs text-muted-foreground">Total Units</div>
                <div className="text-xl font-bold text-destructive">{totalUnitsForBucket}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
            
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>PreReq</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubjectEntries.map(({ row, idx }) => {
                    const subj = subjectByName.get(row.subject)
                    const prereq = row.prerequisite ? subjectByName.get(row.prerequisite) : undefined
                    return (
                      <TableRow
                        key={idx}
                        className="cursor-pointer"
                        data-state={editingSubjectIndex === idx ? "selected" : undefined}
                        onClick={() => handleEditSubjectRow(idx)}
                      >
                        <TableCell>{subj?.subject_code ?? row.subject}</TableCell>
                        <TableCell>{subj?.course_name ?? "—"}</TableCell>
                        <TableCell>{subj?.unit ?? "—"}</TableCell>
                        <TableCell>{prereq ? subjectOptionLabel(prereq) : "—"}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={subjectMutationPending}
                            aria-label={`Remove ${subj?.course_name ?? row.subject}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveSubjectRow(idx)
                            }}
                          >
                            <Trash2Icon />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredSubjectEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No subjects for Year {currentYearLevel}, Semester {currentSemester}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["Course", "list", "curriculum-offered"] })
                }
              >
                Refresh
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="text-sm text-muted-foreground">
          {selectedIndex !== null && curricula.length > 0
            ? `Record ${selectedIndex + 1} of ${curricula.length}`
            : "New Curriculum"}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord(0)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord((selectedIndex ?? 0) - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex >= curricula.length - 1}
            onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex >= curricula.length - 1}
            onClick={() => selectRecord(curricula.length - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
