"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  PencilIcon,
  SearchIcon,
} from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface CourseRow {
  name: string
  program_name: string
  course_code: string | null
  tuition_fee: number | null
}

function formatCurrency(value: number | null): string {
  return (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * "Tuition Fee" (Finance > Maintenance tab): every Course (Program) already
 * exists — created via Courses Offered — so this screen doesn't add or
 * delete courses, it only browses the full list and sets each one's Tuition
 * Fee amount. Edit unlocks the amount for the currently loaded course; Find
 * jumps to a course by code or name.
 *
 * The amount set here is a PER-UNIT rate, not a flat total — the Assessment
 * dialog (Registrar > Enrollment > Pre-Enrollment) multiplies it by the
 * student's total enrolled units to get their actual Tuition Fee.
 */
export default function TuitionFee() {
  const queryClient = useQueryClient()

  const coursesQuery = useQuery({
    queryKey: ["Program", "list", "tuition-fee"],
    queryFn: () =>
      frappe.list<CourseRow>("Program", {
        fields: ["name", "program_name", "course_code", "tuition_fee"],
        order_by: "program_name asc",
        limit_page_length: 500,
      }),
  })

  const courses = coursesQuery.data ?? []

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [amount, setAmount] = useState("")
  const [findQuery, setFindQuery] = useState("")
  const [findOpen, setFindOpen] = useState(false)

  if (!initialized && courses.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? courses[selectedIndex] : null

  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  if (selected && selected.name !== syncedName) {
    setSyncedName(selected.name)
    setAmount(selected.tuition_fee != null ? String(selected.tuition_fee) : "")
  }

  function handleEdit() {
    if (!selected) return
    setAmount(selected.tuition_fee != null ? String(selected.tuition_fee) : "")
    setIsEditing(true)
  }

  function handleCancel() {
    if (selected) {
      setAmount(selected.tuition_fee != null ? String(selected.tuition_fee) : "")
    }
    setIsEditing(false)
  }

  function selectRecord(idx: number) {
    if (idx < 0 || idx >= courses.length) return
    setIsEditing(false)
    setSelectedIndex(idx)
  }

  const findMatches = findQuery.trim()
    ? courses.filter(
        (c) =>
          c.course_code?.toLowerCase().includes(findQuery.trim().toLowerCase()) ||
          c.program_name?.toLowerCase().includes(findQuery.trim().toLowerCase())
      )
    : []

  function jumpToCourse(name: string) {
    const idx = courses.findIndex((c) => c.name === name)
    if (idx !== -1) {
      setIsEditing(false)
      setSelectedIndex(idx)
    }
    setFindOpen(false)
  }

  function handleFind() {
    const query = findQuery.trim().toLowerCase()
    if (!query) return
    const idx = courses.findIndex(
      (c) =>
        c.course_code?.toLowerCase().includes(query) ||
        c.program_name?.toLowerCase().includes(query)
    )
    if (idx === -1) {
      toast.info(`No course found matching "${findQuery}"`)
      return
    }
    setIsEditing(false)
    setSelectedIndex(idx)
    setFindOpen(false)
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      frappe.updateDoc<CourseRow>("Program", selected!.name, {
        tuition_fee: amount ? Number(amount) : 0,
      }),
    onSuccess: async () => {
      toast.success("Tuition fee saved")
      setIsEditing(false)
      await queryClient.invalidateQueries({ queryKey: ["Program", "list", "tuition-fee"] })
    },
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  return (
    <div className="rounded-2xl border border-border h-full p-7 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 pb-5 shrink-0">
        <Button type="button" variant="outline" disabled={isEditing || !selected} onClick={handleEdit}>
          <PencilIcon /> Edit
        </Button>

        <div
          className="relative flex items-center gap-2 ml-4"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFindOpen(false)
          }}
        >
          <Input
            placeholder="Find by code or course name…"
            className="w-64"
            value={findQuery}
            disabled={isEditing}
            onChange={(e) => {
              setFindQuery(e.target.value)
              setFindOpen(true)
            }}
            onFocus={() => setFindOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleFind()
              } else if (e.key === "Escape") {
                setFindOpen(false)
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" disabled={isEditing} onClick={handleFind}>
            <SearchIcon />
          </Button>

          {findOpen && findQuery.trim() && !isEditing && (
            <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 max-h-64 overflow-y-auto p-1">
              {findMatches.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No matches.</div>
              ) : (
                findMatches.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className="w-full text-left rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => jumpToCourse(c.name)}
                  >
                    {c.course_code ? `${c.course_code} — ` : ""}
                    {c.program_name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {isEditing && (
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Course Code</TableHead>
              <TableHead>Course Name</TableHead>
              <TableHead className="text-right">Tuition Fee (per unit)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c, idx) => {
              const isSelected = selectedIndex === idx
              return (
                <TableRow
                  key={c.name}
                  className="cursor-pointer"
                  data-state={isSelected ? "selected" : undefined}
                  onClick={() => selectRecord(idx)}
                >
                  <TableCell>{c.course_code || "—"}</TableCell>
                  <TableCell className="font-medium">{c.program_name}</TableCell>
                  <TableCell className="text-right">
                    {isSelected && isEditing ? (
                      <Input
                        id="tuition-amount"
                        type="number"
                        className="w-32 ml-auto text-right"
                        autoFocus
                        value={amount}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    ) : (
                      formatCurrency(c.tuition_fee)
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {courses.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No courses yet — add one from Courses Offered first.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4 mt-4 shrink-0">
        <div className="text-sm text-muted-foreground">
          {selectedIndex !== null && courses.length > 0
            ? `Record ${selectedIndex + 1} of ${courses.length}`
            : "—"}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord(0)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord((selectedIndex ?? 0) - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex >= courses.length - 1}
            onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex >= courses.length - 1}
            onClick={() => selectRecord(courses.length - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
