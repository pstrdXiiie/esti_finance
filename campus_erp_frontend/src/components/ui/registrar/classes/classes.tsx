"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import InstructorSearch, { InstructorOption } from "@/components/sms/InstructorSearch"
import { formatAcademicYearLabel } from "@/lib/utils"

interface ProgramRow {
  name: string
  program_name: string
}

interface CurriculumRow {
  name: string
  curriculum_code: string
  is_active: number
}

interface AcademicYearRow {
  name: string
  academic_year_name: string
}

interface CourseRow {
  name: string
  course_name: string
  subject_code: string | null
}

interface RoomRow {
  name: string
  room_name: string
  room_number: string | null
}

interface ClassRow {
  name: string
  student_group_name: string
  course: string
  course_name: string | null
  subject_code: string | null
  unit: number | null
  is_nstp_or_ms: boolean
  max_strength: number | null
  room: string | null
  start_time: string | null
  end_time: string | null
  days: string[]
  instructor: string | null
  instructor_name: string | null
}

const DAY_FIELDS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

const DAY_LABELS: Record<(typeof DAY_FIELDS)[number], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

const COLUMN_COUNT = 8

/**
 * Classes Offered: the authoring screen for Student Group records (the
 * "classes" that Enrollment/Grades/Faculty Schedule all read). Nothing else
 * in the app creates Student Groups through the UI — this is that screen,
 * modeled on the legacy "Classes Offered" grid: pick a
 * Program/Section/Curriculum/AcademicYear/YearLevel/Semester context,
 * bulk-prescribe its curriculum subjects, then add/edit/remove/schedule
 * individual classes within it.
 */
export default function Classes() {
  const queryClient = useQueryClient()

  const [program, setProgram] = useState("")
  const [section, setSection] = useState("")
  const [curriculum, setCurriculum] = useState("")
  const [academicYear, setAcademicYear] = useState("")
  const [yearLevel, setYearLevel] = useState("")
  const [semester, setSemester] = useState("")
  const [maxStudents, setMaxStudents] = useState("")

  const [selected, setSelected] = useState<ClassRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const [addCourse, setAddCourse] = useState("")
  const [editCourse, setEditCourse] = useState("")
  const [editMaxStrength, setEditMaxStrength] = useState("")
  const [schedRoom, setSchedRoom] = useState("")
  const [schedStart, setSchedStart] = useState("")
  const [schedEnd, setSchedEnd] = useState("")
  const [schedDays, setSchedDays] = useState<Record<string, boolean>>({})
  const [schedInstructor, setSchedInstructor] = useState<InstructorOption | null>(null)

  const programsQuery = useQuery({
    queryKey: ["Program", "list", "classes"],
    queryFn: () =>
      frappe.list<ProgramRow>("Program", {
        fields: ["name", "program_name"],
        limit_page_length: 100,
      }),
  })

  const curriculaQuery = useQuery({
    queryKey: ["SMS Curriculum", "list", program],
    queryFn: () =>
      frappe.list<CurriculumRow>("SMS Curriculum", {
        filters: { course: program },
        fields: ["name", "curriculum_code", "is_active"],
        limit_page_length: 50,
      }),
    enabled: !!program,
  })
  const curricula = curriculaQuery.data ?? []

  // Default to the program's active curriculum whenever the list loads and
  // nothing's picked yet — same "adjust state during render" idiom as
  // Academic Year's one-time default elsewhere in this app, just re-armed
  // every time `curriculum` goes back to "" (i.e. on every program change,
  // via the Program Select's own onValueChange below).
  if (!curriculum && curricula.length > 0) {
    const active = curricula.find((c) => c.is_active) ?? curricula[0]
    setCurriculum(active.name)
  }

  const academicYearsQuery = useQuery({
    queryKey: ["Academic Year", "list", "classes"],
    queryFn: () =>
      frappe.list<AcademicYearRow>("Academic Year", {
        fields: ["name", "academic_year_name"],
        order_by: "year_start_date desc",
        limit_page_length: 50,
      }),
  })
  const academicYears = academicYearsQuery.data ?? []

  const [defaultedAcademicYear, setDefaultedAcademicYear] = useState(false)
  if (!defaultedAcademicYear && academicYearsQuery.isSuccess && academicYears.length > 0) {
    setDefaultedAcademicYear(true)
    setAcademicYear(academicYears[0].name)
  }

  const coursesQuery = useQuery({
    queryKey: ["Course", "list", "classes"],
    queryFn: () =>
      frappe.list<CourseRow>("Course", {
        fields: ["name", "course_name", "subject_code"],
        limit_page_length: 500,
      }),
  })
  const courses = coursesQuery.data ?? []

  const roomsQuery = useQuery({
    queryKey: ["Room", "list", "classes"],
    queryFn: () =>
      frappe.list<RoomRow>("Room", {
        fields: ["name", "room_name", "room_number"],
        limit_page_length: 100,
      }),
  })
  const rooms = roomsQuery.data ?? []

  const trimmedSection = section.trim()
  const filtersComplete = !!(program && trimmedSection && academicYear && yearLevel && semester)

  const classesQuery = useQuery({
    queryKey: ["classes-offered", program, trimmedSection, academicYear, yearLevel, semester],
    queryFn: () =>
      frappe.call<ClassRow[]>("campus_erp.api.registrar.list_classes_offered", {
        program,
        section: trimmedSection,
        academic_year: academicYear,
        year_level: Number(yearLevel),
        semester: Number(semester),
      }),
    enabled: filtersComplete,
  })
  const classes = classesQuery.data ?? []

  const notReadyMessage = !filtersComplete
    ? "Select Program, Section, School Year, Year Level, and Semester to view classes offered."
    : classesQuery.isLoading
      ? "Loading…"
      : null
  const isReady = notReadyMessage === null

  const totalUnits = classes
    .filter((c) => !c.is_nstp_or_ms)
    .reduce((sum, c) => sum + (c.unit ?? 0), 0)

  function invalidateClasses() {
    queryClient.invalidateQueries({
      queryKey: ["classes-offered", program, trimmedSection, academicYear, yearLevel, semester],
    })
  }

  const canCreate = filtersComplete && !!maxStudents
  const canPrescribe = canCreate && !!curriculum

  const prescribeMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ created: string[]; skipped: string[]; failed: string[] }>(
        "campus_erp.api.registrar.prescribe_classes",
        {
          program,
          curriculum,
          section: trimmedSection,
          academic_year: academicYear,
          year_level: Number(yearLevel),
          semester: Number(semester),
          max_students: Number(maxStudents),
        }
      ),
    onSuccess: (result) => {
      toast.success(
        `Prescribed ${result.created.length} class${result.created.length === 1 ? "" : "es"}` +
          (result.skipped.length ? ` (${result.skipped.length} already offered, skipped)` : "")
      )
      if (result.failed.length) {
        toast.error(
          `${result.failed.length} subject${result.failed.length === 1 ? "" : "s"} failed to prescribe — check with IT.`
        )
      }
      invalidateClasses()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const addMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ name: string }>("campus_erp.api.registrar.add_class", {
        program,
        course: addCourse,
        section: trimmedSection,
        academic_year: academicYear,
        year_level: Number(yearLevel),
        semester: Number(semester),
        max_students: Number(maxStudents),
      }),
    onSuccess: () => {
      toast.success("Class added")
      setAddOpen(false)
      setAddCourse("")
      invalidateClasses()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const editMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ name: string }>("campus_erp.api.registrar.update_class", {
        name: selected!.name,
        course: editCourse,
        max_strength: Number(editMaxStrength),
      }),
    onSuccess: () => {
      toast.success("Class updated")
      setEditOpen(false)
      setSelected(null)
      invalidateClasses()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const scheduleMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ name: string }>("campus_erp.api.registrar.schedule_class", {
        name: selected!.name,
        room: schedRoom || null,
        start_time: schedStart || null,
        end_time: schedEnd || null,
        days: schedDays,
        instructor: schedInstructor?.name ?? null,
      }),
    onSuccess: () => {
      toast.success("Schedule saved")
      setScheduleOpen(false)
      setSelected(null)
      invalidateClasses()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const removeMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ name: string }>("campus_erp.api.registrar.remove_class", {
        name: selected!.name,
      }),
    onSuccess: () => {
      toast.success("Class removed")
      setRemoveOpen(false)
      setSelected(null)
      invalidateClasses()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  function openEdit() {
    if (!selected) return
    setEditCourse(selected.course)
    setEditMaxStrength(selected.max_strength != null ? String(selected.max_strength) : "")
    setEditOpen(true)
  }

  function openSchedule() {
    if (!selected) return
    setSchedRoom(selected.room ?? "")
    setSchedStart(selected.start_time ?? "")
    setSchedEnd(selected.end_time ?? "")
    // selected.days holds full capitalized day names from the backend's
    // Python .capitalize() ("Monday"), not the abbreviated DAY_LABELS used
    // for the compact table display ("Mon") — comparing against the wrong
    // one meant re-opening Schedule on an already-scheduled class always
    // showed every day unchecked, and saving without re-checking them would
    // silently wipe the class's real meeting days (schedule_class replaces
    // all 7 day fields wholesale from whatever this dialog sends).
    const days: Record<string, boolean> = {}
    for (const d of DAY_FIELDS) {
      const fullName = d.charAt(0).toUpperCase() + d.slice(1)
      days[d] = selected.days.includes(fullName)
    }
    setSchedDays(days)
    setSchedInstructor(
      selected.instructor
        ? {
            name: selected.instructor,
            instructor_name: selected.instructor_name ?? selected.instructor,
            department: null,
            status: null,
          }
        : null
    )
    setScheduleOpen(true)
  }

  function selectRow(row: ClassRow) {
    setSelected((prev) => (prev?.name === row.name ? null : row))
  }

  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <div className="flex flex-wrap gap-5 items-end pb-5">
        <div className="grid gap-1.5">
          <label htmlFor="classes-program">Course</label>
          <Select
            value={program}
            onValueChange={(v) => {
              setProgram(v ?? "")
              setCurriculum("")
              setSelected(null)
            }}
          >
            <SelectTrigger id="classes-program" className="w-56">
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

        <div className="grid gap-1.5">
          <label htmlFor="classes-section">Section</label>
          <Input
            id="classes-section"
            className="w-32"
            placeholder="e.g. 1A"
            value={section}
            onChange={(e) => {
              setSection(e.target.value)
              setSelected(null)
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="classes-curriculum">Curriculum</label>
          <Select value={curriculum} onValueChange={(v) => setCurriculum(v ?? "")}>
            <SelectTrigger id="classes-curriculum" className="w-48">
              <SelectValue placeholder="Select Curriculum" />
            </SelectTrigger>
            <SelectContent>
              {curricula.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.curriculum_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="classes-school-year">School Year</label>
          <Select value={academicYear} onValueChange={(v) => setAcademicYear(v ?? "")}>
            <SelectTrigger id="classes-school-year" className="w-48">
              <SelectValue placeholder="Select School Year" />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map((ay) => (
                <SelectItem key={ay.name} value={ay.name}>
                  {formatAcademicYearLabel(ay.academic_year_name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="classes-year">Year</label>
          <Input
            id="classes-year"
            type="number"
            min="1"
            className="w-20"
            value={yearLevel}
            onChange={(e) => {
              setYearLevel(e.target.value)
              setSelected(null)
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="classes-semester">Semester</label>
          <Input
            id="classes-semester"
            type="number"
            min="1"
            className="w-20"
            value={semester}
            onChange={(e) => {
              setSemester(e.target.value)
              setSelected(null)
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="classes-max-students">Maximum # of Students in Class</label>
          <Input
            id="classes-max-students"
            type="number"
            min="0"
            className="w-24"
            value={maxStudents}
            onChange={(e) => setMaxStudents(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pb-5">
        <Button
          type="button"
          disabled={!canPrescribe || prescribeMutation.isPending}
          onClick={() => prescribeMutation.mutate()}
        >
          Prescribe Classes
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canCreate}
          onClick={() => setAddOpen(true)}
        >
          Add New Class
        </Button>
        <Button type="button" variant="outline" disabled={!selected} onClick={openEdit}>
          Edit Class
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!selected}
          onClick={() => setRemoveOpen(true)}
        >
          Remove Class
        </Button>
        <Button type="button" variant="outline" disabled={!selected} onClick={openSchedule}>
          Schedule
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class Code</TableHead>
              <TableHead>Subject Name</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>End Time</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Professor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isReady &&
              classes.map((row) => (
                <TableRow
                  key={row.name}
                  onClick={() => selectRow(row)}
                  className={
                    "cursor-pointer " + (selected?.name === row.name ? "bg-muted" : "")
                  }
                >
                  <TableCell className="font-medium">{row.student_group_name}</TableCell>
                  <TableCell>{row.course_name}</TableCell>
                  <TableCell>
                    {row.is_nstp_or_ms ? `(${row.unit ?? "—"})` : (row.unit ?? "—")}
                  </TableCell>
                  <TableCell>{row.days.join("/") || "—"}</TableCell>
                  <TableCell>{row.start_time ?? "—"}</TableCell>
                  <TableCell>{row.end_time ?? "—"}</TableCell>
                  <TableCell>{row.room ?? "—"}</TableCell>
                  <TableCell>{row.instructor_name ?? "—"}</TableCell>
                </TableRow>
              ))}
            {isReady && classes.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="text-muted-foreground text-center">
                  No classes offered yet for this section — use Prescribe Classes or Add New
                  Class.
                </TableCell>
              </TableRow>
            )}
            {!isReady && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="text-muted-foreground text-center">
                  {notReadyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="pt-3 text-right font-medium">Total Units: {totalUnits}</div>

      {/* Add New Class */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) setAddCourse("")
        }}
      >
        <DialogContent className="w-full max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
            <DialogDescription>
              Add a single subject to this section — for electives or extra sections not on the
              curriculum.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label htmlFor="add-class-course">Subject</label>
            <Select value={addCourse} onValueChange={(v) => setAddCourse(v ?? "")}>
              <SelectTrigger id="add-class-course" className="w-full">
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.subject_code ? `${c.subject_code} — ${c.course_name}` : c.course_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter showCloseButton>
            <Button
              type="button"
              disabled={!addCourse || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              Add Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-full max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>{selected?.student_group_name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label htmlFor="edit-class-course">Subject</label>
            <Select value={editCourse} onValueChange={(v) => setEditCourse(v ?? "")}>
              <SelectTrigger id="edit-class-course" className="w-full">
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.subject_code ? `${c.subject_code} — ${c.course_name}` : c.course_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="edit-class-max">Maximum # of Students</label>
            <Input
              id="edit-class-max"
              type="number"
              min="0"
              value={editMaxStrength}
              onChange={(e) => setEditMaxStrength(e.target.value)}
            />
          </div>
          <DialogFooter showCloseButton>
            <Button
              type="button"
              disabled={!editCourse || !editMaxStrength || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="w-full max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule</DialogTitle>
            <DialogDescription>{selected?.student_group_name}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <label htmlFor="sched-room">Room</label>
            <Select value={schedRoom} onValueChange={(v) => setSchedRoom(v ?? "")}>
              <SelectTrigger id="sched-room" className="w-full">
                <SelectValue placeholder="Select Room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.name} value={r.name}>
                    {r.room_name}
                    {r.room_number ? ` (${r.room_number})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <div className="grid gap-1.5 flex-1">
              <label htmlFor="sched-start">Start Time</label>
              <Input
                id="sched-start"
                type="time"
                value={schedStart}
                onChange={(e) => setSchedStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5 flex-1">
              <label htmlFor="sched-end">End Time</label>
              <Input
                id="sched-end"
                type="time"
                value={schedEnd}
                onChange={(e) => setSchedEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <span>Days</span>
            <div className="flex flex-wrap gap-3">
              {DAY_FIELDS.map((d) => (
                <label key={d} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!schedDays[d]}
                    onChange={(e) =>
                      setSchedDays((prev) => ({ ...prev, [d]: e.target.checked }))
                    }
                  />
                  {DAY_LABELS[d]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <span>Professor</span>
            <InstructorSearch
              selected={schedInstructor}
              onSelect={setSchedInstructor}
              idPrefix="classes-schedule"
            />
          </div>

          <DialogFooter showCloseButton>
            <Button
              type="button"
              disabled={scheduleMutation.isPending}
              onClick={() => scheduleMutation.mutate()}
            >
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Class */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="w-full max-w-sm sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Class</DialogTitle>
            <DialogDescription>
              Remove {selected?.student_group_name}? This cannot be undone. Classes with
              students already enrolled can&apos;t be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              type="button"
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
