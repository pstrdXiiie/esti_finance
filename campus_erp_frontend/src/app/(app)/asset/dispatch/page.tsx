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
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

interface AssetRow {
  name: string
  asset_name: string
  custodian?: string
  location?: string
  company: string
}

interface SimpleRow {
  name: string
}

/**
 * Bespoke desk (not a generic template): dispatch an asset to an employee,
 * or return one already in someone's custody. Both call
 * campus_erp.api.asset.dispatch_asset/return_asset directly rather than
 * exposing raw Asset Movement CRUD, which carries far more fields than this
 * screen needs.
 */
export default function AssetDispatchPage() {
  const queryClient = useQueryClient()

  const assetsQuery = useQuery({
    queryKey: ["Asset", "dispatch-page"],
    queryFn: () =>
      frappe.list<AssetRow>("Asset", {
        fields: ["name", "asset_name", "custodian", "location", "company"],
        filters: [["docstatus", "=", 1]],
        limit_page_length: 200,
      }),
  })
  const employeesQuery = useQuery({
    queryKey: ["Employee", "dispatch-page"],
    queryFn: () => frappe.list<{ name: string; employee_name: string }>("Employee", { fields: ["name", "employee_name"], limit_page_length: 500 }),
  })
  const locationsQuery = useQuery({
    queryKey: ["Location", "list"],
    queryFn: () => frappe.list<SimpleRow>("Location", { limit_page_length: 200 }),
  })

  const available = (assetsQuery.data ?? []).filter((a) => !a.custodian)
  const dispatched = (assetsQuery.data ?? []).filter((a) => a.custodian)

  function invalidateAssets() {
    queryClient.invalidateQueries({ queryKey: ["Asset", "dispatch-page"] })
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dispatch & Return</h1>
        <p className="text-muted-foreground">Issue an asset to an employee, or receive one back.</p>
      </div>

      <DispatchPanel
        assets={available}
        employees={employeesQuery.data ?? []}
        loading={assetsQuery.isLoading || employeesQuery.isLoading}
        onDone={invalidateAssets}
      />

      <Separator />

      <ReturnPanel
        assets={dispatched}
        locations={locationsQuery.data ?? []}
        loading={assetsQuery.isLoading || locationsQuery.isLoading}
        onDone={invalidateAssets}
      />

      <Separator />

      <div className="grid gap-2">
        <h2 className="font-semibold">Currently Dispatched</h2>
        {assetsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Custodian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatched.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.asset_name}</TableCell>
                    <TableCell>{a.custodian}</TableCell>
                  </TableRow>
                ))}
                {dispatched.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      No assets currently dispatched.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

function DispatchPanel({
  assets,
  employees,
  loading,
  onDone,
}: {
  assets: AssetRow[]
  employees: Array<{ name: string; employee_name: string }>
  loading: boolean
  onDone: () => void
}) {
  const [asset, setAsset] = useState("")
  const [employee, setEmployee] = useState("")
  const [remarks, setRemarks] = useState("")

  const company = assets.find((a) => a.name === asset)?.company ?? ""

  const dispatchMutation = useMutation({
    mutationFn: () =>
      frappe.call("campus_erp.api.asset.dispatch_asset", {
        asset,
        to_employee: employee,
        company,
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      toast.success("Asset dispatched")
      setAsset("")
      setEmployee("")
      setRemarks("")
      onDone()
    },
    onError: (error) => toast.error(`Could not dispatch asset: ${getErrorMessage(error)}`),
  })

  return (
    <div className="grid gap-3 rounded-md border p-4">
      <h2 className="font-semibold">Dispatch an Asset</h2>
      {loading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-56 gap-2">
            <label className="text-sm font-medium">Asset</label>
            <Select value={asset} onValueChange={(v) => setAsset(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an available asset…" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.name} value={a.name}>
                    {a.asset_name} ({a.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-56 gap-2">
            <label className="text-sm font-medium">To Employee</label>
            <Select value={employee} onValueChange={(v) => setEmployee(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an employee…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.name} value={e.name}>
                    {e.employee_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-56 gap-2">
            <label className="text-sm font-medium">Remarks</label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <Button
            type="button"
            disabled={!asset || !employee || dispatchMutation.isPending}
            onClick={() => dispatchMutation.mutate()}
          >
            {dispatchMutation.isPending ? "Dispatching…" : "Dispatch"}
          </Button>
        </div>
      )}
    </div>
  )
}

function ReturnPanel({
  assets,
  locations,
  loading,
  onDone,
}: {
  assets: AssetRow[]
  locations: SimpleRow[]
  loading: boolean
  onDone: () => void
}) {
  const [asset, setAsset] = useState("")
  const [targetLocation, setTargetLocation] = useState("")
  const [remarks, setRemarks] = useState("")

  const company = assets.find((a) => a.name === asset)?.company ?? ""

  const returnMutation = useMutation({
    mutationFn: () =>
      frappe.call("campus_erp.api.asset.return_asset", {
        asset,
        company,
        target_location: targetLocation,
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      toast.success("Asset returned")
      setAsset("")
      setTargetLocation("")
      setRemarks("")
      onDone()
    },
    onError: (error) => toast.error(`Could not return asset: ${getErrorMessage(error)}`),
  })

  return (
    <div className="grid gap-3 rounded-md border p-4">
      <h2 className="font-semibold">Return an Asset</h2>
      {loading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-56 gap-2">
            <label className="text-sm font-medium">Asset</label>
            <Select value={asset} onValueChange={(v) => setAsset(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a dispatched asset…" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.name} value={a.name}>
                    {a.asset_name} ({a.name}) — {a.custodian}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-56 gap-2">
            <label className="text-sm font-medium">Return To Location</label>
            <Select value={targetLocation} onValueChange={(v) => setTargetLocation(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a location…" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.name} value={l.name}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-56 gap-2">
            <label className="text-sm font-medium">Remarks</label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <Button
            type="button"
            disabled={!asset || !targetLocation || returnMutation.isPending}
            onClick={() => returnMutation.mutate()}
          >
            {returnMutation.isPending ? "Returning…" : "Return"}
          </Button>
        </div>
      )}
    </div>
  )
}
