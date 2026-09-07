"use client"

import { useMemo, useState } from "react"
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
  location?: string
  company: string
}

interface SimpleRow {
  name: string
}

/**
 * Bespoke desk: move one or more assets to new locations in a single
 * submitted Asset Movement (purpose=Transfer), via
 * campus_erp.api.asset.transfer_assets. Each selected asset gets its own
 * target location (a plain checkbox-per-row picker plus an inline location
 * Select once checked — a proper multi-select grid isn't worth building for
 * this pass, matching the same simplification used for the Canteen PCV
 * replenishment picker).
 */
export default function AssetTransfersPage() {
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [company, setCompany] = useState("")
  const [branch, setBranch] = useState("")
  const [transferReason, setTransferReason] = useState("")

  const assetsQuery = useQuery({
    queryKey: ["Asset", "transfer-page"],
    queryFn: () =>
      frappe.list<AssetRow>("Asset", {
        fields: ["name", "asset_name", "location", "company"],
        filters: [["docstatus", "=", 1]],
        limit_page_length: 200,
      }),
  })
  const locationsQuery = useQuery({
    queryKey: ["Location", "list"],
    queryFn: () => frappe.list<SimpleRow>("Location", { limit_page_length: 200 }),
  })
  const branchesQuery = useQuery({
    queryKey: ["Branch", "list"],
    queryFn: () => frappe.list<SimpleRow>("Branch", { limit_page_length: 100 }),
  })

  function toggle(name: string) {
    setSelected((prev) => {
      const next = { ...prev }
      if (name in next) {
        delete next[name]
      } else {
        next[name] = ""
      }
      return next
    })
  }

  function setTargetLocation(name: string, location: string) {
    setSelected((prev) => ({ ...prev, [name]: location }))
  }

  const selectedAssets = useMemo(
    () => Object.entries(selected).map(([asset, target_location]) => ({ asset, target_location })),
    [selected]
  )
  const allTargetsChosen = selectedAssets.length > 0 && selectedAssets.every((r) => r.target_location)

  const transferMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ name: string }>("campus_erp.api.asset.transfer_assets", {
        assets: selectedAssets,
        company,
        branch: branch || undefined,
        transfer_reason: transferReason || undefined,
      }),
    onSuccess: (result) => {
      toast.success(`Transfer posted: ${result.name}`)
      setSelected({})
      setTransferReason("")
    },
    onError: (error) => toast.error(`Could not create transfer: ${getErrorMessage(error)}`),
  })

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Equipment Transfers</h1>
        <p className="text-muted-foreground">
          Select assets and where each one is moving to, then post one transfer record.
        </p>
      </div>

      {assetsQuery.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Asset</TableHead>
                <TableHead>Current Location</TableHead>
                <TableHead>Target Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(assetsQuery.data ?? []).map((a) => (
                <TableRow key={a.name}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={a.name in selected}
                      onChange={() => toggle(a.name)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {a.asset_name} ({a.name})
                  </TableCell>
                  <TableCell>{a.location}</TableCell>
                  <TableCell>
                    {a.name in selected && (
                      <Select
                        value={selected[a.name]}
                        onValueChange={(v) => setTargetLocation(a.name, v ?? "")}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select target…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(locationsQuery.data ?? []).map((l) => (
                            <SelectItem key={l.name} value={l.name}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(assetsQuery.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No submitted assets found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Separator />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-56 gap-2">
          <label className="text-sm font-medium">Company</label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Exact company name" />
        </div>
        <div className="grid min-w-48 gap-2">
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
        <div className="grid min-w-56 gap-2">
          <label className="text-sm font-medium">Transfer Reason</label>
          <Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
        </div>
        <Button
          type="button"
          disabled={!allTargetsChosen || !company || transferMutation.isPending}
          onClick={() => transferMutation.mutate()}
        >
          {transferMutation.isPending
            ? "Posting…"
            : `Transfer${selectedAssets.length ? ` (${selectedAssets.length})` : ""}`}
        </Button>
      </div>
    </div>
  )
}
