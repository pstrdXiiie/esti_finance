"use client"

import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TransfereeGradeRow {
  name: string
  student: string
  subject_code: string | null
  description: string
  unit: number
  grade: string
  completion: string | null
  remarks: string
  school_year: string | null
  semester: number
  school: string
}

interface StudentLookup {
  name: string
  student_name: string
  stdnt_cno: string | null
}

const COLUMN_COUNT = 10

/**
 * Transferee Grades tab: every SMS Transferee Grade record on file — the
 * credited coursework transferee students bring in from a prior school.
 * Purely a read-only report, no search/filter gate — it loads on mount, in
 * the spirit of Pre-Registration Record. SMS Transferee Grade only stores a
 * bare `student` Link with no cached name field, so student display names
 * are resolved with a second, chained query once the rows are in hand.
 */
export default function TransfereeGrades() {
  const gradesQuery = useQuery({
    queryKey: ["transferee-grades"],
    queryFn: () =>
      frappe.list<TransfereeGradeRow>("SMS Transferee Grade", {
        fields: [
          "name",
          "student",
          "subject_code",
          "description",
          "unit",
          "grade",
          "completion",
          "remarks",
          "school_year",
          "semester",
          "school",
        ],
        order_by: "creation desc",
        limit_page_length: 200,
      }),
  })

  const rows = gradesQuery.data ?? []
  const studentIds = Array.from(new Set(rows.map((row) => row.student)))

  const studentsQuery = useQuery({
    queryKey: ["transferee-grades-students", studentIds],
    queryFn: () =>
      frappe.list<StudentLookup>("Student", {
        filters: [["name", "in", studentIds]],
        fields: ["name", "student_name", "stdnt_cno"],
        limit_page_length: 500,
      }),
    enabled: gradesQuery.isSuccess && studentIds.length > 0,
  })

  const studentNames: Record<string, string> = {}
  for (const student of studentsQuery.data ?? []) {
    studentNames[student.name] =
      `${student.student_name} (${student.stdnt_cno ?? student.name})`
  }

  // Same "always show the table shell" treatment as the rest of the Grades
  // tab: one not-ready message drives the placeholder row instead of hiding
  // the whole table until data has loaded.
  const notReadyMessage = gradesQuery.isLoading ? "Loading…" : null
  const isReady = notReadyMessage === null

  return (
    <div className="rounded-2xl border border-black/20 h-full p-7">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Subject Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>School Year</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead>School</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isReady &&
              rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">
                    {studentNames[row.student] ?? row.student}
                  </TableCell>
                  <TableCell>{row.subject_code ?? "—"}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell>{row.unit}</TableCell>
                  <TableCell>{row.grade}</TableCell>
                  <TableCell>{row.completion ?? "—"}</TableCell>
                  <TableCell>{row.remarks}</TableCell>
                  <TableCell>{row.school_year ?? "—"}</TableCell>
                  <TableCell>{row.semester}</TableCell>
                  <TableCell>{row.school}</TableCell>
                </TableRow>
              ))}
            {isReady && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="text-muted-foreground text-center"
                >
                  No transferee grade records on file.
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
