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
import StudentSearch, { StudentOption } from "@/components/sms/StudentSearch"

interface PreEnrollmentSubjectRow {
  subject: string
  subject_name: string
  subject_code: string
  unit: number
  prerequisite_met: boolean | number
}

interface PreEnrollmentRecord {
  name: string
  student: string
  student_name: string
  program: string
  academic_year: string
  semester: number
  year_level: number
  status: string
  total_units: number
  subjects: PreEnrollmentSubjectRow[]
}

/**
 * Pre-Registration Record tab: look up a student and show every Pre
 * Enrollment record on file for them, most recent first. Purely a read-only
 * history view — no stepper, no editing, no add/remove subject controls —
 * unlike the live Pre-Enrollment tab this data was pulled from.
 */
export default function PreRegistrationRecord() {
  const [student, setStudent] = useState<StudentOption | null>(null)

  const preEnrollmentsQuery = useQuery({
    queryKey: ["Pre Enrollment", "list", student?.name],
    queryFn: () =>
      frappe.call<PreEnrollmentRecord[]>(
        "campus_erp.api.registrar.list_pre_enrollments",
        { student: student!.name }
      ),
    enabled: !!student,
  })

  const records = preEnrollmentsQuery.data ?? []

  return (
    <div className="rounded-2xl border border-black/20 h-full p-7">
      <div className="flex gap-2 items-center pb-5">
        <StudentSearch
          selected={student}
          onSelect={setStudent}
          idPrefix="pre-registration-record"
        />
      </div>

      {records.length > 0 ? (
        records.map((record, index) => (
          <div key={record.name}>
            <div className="rounded-md border p-4 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex flex-wrap gap-4 items-center">
                  <span>School Year: {formatAcademicYearLabel(record.academic_year)}</span>
                  <span>Semester: {record.semester}</span>
                  <span>Year Level: {record.year_level}</span>
                </div>
                <Badge variant="outline">{record.status}</Badge>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject Code</TableHead>
                      <TableHead>Subject Name</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Prerequisite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {record.subjects.map((s) => (
                      <TableRow key={s.subject}>
                        <TableCell>{s.subject_code}</TableCell>
                        <TableCell className="font-medium">{s.subject_name}</TableCell>
                        <TableCell>{s.unit}</TableCell>
                        <TableCell>
                          {s.prerequisite_met ? (
                            <Badge variant="secondary">Met</Badge>
                          ) : (
                            <Badge variant="destructive">Not Met</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {record.subjects.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground text-center">
                          No subjects in this listing.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end mt-3">
                <div className="rounded-lg border border-black/20 px-4 py-2 text-right">
                  <div className="text-xs text-muted-foreground">Total Units</div>
                  <div className="text-xl font-bold">{record.total_units}</div>
                </div>
              </div>
            </div>

            {index < records.length - 1 ? <Separator className="mb-4" /> : null}
          </div>
        ))
      ) : (
        <div className="rounded-md border p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-muted-foreground">
            <div className="flex flex-wrap gap-4 items-center">
              <span>School Year: —</span>
              <span>Semester: —</span>
              <span>Year Level: —</span>
            </div>
            <Badge variant="outline" className="text-muted-foreground">
              —
            </Badge>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject Code</TableHead>
                  <TableHead>Subject Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Prerequisite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    {!student
                      ? "Search for a student to view their pre-registration record."
                      : preEnrollmentsQuery.isLoading
                        ? "Loading…"
                        : "No pre-enrollment records on file for this student."}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end mt-3">
            <div className="rounded-lg border border-black/20 px-4 py-2 text-right">
              <div className="text-xs text-muted-foreground">Total Units</div>
              <div className="text-xl font-bold text-muted-foreground">—</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
