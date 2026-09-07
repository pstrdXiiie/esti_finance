"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
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
import { Skeleton } from "@/components/ui/skeleton"

interface SimpleRow {
  name: string
}

/**
 * Bespoke desk: issue a consumable Item to an employee. Calls
 * campus_erp.api.asset.issue_consumable, which resolves
 * uom/stock_uom/conversion_factor from the Item master server-side — the
 * frontend only collects item_code/qty/employee/warehouse, not all ~80
 * fields the real Stock Entry doctype carries.
 */
export default function AssetConsumablesPage() {
  const [itemCode, setItemCode] = useState("")
  const [qty, setQty] = useState("")
  const [employee, setEmployee] = useState("")
  const [branch, setBranch] = useState("")
  const [company, setCompany] = useState("")
  const [warehouse, setWarehouse] = useState("")

  const itemsQuery = useQuery({
    queryKey: ["Item", "consumables-page"],
    queryFn: () => frappe.list<{ name: string; item_name: string }>("Item", { fields: ["name", "item_name"], limit_page_length: 500 }),
  })
  const employeesQuery = useQuery({
    queryKey: ["Employee", "consumables-page"],
    queryFn: () => frappe.list<{ name: string; employee_name: string }>("Employee", { fields: ["name", "employee_name"], limit_page_length: 500 }),
  })
  const branchesQuery = useQuery({
    queryKey: ["Branch", "list"],
    queryFn: () => frappe.list<SimpleRow>("Branch", { limit_page_length: 100 }),
  })
  const warehousesQuery = useQuery({
    queryKey: ["Warehouse", "list"],
    queryFn: () => frappe.list<SimpleRow>("Warehouse", { limit_page_length: 100 }),
  })

  const issueMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ name: string }>("campus_erp.api.asset.issue_consumable", {
        item_code: itemCode,
        qty: Number(qty),
        employee,
        branch: branch || undefined,
        company,
        warehouse,
      }),
    onSuccess: (result) => {
      toast.success(`Consumable issued: ${result.name}`)
      setItemCode("")
      setQty("")
      setEmployee("")
    },
    onError: (error) => toast.error(`Could not issue consumable: ${getErrorMessage(error)}`),
  })

  const loading =
    itemsQuery.isLoading || employeesQuery.isLoading || branchesQuery.isLoading || warehousesQuery.isLoading

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Consumable Issue</h1>
        <p className="text-muted-foreground">Issue a stock consumable item to an employee.</p>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid max-w-xl gap-4 rounded-md border p-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Item</label>
            <Select value={itemCode} onValueChange={(v) => setItemCode(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an item…" />
              </SelectTrigger>
              <SelectContent>
                {(itemsQuery.data ?? []).map((i) => (
                  <SelectItem key={i.name} value={i.name}>
                    {i.item_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Quantity</label>
            <Input type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Issued To Employee</label>
            <Select value={employee} onValueChange={(v) => setEmployee(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an employee…" />
              </SelectTrigger>
              <SelectContent>
                {(employeesQuery.data ?? []).map((e) => (
                  <SelectItem key={e.name} value={e.name}>
                    {e.employee_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Warehouse</label>
            <Select value={warehouse} onValueChange={(v) => setWarehouse(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a source warehouse…" />
              </SelectTrigger>
              <SelectContent>
                {(warehousesQuery.data ?? []).map((w) => (
                  <SelectItem key={w.name} value={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Branch</label>
            <Select value={branch} onValueChange={(v) => setBranch(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Optional…" />
              </SelectTrigger>
              <SelectContent>
                {(branchesQuery.data ?? []).map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Company</label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Exact company name" />
          </div>
          <Button
            type="button"
            className="w-fit"
            disabled={!itemCode || !qty || Number(qty) <= 0 || !employee || !warehouse || !company || issueMutation.isPending}
            onClick={() => issueMutation.mutate()}
          >
            {issueMutation.isPending ? "Issuing…" : "Issue"}
          </Button>
        </div>
      )}
    </div>
  )
}
