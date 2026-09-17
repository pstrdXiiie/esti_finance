import type { ChildTableSpec } from "@/lib/forms/types"

export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Revision Requested"

export interface RequisitionRow {
  name: string
  transaction_date: string
  schedule_date: string | null
  requested_by: string | null
  branch: string | null
  pr_purpose: string | null
  justification: string | null
  total_amount: number
  approval_status: ApprovalStatus
  docstatus: number
  recommending_approval: string | null
  approved_by: string | null
  approval_date: string | null
  approval_remarks: string | null
}

export interface RequisitionItemRow {
  item_code: string
  qty: number
  rate: number
  supplier?: string
}

export interface RequisitionDetail extends RequisitionRow {
  company?: string
  items: RequisitionItemRow[]
}

export const REQUISITION_LIST_QUERY_KEY = ["Material Request", "list", "purchase-requisition"]

export const PAGE_SIZE = 5

export const itemsChildTable: ChildTableSpec = {
  fieldname: "items",
  doctype: "Material Request Item",
  columns: [
    {
      fieldname: "item_code",
      label: "Item",
      fieldtype: "Link",
      options: "Item",
      required: true,
      searchable: true,
      searchFields: ["item_code", "item_name"],
    },
    { fieldname: "qty", label: "Qty", fieldtype: "Float", required: true },
    { fieldname: "rate", label: "Unit Cost", fieldtype: "Currency" },
    { fieldname: "supplier", label: "Supplier", fieldtype: "Link", options: "Supplier", dropdown: true },
  ],
}

export function formatCurrency(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function statusBadgeVariant(status: ApprovalStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Approved") return "default"
  if (status === "Rejected") return "destructive"
  if (status === "Revision Requested") return "outline"
  return "secondary"
}
