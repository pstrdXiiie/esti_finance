"use client"

import { useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  SearchIcon,
} from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import EmployeeSearch from "@/components/sms/EmployeeSearch"

interface DepartmentRow {
  name: string
  deptcode: string | null
  department: string | null
  head: string | null
}

interface DepartmentFormState {
  deptcode: string
  department: string
  head: string
}

const BLANK_FORM: DepartmentFormState = {
  deptcode: "",
  department: "",
  head: "",
}

function docToForm(doc: DepartmentRow): DepartmentFormState {
  return {
    deptcode: doc.deptcode ?? "",
    department: doc.department ?? "",
    head: doc.head ?? "",
  }
}

/** Small local label+control wrapper — only consumer is this component. */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

/**
 * "Department" (Employees > Department sub-tab): an SMS Personnel Departments
 * master browsed one record at a time — read-only until Edit or Add is
 * pressed, matching the Courses Offered (Registrar > Maintenance) screen's
 * Add/Edit/Delete/Find toolbar rather than an always-open form.
 */
export default function DepartmentMaintenance() {
  const queryClient = useQueryClient()

  const departmentsQuery = useQuery({
    queryKey: ["SMS Personnel Departments", "list", "department-maintenance"],
    queryFn: () =>
      frappe.list<DepartmentRow>("SMS Personnel Departments", {
        fields: ["name", "deptcode", "department", "head"],
        order_by: "department asc",
        limit_page_length: 500,
      }),
  })

  const departments = departmentsQuery.data ?? []

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<DepartmentFormState>(BLANK_FORM)
  const [isEditing, setIsEditing] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findOpen, setFindOpen] = useState(false)
  const [headPickerOpen, setHeadPickerOpen] = useState(false)

  if (!initialized && departments.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? departments[selectedIndex] : null

  if (selected && selected.name !== syncedName) {
    setSyncedName(selected.name)
    setForm(docToForm(selected))
  }

  if (pendingSelectName) {
    const idx = departments.findIndex((d) => d.name === pendingSelectName)
    if (idx !== -1) {
      setSelectedIndex(idx)
      setPendingSelectName(null)
    }
  }

  function handleAdd() {
    setSelectedIndex(null)
    setSyncedName(undefined)
    setForm(BLANK_FORM)
    setIsEditing(true)
    setHeadPickerOpen(false)
  }

  function handleEdit() {
    if (!selected) return
    setForm(docToForm(selected))
    setIsEditing(true)
    setHeadPickerOpen(false)
  }

  function handleCancel() {
    if (selected) {
      setForm(docToForm(selected))
    } else {
      setForm(BLANK_FORM)
    }
    setIsEditing(false)
    setHeadPickerOpen(false)
  }

  function selectRecord(idx: number) {
    if (idx < 0 || idx >= departments.length) return
    setSelectedIndex(idx)
  }

  const findMatches = findQuery.trim()
    ? departments.filter(
        (d) =>
          d.deptcode?.toLowerCase().includes(findQuery.trim().toLowerCase()) ||
          d.department?.toLowerCase().includes(findQuery.trim().toLowerCase())
      )
    : []

  function jumpToDepartment(name: string) {
    const idx = departments.findIndex((d) => d.name === name)
    if (idx !== -1) setSelectedIndex(idx)
    setFindOpen(false)
  }

  function handleFind() {
    const query = findQuery.trim().toLowerCase()
    if (!query) return
    const idx = departments.findIndex(
      (d) =>
        d.deptcode?.toLowerCase().includes(query) ||
        d.department?.toLowerCase().includes(query)
    )
    if (idx === -1) {
      toast.info(`No department found matching "${findQuery}"`)
      return
    }
    setSelectedIndex(idx)
    setFindOpen(false)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        deptcode: form.deptcode || undefined,
        department: form.department,
        head: form.head || undefined,
      }
      return selected
        ? frappe.updateDoc<DepartmentRow>("SMS Personnel Departments", selected.name, payload)
        : frappe.createDoc<DepartmentRow>("SMS Personnel Departments", payload)
    },
    onSuccess: async (saved) => {
      toast.success("Department saved")
      setPendingSelectName(saved.name)
      setIsEditing(false)
      await queryClient.invalidateQueries({ queryKey: ["SMS Personnel Departments"] })
    },
    onError: (error) => toast.error(`Could not save department: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("SMS Personnel Departments", selected!.name),
    onSuccess: async () => {
      toast.success("Department deleted")
      setSelectedIndex(null)
      setSyncedName(undefined)
      setForm(BLANK_FORM)
      await queryClient.invalidateQueries({ queryKey: ["SMS Personnel Departments"] })
    },
    onError: (error) => toast.error(`Could not delete department: ${getErrorMessage(error)}`),
  })

  const canSave = !!form.department && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-border h-full p-6 grid gap-5 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Button type="button" disabled={isEditing} onClick={handleAdd}>
          <PlusIcon /> Add
        </Button>
        <Button type="button" variant="outline" disabled={isEditing || !selected} onClick={handleEdit}>
          <PencilIcon /> Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isEditing || !selected || deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2Icon /> Delete
        </Button>

        <div
          className="relative flex items-center gap-2 ml-4"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFindOpen(false)
          }}
        >
          <Input
            placeholder="Find by code or name…"
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
                findMatches.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    className="w-full text-left rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => jumpToDepartment(d.name)}
                  >
                    {d.deptcode ? `${d.deptcode} — ` : ""}
                    {d.department}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {isEditing && (
          <div className="ml-auto flex gap-2">
            <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
        <Field id="dept-code" label="Department Code">
          <Input
            id="dept-code"
            value={form.deptcode}
            disabled={!isEditing}
            onChange={(e) => setForm((prev) => ({ ...prev, deptcode: e.target.value }))}
          />
        </Field>
        <Field id="dept-name" label="Department Name">
          <Input
            id="dept-name"
            value={form.department}
            disabled={!isEditing}
            onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
          />
        </Field>
        <Field id="dept-head" label="Head">
          <div className="relative flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <Input
                id="dept-head"
                value={form.head}
                disabled={!isEditing}
                onChange={(e) => setForm((prev) => ({ ...prev, head: e.target.value }))}
              />
              {isEditing && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Search employee"
                  onClick={() => setHeadPickerOpen((prev) => !prev)}
                >
                  <SearchIcon />
                </Button>
              )}
            </div>
            {headPickerOpen && isEditing && (
              <EmployeeSearch
                idPrefix="dept-head"
                selected={null}
                onSelect={(option) => {
                  if (option) {
                    setForm((prev) => ({ ...prev, head: `${option.first_name} ${option.last_name}` }))
                  }
                  setHeadPickerOpen(false)
                }}
              />
            )}
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
        <div className="text-sm text-muted-foreground">
          {selectedIndex !== null && departments.length > 0
            ? `Record ${selectedIndex + 1} of ${departments.length}`
            : "New Department"}
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
            disabled={isEditing || selectedIndex === null || selectedIndex >= departments.length - 1}
            onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex >= departments.length - 1}
            onClick={() => selectRecord(departments.length - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}