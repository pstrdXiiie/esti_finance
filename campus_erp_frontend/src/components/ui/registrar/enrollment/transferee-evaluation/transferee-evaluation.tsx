"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Trash2Icon } from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import StudentSearch, { StudentOption } from "@/components/sms/StudentSearch"

interface PriorGradeRow {
  name: string
  subject_code: string
  description: string
  unit: number
  grade: string
  completion: string
  remarks: string
  school_year: string
  semester: number
  school: string
}

interface CurriculumSubjectRow {
  year_level: number
  semester: number
  subject: string
  subject_name: string
  subject_code: string
  unit: number
  completed: boolean
  credited: boolean
}

interface TransferEvaluation {
  program: string | null
  prior_grades: PriorGradeRow[]
  curriculum_subjects: CurriculumSubjectRow[]
}

const emptyForm = {
  school: "",
  subjectCode: "",
  description: "",
  unit: "",
  grade: "",
  schoolYear: "",
  semester: "",
  completion: "",
  remarks: "",
}

/**
 * Transferee Evaluation tab: look up a student, review whatever prior-school
 * grades the registrar has recorded for them (SMS Transferee Grade — a plain
 * flat doctype, plain CRUD, no business rule involved), and credit those
 * records one at a time against the student's actual curriculum subjects
 * (campus_erp.api.registrar.get_transfer_evaluation /
 * credit_transfer). Crediting is intentionally one-directional in this pass —
 * no undo once a subject shows Credited.
 */
export default function TransfereeEvaluation() {
  const [student, setStudent] = useState<StudentOption | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const queryClient = useQueryClient()

  // Reset the add-record panel whenever the resolved student changes, without
  // a useEffect: React explicitly supports adjusting state during rendering
  // (see "Adjusting state when a prop changes" in the React docs) — the guard
  // makes this a one-time correction per student change, not a render loop.
  const [lastStudentName, setLastStudentName] = useState(student?.name)
  if (lastStudentName !== student?.name) {
    setLastStudentName(student?.name)
    setShowAddForm(false)
    setForm(emptyForm)
  }

  const queryKey = ["transfer-evaluation", student?.name]

  const evaluationQuery = useQuery({
    queryKey,
    queryFn: () =>
      frappe.call<TransferEvaluation>(
        "campus_erp.api.registrar.get_transfer_evaluation",
        { student: student!.name }
      ),
    enabled: !!student,
  })

  const evaluation = evaluationQuery.data ?? null

  const priorGrades = evaluation?.prior_grades ?? []
  const curriculumSubjects = evaluation?.curriculum_subjects ?? []

  const updateField = (key: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const canSave =
    !!form.school.trim() &&
    !!form.description.trim() &&
    !!form.unit.trim() &&
    !!form.grade.trim() &&
    !!form.semester.trim() &&
    !!form.remarks.trim()

  const addRecordMutation = useMutation({
    mutationFn: () =>
      frappe.createDoc("SMS Transferee Grade", {
        student: student!.name,
        subject_code: form.subjectCode,
        description: form.description,
        unit: Number(form.unit),
        grade: form.grade,
        completion: form.completion,
        remarks: form.remarks,
        school_year: form.schoolYear,
        semester: Number(form.semester),
        school: form.school,
      }),
    onSuccess: async () => {
      await evaluationQuery.refetch()
      setForm(emptyForm)
      setShowAddForm(false)
      toast.success("Record added")
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const deleteRecordMutation = useMutation({
    mutationFn: (name: string) => frappe.deleteDoc("SMS Transferee Grade", name),
    onSuccess: () => {
      evaluationQuery.refetch()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const creditMutation = useMutation({
    mutationFn: (row: CurriculumSubjectRow) =>
      frappe.call<TransferEvaluation>(
        "campus_erp.api.registrar.credit_transfer",
        {
          student: student!.name,
          subject: row.subject,
          year_level: row.year_level,
          semester: row.semester,
        }
      ),
    onSuccess: (result, row) => {
      queryClient.setQueryData(queryKey, result)
      toast.success(`Credited ${row.subject_name}`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const creditingSubject = creditMutation.isPending
    ? creditMutation.variables?.subject
    : undefined

  // One shared "not ready yet" state drives both tables' placeholder rows —
  // whichever reason applies (no student searched, query in flight, or a
  // resolved student with no Program Enrollment), so the table shells (and
  // their column headers) are always visible instead of leaving blank space
  // until a fully-loaded, program-bearing student is picked.
  const notReadyMessage = !student
    ? "Search for a student to view their transferee evaluation."
    : evaluationQuery.isLoading
      ? "Loading…"
      : evaluation && evaluation.program == null
        ? "This student has no Program Enrollment on record."
        : null
  const isReady = notReadyMessage === null

  return (
    <div className="rounded-2xl border border-black/20 h-full p-7">
      <div className="flex items-start w-full pb-5">
        <StudentSearch
          selected={student}
          onSelect={setStudent}
          idPrefix="transferee-evaluation"
        />
      </div>

      <div className="grid gap-6">
        <section className="grid gap-3">
          <h2 className="font-semibold">Prior School Records</h2>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Subject Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>School Year</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isReady &&
                  priorGrades.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell>{row.school}</TableCell>
                      <TableCell>{row.subject_code}</TableCell>
                      <TableCell className="font-medium">
                        {row.description}
                      </TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell>{row.grade}</TableCell>
                      <TableCell>{row.school_year}</TableCell>
                      <TableCell>{row.semester}</TableCell>
                      <TableCell>{row.completion}</TableCell>
                      <TableCell>{row.remarks}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={deleteRecordMutation.isPending}
                          onClick={() => deleteRecordMutation.mutate(row.name)}
                          aria-label={`Remove ${row.description}`}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                {isReady && priorGrades.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground text-center">
                      No prior school records on file.
                    </TableCell>
                  </TableRow>
                )}
                {!isReady && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-muted-foreground text-center">
                      {notReadyMessage}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {isReady && !showAddForm && (
            <div>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(true)}>
                + Add Record
              </Button>
            </div>
          )}

            {showAddForm && (
              <div className="grid gap-3 rounded-md border border-black/20 p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="grid gap-1">
                    <label htmlFor="transferee-school">School</label>
                    <Input
                      id="transferee-school"
                      value={form.school}
                      onChange={updateField("school")}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="transferee-subject-code">Subject Code</label>
                    <Input
                      id="transferee-subject-code"
                      value={form.subjectCode}
                      onChange={updateField("subjectCode")}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="transferee-description">Description</label>
                    <Input
                      id="transferee-description"
                      value={form.description}
                      onChange={updateField("description")}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="transferee-unit">Unit</label>
                    <Input
                      id="transferee-unit"
                      type="number"
                      value={form.unit}
                      onChange={updateField("unit")}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="transferee-grade">Grade</label>
                    <Input
                      id="transferee-grade"
                      value={form.grade}
                      onChange={updateField("grade")}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="transferee-school-year">School Year</label>
                    <Input
                      id="transferee-school-year"
                      value={form.schoolYear}
                      onChange={updateField("schoolYear")}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="transferee-semester">Semester</label>
                    <Input
                      id="transferee-semester"
                      type="number"
                      value={form.semester}
                      onChange={updateField("semester")}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="transferee-completion">Completion</label>
                    <Input
                      id="transferee-completion"
                      value={form.completion}
                      onChange={updateField("completion")}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label htmlFor="transferee-remarks">Remarks</label>
                    <Input
                      id="transferee-remarks"
                      value={form.remarks}
                      onChange={updateField("remarks")}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    disabled={!canSave || addRecordMutation.isPending}
                    onClick={() => addRecordMutation.mutate()}
                  >
                    {addRecordMutation.isPending ? "Saving…" : "Save Record"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={addRecordMutation.isPending}
                    onClick={() => {
                      setForm(emptyForm)
                      setShowAddForm(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-3">
            <h2 className="font-semibold">Curriculum Credit Evaluation</h2>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year Level</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Subject Code</TableHead>
                    <TableHead>Subject Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isReady &&
                    curriculumSubjects.map((row) => (
                      <TableRow key={`${row.year_level}-${row.semester}-${row.subject}`}>
                        <TableCell>{row.year_level}</TableCell>
                        <TableCell>{row.semester}</TableCell>
                        <TableCell>{row.subject_code}</TableCell>
                        <TableCell className="font-medium">{row.subject_name}</TableCell>
                        <TableCell>{row.unit}</TableCell>
                        <TableCell>
                          {row.completed ? (
                            <Badge variant="secondary">Completed</Badge>
                          ) : row.credited ? (
                            <Badge variant="secondary">Credited</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {!row.completed && !row.credited && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={creditingSubject === row.subject}
                              onClick={() => creditMutation.mutate(row)}
                            >
                              {creditingSubject === row.subject ? "Crediting…" : "Credit"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  {isReady && curriculumSubjects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground text-center">
                        No curriculum subjects found.
                      </TableCell>
                    </TableRow>
                  )}
                  {!isReady && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground text-center">
                        {notReadyMessage}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
    </div>
  )
}
