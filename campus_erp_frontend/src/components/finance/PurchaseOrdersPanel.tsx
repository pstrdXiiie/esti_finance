"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export type PurchaseOrderStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Ordered"
  | "Received"
  | "Closed"

export interface PurchaseOrderLineItem {
  itemCode: string
  description: string
  qty: string
  unitPrice: string
  /**
   * Never read or written directly — declared only so the read-only
   * "Amount" column below can key off an actual property of this row type
   * (LineItemsTable requires column keys to be real keys of Row). The
   * displayed amount is always derived live via lineItemAmount(row).
   */
  amount?: string
  /**
   * Index signature so this row type structurally satisfies
   * LineItemsTable's `Row extends Record<string, unknown>` constraint
   * (every declared field above is a string or undefined, so this is
   * exact, not a widening escape hatch).
   */
  [key: string]: string | undefined
}

export interface PurchaseOrder {
  id: string
  poDate: string
  supplier: string
  deliveryDate: string
  branch: string
  remarks: string
  paymentTerms: string
  totalAmount: number
  status: PurchaseOrderStatus
  lineItems: PurchaseOrderLineItem[]
}

interface PurchaseOrderDraft {
  poDate: string
  supplier: string
  deliveryDate: string
  branch: string
  remarks: string
  paymentTerms: string
  lineItems: PurchaseOrderLineItem[]
}

const STATUS_BADGE_VARIANT: Record<
  PurchaseOrderStatus,
  "secondary" | "outline" | "default" | "destructive"
> = {
  Draft: "secondary",
  "Pending Approval": "outline",
  Approved: "default",
  Ordered: "default",
  Received: "default",
  Closed: "secondary",
}

const EMPTY_LINE_ITEM: PurchaseOrderLineItem = {
  itemCode: "",
  description: "",
  qty: "",
  unitPrice: "",
}

function parseNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function lineItemAmount(row: PurchaseOrderLineItem): number {
  return parseNumber(row.qty) * parseNumber(row.unitPrice)
}

function computeTotal(lineItems: PurchaseOrderLineItem[]): number {
  return lineItems.reduce((sum, row) => sum + lineItemAmount(row), 0)
}

const LINE_ITEM_COLUMNS: LineItemColumn<PurchaseOrderLineItem>[] = [
  { key: "itemCode", label: "Item Code" },
  { key: "description", label: "Description" },
  { key: "qty", label: "Qty", type: "number", align: "right" },
  { key: "unitPrice", label: "Unit Price", type: "number", align: "right" },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    computed: (row) => `₱${lineItemAmount(row).toFixed(2)}`,
  },
]

const SEED_ITEMS: PurchaseOrder[] = [
  {
    id: "seed-po-1",
    poDate: "2026-08-05",
    supplier: "National Office Supplies",
    deliveryDate: "2026-08-19",
    branch: "Main Campus",
    remarks: "Quarterly restock of office and classroom consumables.",
    paymentTerms: "Net 30",
    totalAmount: 9200,
    status: "Approved",
    lineItems: [
      {
        itemCode: "OFC-1042",
        description: "Bond paper, A4 (ream)",
        qty: "50",
        unitPrice: "150",
      },
      {
        itemCode: "OFC-2091",
        description: "Ballpen, black (box of 12)",
        qty: "20",
        unitPrice: "85",
      },
    ],
  },
  {
    id: "seed-po-2",
    poDate: "2026-08-21",
    supplier: "TechSource Computer Solutions",
    deliveryDate: "2026-09-04",
    branch: "North Campus",
    remarks: "Laptop replacements for the computer laboratory upgrade.",
    paymentTerms: "Net 15",
    totalAmount: 332000,
    status: "Ordered",
    lineItems: [
      {
        itemCode: "IT-100",
        description: "Laptop, Core i5 / 8GB RAM",
        qty: "10",
        unitPrice: "32000",
      },
      {
        itemCode: "IT-101",
        description: "Laptop charger, 65W",
        qty: "10",
        unitPrice: "1200",
      },
    ],
  },
]

function emptyDraft(): PurchaseOrderDraft {
  return {
    poDate: "",
    supplier: "",
    deliveryDate: "",
    branch: "",
    remarks: "",
    paymentTerms: "",
    lineItems: [],
  }
}

export default function PurchaseOrdersPanel() {
  const { items, isFormOpen, toggleForm, closeForm, addItem } =
    useInlineCreateList<PurchaseOrder>(SEED_ITEMS)
  const [draft, setDraft] = useState<PurchaseOrderDraft>(emptyDraft())
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
      draft.poDate.trim() !== "" &&
      draft.supplier.trim() !== "" &&
      draft.deliveryDate.trim() !== "" &&
      draft.branch.trim() !== ""

    if (!requiredFilled) {
      setAttempted(true)
      toast.error("Fill in all required fields.")
      return
    }

    addItem({
      id: crypto.randomUUID(),
      poDate: draft.poDate,
      supplier: draft.supplier,
      deliveryDate: draft.deliveryDate,
      branch: draft.branch,
      remarks: draft.remarks,
      paymentTerms: draft.paymentTerms,
      totalAmount,
      status: "Draft",
      lineItems: draft.lineItems,
    })
    toast.success("Purchase order saved.")
    resetDraft()
  }

  const form = (
    <div className="grid gap-4 rounded-md border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="po-date">PO Date*</Label>
          <Input
            id="po-date"
            type="date"
            value={draft.poDate}
            onChange={(e) => setDraft((d) => ({ ...d, poDate: e.target.value }))}
            aria-invalid={attempted && draft.poDate.trim() === ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="po-supplier">Supplier*</Label>
          <Input
            id="po-supplier"
            value={draft.supplier}
            onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value }))}
            aria-invalid={attempted && draft.supplier.trim() === ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="po-delivery-date">Delivery Date*</Label>
          <Input
            id="po-delivery-date"
            type="date"
            value={draft.deliveryDate}
            onChange={(e) => setDraft((d) => ({ ...d, deliveryDate: e.target.value }))}
            aria-invalid={attempted && draft.deliveryDate.trim() === ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="po-branch">Branch*</Label>
          <Input
            id="po-branch"
            value={draft.branch}
            onChange={(e) => setDraft((d) => ({ ...d, branch: e.target.value }))}
            aria-invalid={attempted && draft.branch.trim() === ""}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="po-remarks">Remarks</Label>
          <Textarea
            id="po-remarks"
            value={draft.remarks}
            onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
            placeholder="Notes for this purchase order…"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="po-total">Total Amount</Label>
          <Input
            id="po-total"
            value={`₱${totalAmount.toFixed(2)}`}
            readOnly
            disabled
            className="bg-muted text-muted-foreground"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="po-payment-terms">Payment Terms</Label>
          <Input
            id="po-payment-terms"
            value={draft.paymentTerms}
            onChange={(e) => setDraft((d) => ({ ...d, paymentTerms: e.target.value }))}
            placeholder="e.g. Net 30"
          />
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
            <TableHead>PO Date</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                No purchase orders yet.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.poDate}</TableCell>
                <TableCell>{item.supplier}</TableCell>
                <TableCell>{item.branch}</TableCell>
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
      title="Purchase Orders"
      addLabel="Add Purchase Order"
      isFormOpen={isFormOpen}
      onToggle={handleToggle}
      form={form}
      table={table}
    />
  )
}
