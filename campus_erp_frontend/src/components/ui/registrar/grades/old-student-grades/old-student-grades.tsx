"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
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
import { Badge } from "@/components/ui/badge"
import { formatAcademicYearLabel } from "@/lib/utils"

interface AcademicYearRow {
  name: string
  academic_year_name: string
}

interface ProgramRow {
  name: string
  program_name: string
}

interface GradeRow {
  name: string
  student: string
  student_name: string
  course: string
  program: string
  program_enrollment: string
  student_group: string
  prelim: number | null
  midterm: number | null
  final: number | null
  final_rating: string | null
  grade_remarks: string | null
  points: number | null
  status: string
  course_name: string
  subject_code: string | null
  academic_year: string
  academic_term: string
  student_status: string
}

const COLUMN_COUNT = 13

/**
 * Old Student Grades tab: grade history for former (non-Active) students,
 * via campus_erp.api.registrar.list_grades with only_inactive_students
 * always on. School Year and Program are optional narrowing filters, unlike
 * All Grades — both start unset/"All" here because a former student's grade
 * history can span many years, and this view's whole point is showing that
 * full history rather than defaulting to one recent term. No search gate,
 * loads on mount and re-filters as the two Selects change.
 */
export default function OldStudentGrades() {
  const [academicYear, setAcademicYear] = useState("")
  const [program, setProgram] = useState("")

  const academicYearsQuery = useQuery({
    queryKey: ["Academic Year", "list", "old-student-grades"],
    queryFn: () =>
      frappe.list<AcademicYearRow>("Academic Year", {
        fields: ["name", "academic_year_name"],
        order_by: "year_start_date desc",
        limit_page_length: 50,
      }),
  })

  const programsQuery = useQuery({
    queryKey: ["Program", "list", "old-student-grades"],
    queryFn: () =>
      frappe.list<ProgramRow>("Program", {
        fields: ["name", "program_name"],
        limit_page_length: 100,
      }),
  })

  const gradesQuery = useQuery({
    queryKey: ["old-student-grades", academicYear, program],
    queryFn: () =>
      frappe.call<GradeRow[]>("campus_erp.api.registrar.list_grades", {
        academic_year: academicYear || undefined,
        program: program || undefined,
        only_inactive_students: true,
      }),
  })

  const rows = gradesQuery.data ?? []

  // Same "always show the table shell" treatment as the rest of the Grades
  // tab: one not-ready message drives the placeholder row instead of hiding
  // the whole table until data has loaded. This view has no external gate
  // like a student search, so zero rows for a given filter combo is a normal
  // (not "not ready") outcome once loaded.
  const notReadyMessage = gradesQuery.isLoading ? "Loading…" : null
  const isReady = notReadyMessage === null

  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <div className="flex gap-5 items-end pb-5">
        <div className="grid gap-1.5">
          <label htmlFor="old-student-grades-school-year">School Year</label>
          <Select
            value={academicYear}
            onValueChange={(v) => setAcademicYear(v ?? "")}
          >
            <SelectTrigger id="old-student-grades-school-year" className="w-48">
              <SelectValue placeholder="All School Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All School Years</SelectItem>
              {(academicYearsQuery.data ?? []).map((ay) => (
                <SelectItem key={ay.name} value={ay.name}>
                  {formatAcademicYearLabel(ay.academic_year_name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="old-student-grades-program">Program</label>
          <Select value={program} onValueChange={(v) => setProgram(v ?? "")}>
            <SelectTrigger id="old-student-grades-program" className="w-56">
              <SelectValue placeholder="All Programs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Programs</SelectItem>
              {(programsQuery.data ?? []).map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.program_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="max-w-48">Course</TableHead>
              <TableHead>Subject Code</TableHead>
              <TableHead className="max-w-56">Program</TableHead>
              <TableHead>School Year</TableHead>
              <TableHead>Prelim</TableHead>
              <TableHead>Midterm</TableHead>
              <TableHead>Final</TableHead>
              <TableHead>Final Rating</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Student Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isReady &&
              rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">
                    {row.student_name}
                  </TableCell>
                  <TableCell className="max-w-48 truncate" title={row.course_name}>
                    {row.course_name}
                  </TableCell>
                  <TableCell>{row.subject_code ?? "—"}</TableCell>
                  <TableCell className="max-w-56 truncate" title={row.program}>
                    {row.program}
                  </TableCell>
                  <TableCell>{formatAcademicYearLabel(row.academic_year)}</TableCell>
                  <TableCell>{row.prelim ?? "—"}</TableCell>
                  <TableCell>{row.midterm ?? "—"}</TableCell>
                  <TableCell>{row.final ?? "—"}</TableCell>
                  <TableCell>{row.final_rating ?? "—"}</TableCell>
                  <TableCell>{row.grade_remarks ?? "—"}</TableCell>
                  <TableCell>{row.points ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "Completed" ? "secondary" : "outline"}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.student_status === "Active" ? "secondary" : "outline"}
                    >
                      {row.student_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            {isReady && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="text-muted-foreground text-center"
                >
                  No grades found for former students with these filters.
                </TableCell>
              </TableRow>
            )}
            {!isReady && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="text-muted-foreground text-center"
                >
                  {notReadyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
