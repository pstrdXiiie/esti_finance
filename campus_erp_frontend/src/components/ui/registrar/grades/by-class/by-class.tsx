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

interface StudentGroupRow {
  name: string
  student_group_name: string
  course?: string
  academic_year?: string
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

/**
 * Grades by Class: pick a Student Group, view its live gradebook via
 * campus_erp.api.registrar.get_class_roster. Purely a read-only report —
 * grade entry stays the sole job of the Enrollment page's roster editor.
 */
export default function ByClass() {
  const [selectedGroup, setSelectedGroup] = useState("")

  const groupsQuery = useQuery({
    queryKey: ["Student Group", "list", "grades-by-class"],
    queryFn: () =>
      frappe.list<StudentGroupRow>("Student Group", {
        fields: ["name", "student_group_name", "course", "academic_year"],
        filters: [["disabled", "=", 0]],
        limit_page_length: 500,
      }),
  })

  const rosterQuery = useQuery({
    queryKey: ["class-roster", selectedGroup],
    queryFn: () =>
      frappe.call<RosterRow[]>("campus_erp.api.registrar.get_class_roster", {
        student_group: selectedGroup,
      }),
    enabled: !!selectedGroup,
  })

  const roster = rosterQuery.data ?? []

  // Same "always show the table shell" treatment as the other Registrar
  // tabs: one shared not-ready message drives the placeholder row instead of
  // hiding the whole table until a class's roster has loaded.
  const notReadyMessage = !selectedGroup
    ? "Select a class to view its grades."
    : rosterQuery.isLoading
      ? "Loading…"
      : null
  const isReady = notReadyMessage === null

  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <div className="grid max-w-sm gap-2 pb-5">
        <label className="text-sm font-medium" htmlFor="by-class-group">
          Class (Student Group)
        </label>
        <Select
          value={selectedGroup}
          onValueChange={(value) => setSelectedGroup(value ?? "")}
        >
          <SelectTrigger id="by-class-group" className="w-full">
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
            {isReady &&
              roster.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.student_name}</TableCell>
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
            {isReady && roster.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center">
                  No students enrolled in this class.
                </TableCell>
              </TableRow>
            )}
            {!isReady && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center">
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
