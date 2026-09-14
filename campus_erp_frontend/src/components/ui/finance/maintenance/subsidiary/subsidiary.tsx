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
  Trash2Icon,
  PrinterIcon,
} from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"

interface SubsidiaryEntryRow {
  date: string
  employee: string
  employee_number: string | null
  payor: string | null
  amount: number
}

interface SubsidiaryLedgerRow {
  name: string
  account_title: string
  date: string
  total: number
}

interface SubsidiaryLedgerDoc extends SubsidiaryLedgerRow {
  entries: SubsidiaryEntryRow[]
}

interface AccountRow {
  name: string
  account_name: string
}

interface EmployeeRow {
  name: string
  employee_number: string | null
  employee_name: string
}

interface LedgerFormState {
  account_title: string
  date: string
}

interface EntryFormState {
  employee: string
  amount: string
  date: string
}

const today = () => new Date().toISOString().slice(0, 10)

const BLANK_FORM: LedgerFormState = { account_title: "", date: today() }

function docToForm(doc: SubsidiaryLedgerDoc): LedgerFormState {
  return { account_title: doc.account_title ?? "", date: doc.date ?? today() }
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
 * "Subsidiary" (Finance > Maintenance): one Subsidiary Ledger record at a
 * time — an Account Title + Date batch of per-employee entries — paged
 * through the same way Registrar's Curriculum Offered pages through
 * curricula, whose layout/toolbar/child-table/pager structure this mirrors
 * directly. Replaces the legacy "Subsidiary Maintenance" dialog (Account
 * Title/Date header, Emp No/Employee Name/Amount + Add sub-form,
 * Date/Code/Payor/Amount grid, Total).
 */
export default function Subsidiary() {
  const queryClient = useQueryClient()

  const ledgersQuery = useQuery({
    queryKey: ["SMS Subsidiary Ledger", "list", "subsidiary-maintenance"],
    queryFn: () =>
      frappe.list<SubsidiaryLedgerRow>("SMS Subsidiary Ledger", {
        fields: ["name", "account_title", "date", "total"],
        order_by: "date desc",
        limit_page_length: 500,
      }),
  })

  const accountsQuery = useQuery({
    queryKey: ["Account", "leaf", "subsidiary-maintenance"],
    queryFn: () =>
      frappe.list<AccountRow>("Account", {
        fields: ["name", "account_name"],
        filters: [["is_group", "=", 0]],
        limit_page_length: 500,
      }),
  })

  const employeesQuery = useQuery({
    queryKey: ["Employee", "list", "subsidiary-maintenance"],
    queryFn: () =>
      frappe.list<EmployeeRow>("Employee", {
        fields: ["name", "employee_number", "employee_name"],
        filters: [["status", "=", "Active"]],
        limit_page_length: 500,
      }),
  })

  const ledgers = ledgersQuery.data ?? []
  const employees = employeesQuery.data ?? []
  const employeeByName = new Map(employees.map((e) => [e.name, e]))

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<LedgerFormState>(BLANK_FORM)
  const [entryRows, setEntryRows] = useState<SubsidiaryEntryRow[]>([])
  const [entryForm, setEntryForm] = useState<EntryFormState>({ employee: "", amount: "", date: today() })
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null)

  if (!initialized && ledgers.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? ledgers[selectedIndex] : null

  const { data: fullDoc, isFetching: isLoadingDoc } = useQuery({
    queryKey: ["SMS Subsidiary Ledger", selected?.name],
    queryFn: () => frappe.getDoc<SubsidiaryLedgerDoc>("SMS Subsidiary Ledger", selected!.name),
    enabled: !!selected,
  })

  if (fullDoc && fullDoc.name !== syncedName) {
    setSyncedName(fullDoc.name)
    const nextForm = docToForm(fullDoc)
    setForm(nextForm)
    setEntryRows(fullDoc.entries ?? [])
    setEntryForm({ employee: "", amount: "", date: nextForm.date })
    setEditingEntryIndex(null)
  }

  if (pendingSelectName) {
    const idx = ledgers.findIndex((l) => l.name === pendingSelectName)
    if (idx !== -1) {
      setSelectedIndex(idx)
      setPendingSelectName(null)
    }
  }

  function resetEntryForm() {
    setEntryForm({ employee: "", amount: "", date: form.date })
    setEditingEntryIndex(null)
  }

  function handleAdd() {
    setSelectedIndex(null)
    setSyncedName(undefined)
    setForm(BLANK_FORM)
    setEntryRows([])
    setEntryForm({ employee: "", amount: "", date: BLANK_FORM.date })
    setEditingEntryIndex(null)
  }

  function handleCancel() {
    if (fullDoc) {
      setForm(docToForm(fullDoc))
      setEntryRows(fullDoc.entries ?? [])
    } else {
      setForm(BLANK_FORM)
      setEntryRows([])
    }
    resetEntryForm()
  }

  function selectRecord(idx: number) {
    if (idx < 0 || idx >= ledgers.length) return
    setSelectedIndex(idx)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        account_title: form.account_title,
        date: form.date,
        entries: entryRows.map((r) => ({ date: r.date, employee: r.employee, amount: r.amount })),
      }
      return selected
        ? frappe.updateDoc<SubsidiaryLedgerDoc>("SMS Subsidiary Ledger", selected.name, payload)
        : frappe.createDoc<SubsidiaryLedgerDoc>("SMS Subsidiary Ledger", payload)
    },
    onSuccess: async (saved) => {
      toast.success("Subsidiary ledger saved")
      setPendingSelectName(saved.name)
      await queryClient.invalidateQueries({ queryKey: ["SMS Subsidiary Ledger"] })
    },
    onError: (error) => toast.error(`Could not save subsidiary ledger: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("SMS Subsidiary Ledger", selected!.name),
    onSuccess: async () => {
      toast.success("Subsidiary ledger deleted")
      await queryClient.invalidateQueries({ queryKey: ["SMS Subsidiary Ledger"] })
      handleAdd()
    },
    onError: (error) => toast.error(`Could not delete subsidiary ledger: ${getErrorMessage(error)}`),
  })

  // Same persist-immediately-once-a-parent-record-exists convention as
  // curriculum-offered.tsx's saveSubjectMutation — otherwise "Add" would
  // look like it silently did nothing until the separate top-level Save
  // was clicked too.
  const addEntryMutation = useMutation({
    mutationFn: async () => {
      const emp = employeeByName.get(entryForm.employee)
      const isNewEntry = editingEntryIndex === null
      const newRow: SubsidiaryEntryRow = {
        date: entryForm.date,
        employee: entryForm.employee,
        employee_number: emp?.employee_number ?? null,
        payor: emp?.employee_name ?? null,
        amount: Number(entryForm.amount) || 0,
      }
      const nextRows = isNewEntry
        ? [...entryRows, newRow]
        : entryRows.map((r, i) => (i === editingEntryIndex ? newRow : r))

      if (!selected) {
        return { rows: nextRows, persisted: false as const }
      }

      const saved = await frappe.updateDoc<SubsidiaryLedgerDoc>("SMS Subsidiary Ledger", selected.name, {
        entries: nextRows.map((r) => ({ date: r.date, employee: r.employee, amount: r.amount })),
      })
      return { rows: saved.entries, persisted: true as const }
    },
    onSuccess: async ({ rows, persisted }) => {
      setEntryRows(rows)
      resetEntryForm()
      if (!persisted) return
      toast.success("Entry added")
      await queryClient.invalidateQueries({ queryKey: ["SMS Subsidiary Ledger"] })
    },
    onError: (error) => toast.error(`Could not add entry: ${getErrorMessage(error)}`),
  })

  function handleAddEntry() {
    if (!entryForm.employee || !entryForm.amount) return
    addEntryMutation.mutate()
  }

  function handleEditEntryRow(idx: number) {
    const row = entryRows[idx]
    setEntryForm({ employee: row.employee, amount: String(row.amount), date: row.date })
    setEditingEntryIndex(idx)
  }

  // Same reasoning as addEntryMutation — Remove staying local-only while Add
  // persists immediately would trade one "doesn't actually save" surprise
  // for a "deleted it but it came back" one in the opposite direction.
  const removeEntryMutation = useMutation({
    mutationFn: async (idx: number) => {
      const nextRows = entryRows.filter((_, i) => i !== idx)
      if (!selected) {
        return { rows: nextRows, persisted: false as const, idx }
      }
      const saved = await frappe.updateDoc<SubsidiaryLedgerDoc>("SMS Subsidiary Ledger", selected.name, {
        entries: nextRows.map((r) => ({ date: r.date, employee: r.employee, amount: r.amount })),
      })
      return { rows: saved.entries, persisted: true as const, idx }
    },
    onSuccess: async ({ rows, persisted, idx }) => {
      setEntryRows(rows)
      if (editingEntryIndex === idx) resetEntryForm()
      if (persisted) {
        toast.success("Entry removed")
        await queryClient.invalidateQueries({ queryKey: ["SMS Subsidiary Ledger"] })
      }
    },
    onError: (error) => toast.error(`Could not remove entry: ${getErrorMessage(error)}`),
  })

  function handleRemoveEntryRow(idx: number) {
    removeEntryMutation.mutate(idx)
  }

  // Save Add/Update and Remove both read-then-write the full entryRows
  // array against the same record — letting them overlap risks one
  // clobbering the other with a stale snapshot once both resolve, so each
  // is disabled while the other is in flight.
  const entryMutationPending = addEntryMutation.isPending || removeEntryMutation.isPending

  const total = entryRows.reduce((sum, r) => sum + (r.amount || 0), 0)
  const selectedEmployee = entryForm.employee ? employeeByName.get(entryForm.employee) : undefined
  const canSave = !!form.account_title && !!form.date && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-border h-full p-6 flex flex-col gap-5 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Button type="button" onClick={handleAdd}>
          <PlusIcon /> Add
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!selected || deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2Icon /> Delete
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <PrinterIcon /> Print
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {selected && isLoadingDoc ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Field id="sub-account-title" label="Account Title">
              <Select
                value={form.account_title}
                onValueChange={(v) => setForm((prev) => ({ ...prev, account_title: v ?? "" }))}
              >
                <SelectTrigger id="sub-account-title" className="w-[250px]">
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent>
                  {(accountsQuery.data ?? []).map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="sub-date" label="Date">
              <Input
                id="sub-date"
                type="date"
                className="w-[180px]"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-3 rounded-md border p-4">
            <span className="text-sm font-semibold text-muted-foreground">Entries</span>

            <div className="flex flex-wrap items-end gap-4">
              <Field id="entry-employee" label="Emp No">
                <Select
                  value={entryForm.employee}
                  onValueChange={(v) => setEntryForm((prev) => ({ ...prev, employee: v ?? "" }))}
                >
                  <SelectTrigger id="entry-employee" className="w-64">
                    <SelectValue placeholder="Select an employee…" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.name} value={e.name}>
                        {e.employee_number ? `${e.employee_number} — ${e.employee_name}` : e.employee_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="entry-name" label="Employee Name">
                <Input id="entry-name" className="w-64" value={selectedEmployee?.employee_name ?? ""} disabled />
              </Field>
              <Field id="entry-amount" label="Amount">
                <Input
                  id="entry-amount"
                  type="number"
                  className="w-32"
                  value={entryForm.amount}
                  onChange={(e) => setEntryForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                disabled={!entryForm.employee || !entryForm.amount || entryMutationPending}
                onClick={handleAddEntry}
              >
                {addEntryMutation.isPending ? "Saving…" : editingEntryIndex !== null ? "Update Entry" : "Add"}
              </Button>
              <div className="ml-auto text-right">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-xl font-bold text-destructive">
                  ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Payor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entryRows.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className="cursor-pointer"
                      data-state={editingEntryIndex === idx ? "selected" : undefined}
                      onClick={() => handleEditEntryRow(idx)}
                    >
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.employee_number ?? "—"}</TableCell>
                      <TableCell>{row.payor ?? "—"}</TableCell>
                      <TableCell className="text-right">{row.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={entryMutationPending}
                          aria-label={`Remove ${row.payor ?? row.employee}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveEntryRow(idx)
                          }}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {entryRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No entries yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="text-sm text-muted-foreground">
          {selectedIndex !== null && ledgers.length > 0
            ? `Record ${selectedIndex + 1} of ${ledgers.length}`
            : "New Subsidiary Ledger"}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord(0)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord((selectedIndex ?? 0) - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex >= ledgers.length - 1}
            onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex >= ledgers.length - 1}
            onClick={() => selectRecord(ledgers.length - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
