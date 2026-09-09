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

// The 8 finance code categories — mirrors SMS Fee Header's code_type Select
// options exactly.
const CODE_TYPES = [
  "Asset",
  "Expense",
  "Fees",
  "Liabilities",
  "Miscellaneous",
  "Revenue",
  "Scholarship",
  "Unit",
]

interface HeaderRow {
  name: string
  code_type: string
  particular: string
  amount: number
}

interface DetailRow {
  particular: string
  amount: number
}

interface HeaderDoc extends HeaderRow {
  details: DetailRow[]
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

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * "Codes and Fees" (Finance > Maintenance tab): pick a Code Type, then a
 * "Header" record (one per Course, e.g. "Miscellaneous — BSCS") from the
 * list on the left, and manage its itemized "Detail" fee lines on the
 * right. A Header's Amount is never typed directly — it's the sum of its
 * own Detail lines, recomputed server-side (SMS Fee Header.validate) every
 * save, so it can't drift out of sync with what's actually itemized.
 */
export default function CodesAndFees() {
  const queryClient = useQueryClient()

  const [codeType, setCodeType] = useState(CODE_TYPES[0])

  const headersQuery = useQuery({
    queryKey: ["SMS Fee Header", "list", codeType],
    queryFn: () =>
      frappe.list<HeaderRow>("SMS Fee Header", {
        filters: [["code_type", "=", codeType]],
        fields: ["name", "code_type", "particular", "amount"],
        order_by: "particular asc",
        limit_page_length: 500,
      }),
    enabled: !!codeType,
  })

  const headers = headersQuery.data ?? []

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [isAddingHeader, setIsAddingHeader] = useState(false)
  const [newParticular, setNewParticular] = useState("")
  const [detailRows, setDetailRows] = useState<DetailRow[]>([])
  const [detailForm, setDetailForm] = useState({ particular: "", amount: "" })
  const [editingDetailIndex, setEditingDetailIndex] = useState<number | null>(null)

  // Reset the header selection whenever the Code Type filter changes, so
  // headers from the previous category never linger in the form.
  const [syncedCodeType, setSyncedCodeType] = useState(codeType)
  if (codeType !== syncedCodeType) {
    setSyncedCodeType(codeType)
    setSelectedIndex(null)
    setIsAddingHeader(false)
    setNewParticular("")
    setDetailRows([])
    setSyncedName(undefined)
  }

  const selected = selectedIndex !== null ? headers[selectedIndex] : null

  const { data: fullHeader, isFetching: isLoadingHeader } = useQuery({
    queryKey: ["SMS Fee Header", selected?.name],
    queryFn: () => frappe.getDoc<HeaderDoc>("SMS Fee Header", selected!.name),
    enabled: !!selected,
  })

  if (fullHeader && fullHeader.name !== syncedName) {
    setSyncedName(fullHeader.name)
    setDetailRows(fullHeader.details ?? [])
    setEditingDetailIndex(null)
    setDetailForm({ particular: "", amount: "" })
  }

  if (pendingSelectName) {
    const idx = headers.findIndex((h) => h.name === pendingSelectName)
    if (idx !== -1) {
      setSelectedIndex(idx)
      setPendingSelectName(null)
    }
  }

  function resetDetailForm() {
    setDetailForm({ particular: "", amount: "" })
    setEditingDetailIndex(null)
  }

  function handleAddHeader() {
    setSelectedIndex(null)
    setSyncedName(undefined)
    setIsAddingHeader(true)
    setNewParticular("")
    setDetailRows([])
    resetDetailForm()
  }

  function handleCancelAddHeader() {
    setIsAddingHeader(false)
    setNewParticular("")
    setDetailRows([])
    resetDetailForm()
  }

  function selectRecord(idx: number) {
    if (idx < 0 || idx >= headers.length) return
    setIsAddingHeader(false)
    setSelectedIndex(idx)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        code_type: codeType,
        particular: isAddingHeader ? newParticular : selected!.particular,
        details: detailRows.map((r) => ({ particular: r.particular, amount: r.amount })),
      }
      return isAddingHeader
        ? frappe.createDoc<HeaderDoc>("SMS Fee Header", payload)
        : frappe.updateDoc<HeaderDoc>("SMS Fee Header", selected!.name, payload)
    },
    onSuccess: async (saved) => {
      toast.success("Header saved")
      setIsAddingHeader(false)
      setPendingSelectName(saved.name)
      await queryClient.invalidateQueries({ queryKey: ["SMS Fee Header"] })
    },
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("SMS Fee Header", selected!.name),
    onSuccess: async () => {
      toast.success("Header deleted")
      setSelectedIndex(null)
      setSyncedName(undefined)
      setDetailRows([])
      await queryClient.invalidateQueries({ queryKey: ["SMS Fee Header"] })
    },
    onError: (error) => toast.error(`Could not delete: ${getErrorMessage(error)}`),
  })

  function handleSaveDetail() {
    const amount = Number(detailForm.amount)
    if (!detailForm.particular || !detailForm.amount || Number.isNaN(amount)) return
    const newRow: DetailRow = { particular: detailForm.particular, amount }
    setDetailRows((prev) => {
      if (editingDetailIndex !== null) {
        const next = [...prev]
        next[editingDetailIndex] = newRow
        return next
      }
      return [...prev, newRow]
    })
    resetDetailForm()
  }

  function handleEditDetail(idx: number) {
    const row = detailRows[idx]
    setDetailForm({ particular: row.particular, amount: String(row.amount) })
    setEditingDetailIndex(idx)
  }

  function handleRemoveDetail(idx: number) {
    setDetailRows((prev) => prev.filter((_, i) => i !== idx))
    if (editingDetailIndex === idx) resetDetailForm()
  }

  const detailTotal = detailRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

  const isFormOpen = isAddingHeader || !!selected
  const canSave = isFormOpen && (isAddingHeader ? !!newParticular : true) && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-border h-full p-7 flex flex-col">
      <div className="flex flex-wrap items-end gap-4 pb-10 shrink-0">
        <Field id="fee-code-type" label="Code Type">
          <Select
            value={codeType}
            onValueChange={(v) => v && setCodeType(v)}
          >
            <SelectTrigger id="fee-code-type" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CODE_TYPES.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button type="button" disabled={isAddingHeader} onClick={handleAddHeader}>
          <PlusIcon /> Add
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isAddingHeader || !selected || deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2Icon /> Delete
        </Button>
        {isFormOpen && (
          <div className="ml-auto flex gap-2">
            <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            {isAddingHeader && (
              <Button type="button" variant="outline" onClick={handleCancelAddHeader}>
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2 flex-1 min-h-0">
        <div className="grid gap-2 content-start">
          <span className="text-sm font-semibold text-muted-foreground">Header</span>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Particular</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAddingHeader && (
                  <TableRow>
                    <TableCell>
                      <Input
                        autoFocus
                        placeholder="e.g. BSCS"
                        value={newParticular}
                        onChange={(e) => setNewParticular(e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">0.00</TableCell>
                  </TableRow>
                )}
                {headers.map((h, idx) => (
                  <TableRow
                    key={h.name}
                    className="cursor-pointer"
                    data-state={selectedIndex === idx ? "selected" : undefined}
                    onClick={() => selectRecord(idx)}
                  >
                    <TableCell className="font-medium">{h.particular}</TableCell>
                    <TableCell className="text-right">{formatCurrency(h.amount)}</TableCell>
                  </TableRow>
                ))}
                {!isAddingHeader && headers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground text-center">
                      No headers yet for {codeType}. Click Add to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {selectedIndex !== null && headers.length > 0
                ? `Record ${selectedIndex + 1} of ${headers.length}`
                : "—"}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={isAddingHeader || selectedIndex === null || selectedIndex === 0}
                onClick={() => selectRecord(0)}
              >
                <ChevronsLeft />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={isAddingHeader || selectedIndex === null || selectedIndex === 0}
                onClick={() => selectRecord((selectedIndex ?? 0) - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={
                  isAddingHeader || selectedIndex === null || selectedIndex >= headers.length - 1
                }
                onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
              >
                <ChevronRight />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={
                  isAddingHeader || selectedIndex === null || selectedIndex >= headers.length - 1
                }
                onClick={() => selectRecord(headers.length - 1)}
              >
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 min-h-0" style={{ gridTemplateRows: "auto 1fr" }}>
          <span className="text-sm font-semibold text-muted-foreground">Detail</span>
          {!isFormOpen ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Select a Header on the left (or click Add) to manage its itemized fees.
            </div>
          ) : isLoadingHeader ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="grid gap-3 min-h-0" style={{ gridTemplateRows: "auto 1fr auto" }}>
              <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                <Field id="detail-particular" label="Particular">
                  <Input
                    id="detail-particular"
                    className="w-48"
                    placeholder="e.g. Athletic Fee"
                    value={detailForm.particular}
                    onChange={(e) =>
                      setDetailForm((prev) => ({ ...prev, particular: e.target.value }))
                    }
                  />
                </Field>
                <Field id="detail-amount" label="Amount">
                  <Input
                    id="detail-amount"
                    type="number"
                    className="w-32"
                    value={detailForm.amount}
                    onChange={(e) =>
                      setDetailForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!detailForm.particular || !detailForm.amount}
                  onClick={handleSaveDetail}
                >
                  {editingDetailIndex !== null ? "Update" : "Add"}
                </Button>
              </div>

              <div className="overflow-x-auto overflow-y-auto min-h-0 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Particular</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailRows.map((r, idx) => (
                      <TableRow
                        key={idx}
                        className="cursor-pointer"
                        data-state={editingDetailIndex === idx ? "selected" : undefined}
                        onClick={() => handleEditDetail(idx)}
                      >
                        <TableCell>{r.particular}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remove ${r.particular}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveDetail(idx)
                            }}
                          >
                            <Trash2Icon />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {detailRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-muted-foreground text-center">
                          No detail lines yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{formatCurrency(detailTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
