"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import { formatAcademicYearLabel } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import InstructorSearch, {
  InstructorOption,
} from "@/components/sms/InstructorSearch"

interface InstructorGradeRosterRow {
  name: string
  student: string
  student_name: string
  student_group: string
  prelim: number | null
  midterm: number | null
  final: number | null
  final_rating: string | null
  grade_remarks: string | null
  points: number | null
  status: string
}

interface InstructorGradeClass {
  student_group: string
  student_group_name: string
  course: string
  course_name: string
  academic_year: string
  days: string[]
  start_time: string | null
  end_time: string | null
  room: string | null
  roster: InstructorGradeRosterRow[]
}

interface InstructorGrades {
  classes: InstructorGradeClass[]
}

/**
 * By Teacher tab: look up an instructor and show the grade roster for every
 * active class they're teaching, via
 * campus_erp.api.registrar.get_instructor_grades. Purely a read-only report
 * — no edit inputs, no Save/Compute/Drop — grade entry stays the sole job of
 * the Enrollment tab's Class Roster panel.
 */
export default function ByTeacher() {
  const [instructor, setInstructor] = useState<InstructorOption | null>(null)

  const gradesQuery = useQuery({
    queryKey: ["instructor-grades", instructor?.name],
    queryFn: () =>
      frappe.call<InstructorGrades>(
        "campus_erp.api.registrar.get_instructor_grades",
        { instructor: instructor!.name }
      ),
    enabled: !!instructor,
  })

  const classes = gradesQuery.data?.classes ?? []

  // There's no single outer table here (one table per class, count varies),
  // so — unlike the shared-table tabs — the not-ready message drives a
  // single placeholder block in place of the class blocks entirely, rather
  // than a placeholder row inside an always-visible table shell.
  const notReadyMessage = !instructor
    ? "Search for an instructor to view their classes' grades."
    : gradesQuery.isLoading
      ? "Loading…"
      : classes.length === 0
        ? "No active class assignments for this instructor."
        : null
  const isReady = notReadyMessage === null

  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <div className="flex gap-2 items-center pb-5">
        <InstructorSearch
          selected={instructor}
          onSelect={setInstructor}
          idPrefix="by-teacher"
        />
      </div>

      {isReady ? (
        classes.map((cls, index) => (
          <div key={cls.student_group}>
            <div className="rounded-md border p-4 mb-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
                <span className="font-semibold">{cls.course_name}</span>
                <span>Section: {cls.student_group_name}</span>
                <span>School Year: {formatAcademicYearLabel(cls.academic_year)}</span>
                <span>Days: {cls.days.join("/")}</span>
                <span>
                  Time:{" "}
                  {cls.start_time && cls.end_time
                    ? `${cls.start_time}–${cls.end_time}`
                    : "—"}
                </span>
                <span>Room: {cls.room ?? "—"}</span>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Prelim</TableHead>
                      <TableHead>Midterm</TableHead>
                      <TableHead>Final</TableHead>
                      <TableHead>Final Rating</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cls.roster.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">
                          {row.student_name}
                        </TableCell>
                        <TableCell>{row.prelim ?? ""}</TableCell>
                        <TableCell>{row.midterm ?? ""}</TableCell>
                        <TableCell>{row.final ?? ""}</TableCell>
                        <TableCell>{row.final_rating ?? ""}</TableCell>
                        <TableCell>{row.grade_remarks ?? ""}</TableCell>
                        <TableCell>{row.points ?? ""}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "Completed" ? "secondary" : "outline"}>
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {cls.roster.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-muted-foreground text-center"
                        >
                          No students in this class.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {index < classes.length - 1 ? <Separator className="mb-4" /> : null}
          </div>
        ))
      ) : (
        <div className="rounded-md border p-4">
          <p className="text-muted-foreground text-center">{notReadyMessage}</p>
        </div>
      )}
    </div>
  )
}
