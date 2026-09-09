"use client"

import { useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatAcademicYearLabel } from "@/lib/utils"

interface ProgramRow {
  name: string
  program_name: string
}

interface AcademicYearRow {
  name: string
  academic_year_name: string
}

interface ComputeCandidatesResult {
  graduation_batch: string | null
  candidates: Array<{
    student: string
    did_not_reenroll_next_year: number
    approved: number
    missing_subjects: string[]
  }>
}

interface GraduationBatchCandidate {
  student: string
  student_name: string
  did_not_reenroll_next_year: number
  approved: number
  approved_by: string | null
  approved_on: string | null
  missing_subjects: string[]
}

interface GraduationBatchResult {
  name: string
  program: string
  school_year: string
  run_on: string
  candidates: GraduationBatchCandidate[]
}

function formatApprovedOn(value: string): string {
  const date = new Date(value.replace(" ", "T"))
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

/**
 * "Graduating Students" (Maintenance tab): pick a Course + Academic Year,
 * check off students as graduated, and persist all newly-checked rows in one
 * "Update Records" action. A row already marked graduated can't be
 * unchecked here — campus_erp.api.registrar has no "unapprove" path, since
 * Student.graduated is meant to be a one-way, audited transition (see
 * approve_graduation's docstring). Consolidates the standalone Graduation
 * Processing screen (formerly /registrar/graduation, now retired) into this
 * one checklist UI over the same compute_graduation_candidates /
 * get_graduation_batch / approve_graduation API.
 */
export default function GraduatingStudents() {
  const queryClient = useQueryClient()

  const programsQuery = useQuery({
    queryKey: ["Program", "list", "graduating-students"],
    queryFn: () =>
      frappe.list<ProgramRow>("Program", {
        fields: ["name", "program_name"],
        limit_page_length: 500,
      }),
  })

  const academicYearsQuery = useQuery({
    queryKey: ["Academic Year", "list", "graduating-students"],
    queryFn: () =>
      frappe.list<AcademicYearRow>("Academic Year", {
        fields: ["name", "academic_year_name"],
        order_by: "year_start_date desc",
        limit_page_length: 50,
      }),
  })

  const [course, setCourse] = useState("")
  const [academicYear, setAcademicYear] = useState("")
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [syncedSelectionKey, setSyncedSelectionKey] = useState<string | undefined>(undefined)

  const selectionKey = `${course}::${academicYear}`
  if (selectionKey !== syncedSelectionKey) {
    setSyncedSelectionKey(selectionKey)
    setPending({})
  }

  const computeQuery = useQuery({
    queryKey: ["compute-graduation-candidates", course, academicYear],
    queryFn: () =>
      frappe.call<ComputeCandidatesResult>(
        "campus_erp.api.registrar.compute_graduation_candidates",
        { program: course, school_year: academicYear }
      ),
    enabled: !!course && !!academicYear,
    refetchOnWindowFocus: false,
  })

  const batchName = computeQuery.data?.graduation_batch ?? null

  const batchQuery = useQuery({
    queryKey: ["graduation-batch", batchName],
    queryFn: () =>
      frappe.call<GraduationBatchResult>(
        "campus_erp.api.registrar.get_graduation_batch",
        { graduation_batch: batchName }
      ),
    enabled: !!batchName,
  })

  const candidates = batchQuery.data?.candidates ?? []

  const updateMutation = useMutation({
    mutationFn: async () => {
      const toApprove = candidates.filter((c) => !c.approved && pending[c.student])
      const results = await Promise.allSettled(
        toApprove.map((c) =>
          frappe.call("campus_erp.api.registrar.approve_graduation", {
            graduation_batch: batchName,
            student: c.student,
          })
        )
      )
      const failed = results.filter((r) => r.status === "rejected").length
      return { attempted: toApprove.length, failed }
    },
    onSuccess: async ({ attempted, failed }) => {
      if (attempted === 0) {
        toast.info("No changes to update")
      } else if (failed > 0) {
        toast.error(`${attempted - failed} of ${attempted} student(s) updated — ${failed} failed`)
      } else {
        toast.success(`${attempted} student(s) marked as graduated`)
      }
      setPending({})
      await queryClient.invalidateQueries({ queryKey: ["graduation-batch", batchName] })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function toggleCandidate(student: string, checked: boolean) {
    setPending((prev) => ({ ...prev, [student]: checked }))
  }

  const pendingCount = candidates.filter((c) => !c.approved && pending[c.student]).length
  const isLoadingRoster = computeQuery.isFetching || batchQuery.isFetching

  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <div className="grid md:grid-cols-2 gap-4 w-full pb-5">
        <div className="flex gap-2 items-baseline">
          <label htmlFor="grad-course">Course</label>
          <Select value={course} onValueChange={(v) => setCourse(v ?? "")}>
            <SelectTrigger id="grad-course" className="w-[200px]">
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
        </div>
        <div className="flex flex-row gap-2 items-baseline">
          <label htmlFor="grad-academic-year">School Year</label>
          <Select value={academicYear} onValueChange={(v) => setAcademicYear(v ?? "")}>
            <SelectTrigger id="grad-academic-year" className="w-[200px]">
              <SelectValue placeholder="Select School Year" />
            </SelectTrigger>
            <SelectContent>
              {(academicYearsQuery.data ?? []).map((ay) => (
                <SelectItem key={ay.name} value={ay.name}>
                  {formatAcademicYearLabel(ay.academic_year_name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!course || !academicYear ? (
        <p className="text-sm text-muted-foreground">
          Select a Course and School Year to view graduating students.
        </p>
      ) : isLoadingRoster ? (
        <Skeleton className="h-64 w-full" />
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No graduating students found for this Course and School Year.
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-2 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Graduating Students</h2>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked disabled className="h-4 w-4" /> Graduated
                </span>
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={false} disabled className="h-4 w-4" /> Not Yet Graduated
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Curriculum</TableHead>
                    <TableHead>Graduated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((c) => (
                    <TableRow key={c.student}>
                      <TableCell className="font-medium">{c.student_name}</TableCell>
                      <TableCell>
                        {c.missing_subjects.length === 0 ? (
                          <Badge variant="secondary">Complete</Badge>
                        ) : (
                          <Badge variant="destructive">
                            Missing {c.missing_subjects.length} subject
                            {c.missing_subjects.length === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={!!c.approved || !!pending[c.student]}
                            disabled={!!c.approved || updateMutation.isPending}
                            onChange={(e) => toggleCandidate(c.student, e.target.checked)}
                            aria-label={`Mark ${c.student_name} as graduated`}
                          />
                          {!!c.approved && c.approved_by && (
                            <span className="text-xs text-muted-foreground">
                              by {c.approved_by}
                              {c.approved_on ? ` on ${formatApprovedOn(c.approved_on)}` : ""}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {pendingCount > 0 ? `${pendingCount} student(s) pending update` : "No pending changes"}
            </span>
            <Button
              type="button"
              disabled={pendingCount === 0 || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? "Updating…" : "Update Records"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
