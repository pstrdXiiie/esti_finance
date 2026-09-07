"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
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

interface StudentSchedule {
  academic_year: string | null
  academic_term: string | null
  program: string | null
  enrollments: ScheduleEnrollmentRow[]
}

interface WithdrawResult {
  withdrawn_count: number
  dropped: Array<{
    name: string
    status: string
    course: string
    course_name: string
  }>
}

/**
 * Withdrawal of Enrollment tab: look up a student, show their current-term
 * schedule (from campus_erp.api.registrar.get_student_schedule), and let the
 * registrar bulk-withdraw the student from every active class this term in
 * one confirmed action (campus_erp.api.registrar.withdraw_enrollment). This
 * is an all-or-nothing "withdraw from this term" action, not selective
 * dropping — selective dropping already lives in Add / Remove Subjects.
 */
export default function WithdrawalOfEnrollment() {
  const [student, setStudent] = useState<StudentOption | null>(null)
  const [confirming, setConfirming] = useState(false)

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

  function refetchSchedule() {
    scheduleQuery.refetch()
  }

  const withdrawMutation = useMutation({
    mutationFn: () =>
      frappe.call<WithdrawResult>(
        "campus_erp.api.registrar.withdraw_enrollment",
        { student: student!.name }
      ),
    onSuccess: (result) => {
      toast.success(`Withdrew from ${result.withdrawn_count} class(es)`)
      setConfirming(false)
      refetchSchedule()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  // One shared "not ready" message drives the table's placeholder row and
  // gates the Withdraw action, so the schedule table (with its column
  // headers) is always visible instead of leaving blank space until a
  // fully-loaded student with active classes is picked.
  const notReadyMessage = !student
    ? "Search for a student to view their current schedule."
    : scheduleQuery.isLoading
      ? "Loading…"
      : schedule && schedule.academic_year == null
        ? "This student has no Program Enrollment on record — nothing to withdraw from."
        : enrollments.length === 0
          ? "This student has no active classes this term — nothing to withdraw."
          : null
  const isReady = notReadyMessage === null

  return (
    <div className="rounded-2xl border border-black/20 h-full p-7">
      <div className="flex items-start w-full pb-5">
        <StudentSearch
          selected={student}
          onSelect={setStudent}
          idPrefix="withdrawal-of-enrollment"
        />
      </div>

      <div className="grid gap-3">
        <div className="grid gap-2 mb-3">
          <h2 className="font-semibold">Current Schedule</h2>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Room</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isReady &&
                  enrollments.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">
                        {row.course_name}
                      </TableCell>
                      <TableCell>{row.student_group_name}</TableCell>
                      <TableCell>{row.days.join("/")}</TableCell>
                      <TableCell>
                        {row.start_time && row.end_time
                          ? `${row.start_time}–${row.end_time}`
                          : "—"}
                      </TableCell>
                      <TableCell>{row.room ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                {!isReady && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      {notReadyMessage}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {isReady && !confirming && (
          <div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirming(true)}
            >
              Withdraw All Classes ({enrollments.length})
            </Button>
          </div>
        )}

        {isReady && confirming && (
          <div className="grid gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm">
              Are you sure? This will drop {enrollments.length} class
              {enrollments.length === 1 ? "" : "es"} for this student&apos;s
              current term. The student&apos;s overall record is not affected —
              they can re-enroll in a future term.
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="destructive"
                disabled={withdrawMutation.isPending}
                onClick={() => withdrawMutation.mutate()}
              >
                {withdrawMutation.isPending
                  ? "Withdrawing…"
                  : "Yes, Withdraw"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={withdrawMutation.isPending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
