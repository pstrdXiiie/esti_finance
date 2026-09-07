"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface StudentGroupRow {
  name: string
  student_group_name: string
  course?: string
  program?: string
  max_strength?: number
}

interface StudentRow {
  name: string
  student_name: string
}

interface RosterRow {
  name: string
  student: string
  student_name: string
  prelim?: number
  midterm?: number
  final?: number
  final_rating?: string
  grade_remarks?: string
  points?: number
  status: string
}

interface PrereqResult {
  ok: boolean
  reason: string | null
}

/**
 * Bespoke screen (doesn't fit Master/Detail, Entry, or Report): pick a class,
 * enroll a student into it with a live prerequisite pre-check, then work the
 * live roster (grade computation, drop). Fronts campus_erp.api.registrar.*
 * directly rather than one DocType's plain CRUD.
 */
export default function EnrollmentPage() {
  const queryClient = useQueryClient()
  const [studentGroup, setStudentGroup] = useState("")
  const [student, setStudent] = useState("")
  const [prereq, setPrereq] = useState<PrereqResult | null>(null)

  const groupsQuery = useQuery({
    queryKey: ["Student Group", "list", "enrollment"],
    queryFn: () =>
      frappe.list<StudentGroupRow>("Student Group", {
        fields: ["name", "student_group_name", "course", "program", "max_strength"],
        limit_page_length: 200,
      }),
  })

  const studentsQuery = useQuery({
    queryKey: ["Student", "list", "enrollment"],
    queryFn: () =>
      frappe.list<StudentRow>("Student", {
        fields: ["name", "student_name"],
        limit_page_length: 500,
      }),
  })

  const selectedGroup = groupsQuery.data?.find((g) => g.name === studentGroup)

  const rosterQuery = useQuery({
    queryKey: ["class-roster", studentGroup],
    queryFn: () =>
      frappe.call<RosterRow[]>("campus_erp.api.registrar.get_class_roster", {
        student_group: studentGroup,
      }),
    enabled: !!studentGroup,
  })

  function invalidateRoster() {
    queryClient.invalidateQueries({ queryKey: ["class-roster", studentGroup] })
  }

  const checkMutation = useMutation({
    mutationFn: () =>
      frappe.call<PrereqResult>("campus_erp.api.registrar.check_prerequisites", {
        student,
        course: selectedGroup?.course,
      }),
    onSuccess: setPrereq,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const enrollMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ name: string }>("campus_erp.api.registrar.enroll", {
        student,
        student_group: studentGroup,
      }),
    onSuccess: () => {
      toast.success("Student enrolled")
      setStudent("")
      setPrereq(null)
      invalidateRoster()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const gradeMutation = useMutation({
    mutationFn: (courseEnrollment: string) =>
      frappe.call<{ points: number | null; is_passing: boolean | null; grade_code?: string }>(
        "campus_erp.api.registrar.compute_grade_points",
        { course_enrollment: courseEnrollment }
      ),
    onSuccess: (result) => {
      toast.success(
        result.points != null
          ? `Grade computed: ${result.points} points (${result.is_passing ? "passing" : "failing"})`
          : "No numeric grade to compute yet"
      )
      invalidateRoster()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const dropMutation = useMutation({
    mutationFn: (courseEnrollment: string) =>
      frappe.call("campus_erp.api.registrar.drop_enrollment", {
        course_enrollment: courseEnrollment,
      }),
    onSuccess: () => {
      toast.success("Enrollment dropped")
      invalidateRoster()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const alreadyEnrolled = useMemo(
    () => (rosterQuery.data ?? []).some((r) => r.student === student),
    [rosterQuery.data, student]
  )

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Enrollment & Grades</h1>
        <p className="text-muted-foreground">
          Enroll a student into a class, then work its roster.
        </p>
      </div>

      <div className="grid max-w-sm gap-2">
        <label className="text-sm font-medium">Class (Student Group)</label>
        {groupsQuery.isLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : (
          <Select
            value={studentGroup}
            onValueChange={(value) => {
              setStudentGroup(value ?? "")
              setStudent("")
              setPrereq(null)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a class…" />
            </SelectTrigger>
            <SelectContent>
              {(groupsQuery.data ?? []).map((g) => (
                <SelectItem key={g.name} value={g.name}>
                  {g.student_group_name}
                  {g.course ? ` — ${g.course}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {studentGroup && (
        <>
          <Separator />

          <div className="grid gap-3 rounded-md border p-4">
            <h2 className="font-semibold">Enroll a Student</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid min-w-64 gap-2">
                <label className="text-sm font-medium">Student</label>
                <Select
                  value={student}
                  onValueChange={(value) => {
                    setStudent(value ?? "")
                    setPrereq(null)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a student…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(studentsQuery.data ?? []).map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {s.student_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!student || checkMutation.isPending}
                onClick={() => checkMutation.mutate()}
              >
                {checkMutation.isPending ? "Checking…" : "Check Prerequisites"}
              </Button>
              <Button
                type="button"
                disabled={!student || alreadyEnrolled || enrollMutation.isPending}
                onClick={() => enrollMutation.mutate()}
              >
                {enrollMutation.isPending ? "Enrolling…" : "Enroll"}
              </Button>
            </div>
            {alreadyEnrolled && (
              <p className="text-sm text-muted-foreground">Already enrolled in this class.</p>
            )}
            {prereq && (
              <p className={prereq.ok ? "text-sm text-primary" : "text-sm text-destructive"}>
                {prereq.ok ? "Prerequisites satisfied." : prereq.reason}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <h2 className="font-semibold">Class Roster</h2>
            {rosterQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
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
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rosterQuery.data ?? []).map((row) => (
                      <TableRow key={row.name}>
                        <TableCell>{row.student_name}</TableCell>
                        <TableCell>{row.prelim ?? ""}</TableCell>
                        <TableCell>{row.midterm ?? ""}</TableCell>
                        <TableCell>{row.final ?? ""}</TableCell>
                        <TableCell>{row.final_rating ?? ""}</TableCell>
                        <TableCell>{row.grade_remarks ?? ""}</TableCell>
                        <TableCell>{row.points ?? ""}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.status}</Badge>
                        </TableCell>
                        <TableCell className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={gradeMutation.isPending}
                            onClick={() => gradeMutation.mutate(row.name)}
                          >
                            Compute Grade
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={dropMutation.isPending || row.status === "Dropped"}
                            onClick={() => dropMutation.mutate(row.name)}
                          >
                            Drop
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(rosterQuery.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-muted-foreground text-center">
                          No students enrolled in this class yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
