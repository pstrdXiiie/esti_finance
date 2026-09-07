"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import StudentSearch, { StudentOption } from "@/components/sms/StudentSearch"

interface ScheduleEnrollmentRow {
  name: string
  course: string
  course_name: string
  student_group: string
  student_group_name: string
  days: string[]
  start_time: string | null
  end_time: string | null
  room: string | null
}

interface PrescribedSubjectRow {
  subject: string
  subject_name: string | null
  subject_code: string | null
  unit: number
  prerequisite_met: boolean | number
}

interface AvailableSubjectRow {
  course: string
  course_name: string | null
  subject_code: string | null
  unit: number
  // null when this is a curriculum subject with no offered Student Group
  // (class section) yet — still listed so the registrar can see it exists,
  // just not addable until a section is created (see Classes Offered).
  student_group: string | null
  student_group_name: string | null
  days: string[]
  start_time: string | null
  end_time: string | null
  room: string | null
  is_prescribed: boolean | number
  prerequisite_met: boolean | number
}

interface StudentSchedule {
  academic_year: string | null
  academic_term: string | null
  program: string | null
  year_level: number | null
  semester: number | null
  prescribed_subjects: PrescribedSubjectRow[]
  enrollments: ScheduleEnrollmentRow[]
  available_subjects: AvailableSubjectRow[]
}

/**
 * Add / Remove Subjects tab: look up a student and show their Pre-Enrollment
 * prescribed subjects (campus_erp.api.registrar.get_student_schedule) with
 * their current Add/Remove state. Prescribed subjects are normally already
 * enrolled by the time a registrar gets here — auto_enroll_prescribed_
 * subjects() runs as soon as Pre-Enrollment's subject listing is saved, and
 * again (idempotently) once Assessment reaches Registration — so the
 * Prescribed Subjects table's own action is usually "Remove" (the student
 * decides not to take one after all, drops the real Course Enrollment). It
 * falls back to an "Add" button, matched against the same offered-Student-
 * Group lookup auto-enroll itself uses, for the rare prescribed subject that
 * auto-enroll skipped (not yet offered, over capacity, prerequisite) - so
 * nothing prescribed is ever a dead end here even without a re-trip to
 * Pre-Enrollment. The separate "Add Subjects" table is for everything else:
 * non-prescribed electives/retakes the student wants beyond their prescribed
 * list - anything already prescribed is deliberately excluded from it, since
 * that's what the Prescribed Subjects table above is for. A row here can
 * still show up with no Section yet (Add disabled) when it's on the
 * program's curriculum but no Student Group/class has been created for it -
 * visible so the registrar knows it's expected, not silently missing, with
 * "see Classes Offered" as the next step. Both actions are immediate, no
 * draft/save concept (unlike Pre-Enrollment's staged listing).
 * Prerequisite is shown as the same Met/Not Met badge Pre-Enrollment already
 * computes rather than a separate manual "Check Prerequisites" step —
 * enroll() itself still enforces it server-side either way.
 */
export default function AddRemoveSubjects() {
  const [student, setStudent] = useState<StudentOption | null>(null)

  const scheduleQuery = useQuery({
    queryKey: ["student-schedule", student?.name],
    queryFn: () =>
      frappe.call<StudentSchedule>(
        "campus_erp.api.registrar.get_student_schedule",
        { student: student!.name }
      ),
    enabled: !!student,
  })

  const schedule = scheduleQuery.data
  const enrollments = schedule?.enrollments ?? []
  const enrollmentBySubject = new Map(enrollments.map((e) => [e.course, e]))
  const availableByCourse = new Map((schedule?.available_subjects ?? []).map((s) => [s.course, s]))

  function refetchSchedule() {
    scheduleQuery.refetch()
  }

  const enrollMutation = useMutation({
    mutationFn: (studentGroup: string) =>
      frappe.call<{ name: string }>("campus_erp.api.registrar.enroll", {
        student: student!.name,
        student_group: studentGroup,
      }),
    onSuccess: () => {
      toast.success("Student enrolled")
      refetchSchedule()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const dropMutation = useMutation({
    mutationFn: (row: ScheduleEnrollmentRow) =>
      frappe.call("campus_erp.api.registrar.drop_enrollment", {
        course_enrollment: row.name,
      }),
    onSuccess: (_result, row) => {
      toast.success("Dropped from " + row.course_name)
      refetchSchedule()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  // Shared by both tables: is there even a term to schedule against? Add
  // Subjects only needs this much - it can list electives independent of
  // whether Pre-Enrollment (and therefore any prescribed subject) exists at
  // all. The Prescribed Subjects table adds its own further "nothing
  // prescribed" message on top, since that one *is* specific to Pre-Enrollment.
  const notReadyMessage = !student
    ? "Search for a student to view their prescribed subjects."
    : scheduleQuery.isLoading
      ? "Loading…"
      : schedule && schedule.academic_year == null
        ? "This student has no Program Enrollment on record — nothing to schedule."
        : null
  const isReady = notReadyMessage === null

  const prescribedRows = schedule?.prescribed_subjects ?? []
  const addableRows = (schedule?.available_subjects ?? []).filter((s) => !s.is_prescribed)
  const prescribedNotReadyMessage =
    notReadyMessage ??
    (schedule && schedule.prescribed_subjects.length === 0
      ? "This student has no prescribed subjects on file — complete Pre-Enrollment first."
      : null)

  return (
    <div className="rounded-2xl border border-black/20 h-full p-7">
      <div className="flex gap-2 items-center pb-5">
        <StudentSearch
          selected={student}
          onSelect={setStudent}
          idPrefix="add-remove-subjects"
        />
      </div>

      <div className="grid gap-2 mb-6">
        <h2 className="font-semibold">Prescribed Subjects</h2>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject Code</TableHead>
                <TableHead>Subject Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Room</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescribedRows.map((subject) => {
                const enrollment = enrollmentBySubject.get(subject.subject)
                const candidate = !enrollment ? availableByCourse.get(subject.subject) : undefined
                const section = enrollment ?? candidate
                return (
                  <TableRow key={subject.subject}>
                    <TableCell className="font-medium">{subject.subject_code ?? "—"}</TableCell>
                    <TableCell>{subject.subject_name ?? subject.subject}</TableCell>
                    <TableCell>{subject.unit}</TableCell>
                    <TableCell>{section?.student_group_name ?? "—"}</TableCell>
                    <TableCell>{section?.days.join("/") || "—"}</TableCell>
                    <TableCell>
                      {section?.start_time && section?.end_time
                        ? `${section.start_time}–${section.end_time}`
                        : "—"}
                    </TableCell>
                    <TableCell>{section?.room ?? "—"}</TableCell>
                    <TableCell>
                      {enrollment ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={dropMutation.isPending}
                          onClick={() => dropMutation.mutate(enrollment)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!candidate?.student_group || enrollMutation.isPending}
                          title={!candidate?.student_group ? "Not yet offered — see Classes Offered" : undefined}
                          onClick={() => candidate?.student_group && enrollMutation.mutate(candidate.student_group)}
                        >
                          Add
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {prescribedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-center">
                    {prescribedNotReadyMessage ?? "No prescribed subjects."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {isReady && (
        <div className="grid gap-2">
          <h2 className="font-semibold">Add Subjects</h2>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject Code</TableHead>
                  <TableHead>Subject Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Prerequisite</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {addableRows.map((subject) => (
                  <TableRow key={subject.course}>
                    <TableCell className="font-medium">{subject.subject_code ?? "—"}</TableCell>
                    <TableCell>{subject.course_name ?? subject.course}</TableCell>
                    <TableCell>{subject.unit}</TableCell>
                    <TableCell>
                      <Badge variant={subject.prerequisite_met ? "secondary" : "destructive"}>
                        {subject.prerequisite_met ? "Met" : "Not Met"}
                      </Badge>
                    </TableCell>
                    <TableCell>{subject.student_group_name ?? "—"}</TableCell>
                    <TableCell>{subject.days.join("/") || "—"}</TableCell>
                    <TableCell>
                      {subject.start_time && subject.end_time
                        ? `${subject.start_time}–${subject.end_time}`
                        : "—"}
                    </TableCell>
                    <TableCell>{subject.room ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!subject.student_group || enrollMutation.isPending}
                        title={!subject.student_group ? "Not yet offered — see Classes Offered" : undefined}
                        onClick={() => subject.student_group && enrollMutation.mutate(subject.student_group)}
                      >
                        Add
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {addableRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground text-center">
                      No electives on offer this term that aren&apos;t already on this student&apos;s
                      prescribed list or schedule.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
