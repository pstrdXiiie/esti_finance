"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"

import { LineItemsTable, type LineItemColumn } from "@/components/finance/LineItemsTable"
import { TransactionListWithForm } from "@/components/finance/TransactionListWithForm"
import { useInlineCreateList } from "@/components/finance/useInlineCreateList"

export type PurchaseRequisitionStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Rejected"

// A `type` alias (not `interface`) so TS grants it the implicit index
// signature that satisfies LineItemsTable's `Row extends Record<string, unknown>`
// generic constraint — an `interface` with the same shape would not qualify.
export type PurchaseRequisitionLineItem = {
  itemCode: string
  qty: string
  rate: string
  supplier: string
}

export interface PurchaseRequisition {
  id: string
  date: string
  requestedBy: string
  purpose: string
  company: string
  branch: string
  totalAmount: number
  status: PurchaseRequisitionStatus
  lineItems: PurchaseRequisitionLineItem[]
}

interface PurchaseRequisitionDraft {
  date: string
  requestedBy: string
  purpose: string
  company: string
  branch: string
  status: PurchaseRequisitionStatus
  lineItems: PurchaseRequisitionLineItem[]
}

const STATUS_OPTIONS: PurchaseRequisitionStatus[] = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Rejected",
]

const STATUS_BADGE_VARIANT: Record<
  PurchaseRequisitionStatus,
  "secondary" | "outline" | "default" | "destructive"
> = {
  Draft: "secondary",
  "Pending Approval": "outline",
  Approved: "default",
  Rejected: "destructive",
}

const EMPTY_LINE_ITEM: PurchaseRequisitionLineItem = {
  itemCode: "",
  qty: "",
  rate: "",
  supplier: "",
}

const LINE_ITEM_COLUMNS: LineItemColumn<PurchaseRequisitionLineItem>[] = [
  { key: "itemCode", label: "Item Code" },
  { key: "qty", label: "Qty", type: "number", align: "right" },
  { key: "rate", label: "Rate", type: "number", align: "right" },
  { key: "supplier", label: "Supplier" },
]

const SEED_ITEMS: PurchaseRequisition[] = [
  {
    id: "seed-pr-1",
    date: "2026-08-14",
    requestedBy: "Marisol Reyes",
    purpose:
      "Restock of classroom whiteboard markers and printer toner for the registrar's office.",
    company: "ESTI Learning Systems Inc.",
    branch: "Main Campus",
    totalAmount: 8250,
    status: "Approved",
    lineItems: [
      { itemCode: "OFC-1042", qty: "50", rate: "45", supplier: "National Office Supplies" },
      { itemCode: "PRT-TNR-04", qty: "6", rate: "1000", supplier: "PrintWorks Trading" },
    ],
  },
  {
    id: "seed-pr-2",
    date: "2026-09-02",
    requestedBy: "Julius Cabrera",
    purpose:
      "Replacement projector bulbs for Rooms 201 and 204 ahead of the semester exams.",
    company: "ESTI Learning Systems Inc.",
    branch: "North Campus",
    totalAmount: 6400,
    status: "Pending Approval",
    lineItems: [
      { itemCode: "AVX-BULB-7", qty: "4", rate: "1600", supplier: "AV Solutions Co." },
    ],
  },
]

function parseNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function computeTotal(lineItems: PurchaseRequisitionLineItem[]): number {
  return lineItems.reduce(
    (sum, row) => sum + parseNumber(row.qty) * parseNumber(row.rate),
    0
  )
}

function emptyDraft(): PurchaseRequisitionDraft {
  return {
    date: "",
    requestedBy: "",
    purpose: "",
    company: "",
    branch: "",
    status: "Draft",
    lineItems: [],
  }
}

export default function PurchaseRequisitionsPanel() {
  const { items, isFormOpen, toggleForm, closeForm, addItem } =
    useInlineCreateList<PurchaseRequisition>(SEED_ITEMS)
  const [draft, setDraft] = useState<PurchaseRequisitionDraft>(emptyDraft())
  const [attempted, setAttempted] = useState(false)

  const totalAmount = computeTotal(draft.lineItems)

  function resetDraft() {
    setDraft(emptyDraft())
    setAttempted(false)
  }

  function handleToggle() {
    resetDraft()
    toggleForm()
  }

  function handleCancel() {
    resetDraft()
    closeForm()
  }

  function handleSave() {
    const requiredFilled =
      draft.date.trim() !== "" &&
      draft.requestedBy.trim() !== "" &&
      draft.purpose.trim() !== "" &&
      draft.company.trim() !== ""

    if (!requiredFilled) {
      setAttempted(true)
      toast.error("Fill in all required fields.")
      return
    }

    addItem({
      id: crypto.randomUUID(),
      date: draft.date,
      requestedBy: draft.requestedBy,
      purpose: draft.purpose,
      company: draft.company,
      branch: draft.branch,
      totalAmount,
      status: draft.status,
      lineItems: draft.lineItems,
    })
    toast.success("Purchase requisition saved.")
    resetDraft()
  }

  const form = (
    <div className="grid gap-4 rounded-md border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="pr-date">Date*</Label>
          <Input
            id="pr-date"
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            aria-invalid={attempted && draft.date.trim() === ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-requested-by">Requested By*</Label>
          <Input
            id="pr-requested-by"
            value={draft.requestedBy}
            onChange={(e) => setDraft((d) => ({ ...d, requestedBy: e.target.value }))}
            aria-invalid={attempted && draft.requestedBy.trim() === ""}
            placeholder="Name of requester"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-company">Company*</Label>
          <Input
            id="pr-company"
            value={draft.company}
            onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
            aria-invalid={attempted && draft.company.trim() === ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-branch">Branch</Label>
          <Input
            id="pr-branch"
            value={draft.branch}
            onChange={(e) => setDraft((d) => ({ ...d, branch: e.target.value }))}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="pr-purpose">Purpose / Remarks*</Label>
          <Textarea
            id="pr-purpose"
            value={draft.purpose}
            onChange={(e) => setDraft((d) => ({ ...d, purpose: e.target.value }))}
            aria-invalid={attempted && draft.purpose.trim() === ""}
            placeholder="Reason for this requisition…"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-total">Total Amount</Label>
          <Input
            id="pr-total"
            value={`₱${totalAmount.toFixed(2)}`}
            readOnly
            disabled
            className="bg-muted text-muted-foreground"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pr-status">Status</Label>
          <Select
            value={draft.status}
            onValueChange={(v) =>
              setDraft((d) => ({ ...d, status: (v ?? "Draft") as PurchaseRequisitionStatus }))
            }
          >
            <SelectTrigger id="pr-status" className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <LineItemsTable
        columns={LINE_ITEM_COLUMNS}
        rows={draft.lineItems}
        onChange={(rows) => setDraft((d) => ({ ...d, lineItems: rows }))}
        emptyRow={EMPTY_LINE_ITEM}
        emptyStateLabel="No line items yet."
      />

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  )

  const table = (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Requested By</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No purchase requisitions yet.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.date}</TableCell>
                <TableCell>{item.requestedBy}</TableCell>
                <TableCell>{item.branch || "—"}</TableCell>
                <TableCell className="text-right">₱{item.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[item.status]}>{item.status}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <TransactionListWithForm
      title="Purchase Requisitions"
      addLabel="Add Purchase Requisition"
      isFormOpen={isFormOpen}
      onToggle={handleToggle}
      form={form}
      table={table}
    />
  )
}
