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
import InstructorSearch, {
  InstructorOption,
} from "@/components/sms/InstructorSearch"

interface InstructorScheduleRow {
  student_group: string
  student_group_name: string
  course: string
  course_name: string
  academic_year: string
  days: string[]
  start_time: string | null
  end_time: string | null
  room: string | null
}

interface InstructorSchedule {
  classes: InstructorScheduleRow[]
}

/**
 * Faculty Schedule tab: look up an instructor and show every active
 * (non-disabled) Student Group assignment they're teaching, via
 * campus_erp.api.registrar.get_instructor_schedule. Purely a read-only
 * lookup/report — no editing, no add/remove, no save — matching the spirit
 * of Pre-Registration Record.
 */
export default function FacultySchedule() {
  const [instructor, setInstructor] = useState<InstructorOption | null>(null)

  const scheduleQuery = useQuery({
    queryKey: ["instructor-schedule", instructor?.name],
    queryFn: () =>
      frappe.call<InstructorSchedule>(
        "campus_erp.api.registrar.get_instructor_schedule",
        { instructor: instructor!.name }
      ),
    enabled: !!instructor,
  })

  const classes = scheduleQuery.data?.classes ?? []

  // Same "always show the table shell" treatment as the Enrollment widget's
  // tabs: one shared not-ready message drives the placeholder row instead of
  // hiding the whole table until an instructor's schedule has loaded.
  const notReadyMessage = !instructor
    ? "Search for an instructor to view their class schedule."
    : scheduleQuery.isLoading
      ? "Loading…"
      : null
  const isReady = notReadyMessage === null

  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <div className="flex gap-2 items-center pb-5">
        <InstructorSearch
          selected={instructor}
          onSelect={setInstructor}
          idPrefix="faculty-schedule"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>School Year</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Room</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isReady &&
              classes.map((row) => (
                <TableRow key={row.student_group}>
                  <TableCell className="font-medium">{row.course_name}</TableCell>
                  <TableCell>{row.student_group_name}</TableCell>
                  <TableCell>{formatAcademicYearLabel(row.academic_year)}</TableCell>
                  <TableCell>{row.days.join("/")}</TableCell>
                  <TableCell>
                    {row.start_time && row.end_time
                      ? `${row.start_time}–${row.end_time}`
                      : "—"}
                  </TableCell>
                  <TableCell>{row.room ?? "—"}</TableCell>
                </TableRow>
              ))}
            {isReady && classes.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground text-center"
                >
                  No active class assignments for this instructor.
                </TableCell>
              </TableRow>
            )}
            {!isReady && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
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
