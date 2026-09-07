"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
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
}

interface SimpleRow {
  name: string
}

interface BatchRow {
  name: string
  batch_datetime?: string
  branch?: string
}

/**
 * Bespoke desk: pick assets to print stickers for, post one
 * SMS Asset Sticker Batch via campus_erp.api.asset.create_sticker_batch
 * (which auto-fetches description/dates/department per asset), same
 * checkbox-picker pattern as the Canteen PCV replenishment panel.
 */
export default function AssetStickersPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [branch, setBranch] = useState("")

  const assetsQuery = useQuery({
    queryKey: ["Asset", "sticker-page"],
    queryFn: () =>
      frappe.list<AssetRow>("Asset", {
        fields: ["name", "asset_name"],
        filters: [["docstatus", "=", 1]],
        limit_page_length: 200,
      }),
  })
  const branchesQuery = useQuery({
    queryKey: ["Branch", "list"],
    queryFn: () => frappe.list<SimpleRow>("Branch", { limit_page_length: 100 }),
  })
  const batchesQuery = useQuery({
    queryKey: ["SMS Asset Sticker Batch", "list"],
    queryFn: () =>
      frappe.list<BatchRow>("SMS Asset Sticker Batch", {
        fields: ["name", "batch_datetime", "branch"],
        order_by: "creation desc",
        limit_page_length: 50,
      }),
  })

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const selectedNames = useMemo(() => Array.from(selected), [selected])

  const batchMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ name: string }>("campus_erp.api.asset.create_sticker_batch", {
        assets: selectedNames,
        branch,
      }),
    onSuccess: (result) => {
      toast.success(`Sticker batch created: ${result.name}`)
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ["SMS Asset Sticker Batch"] })
    },
    onError: (error) => toast.error(`Could not create sticker batch: ${getErrorMessage(error)}`),
  })

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sticker Batches</h1>
        <p className="text-muted-foreground">Select assets to print barcode/inventory stickers for.</p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {(assetsQuery.data ?? []).map((a) => (
                <TableRow key={a.name}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.has(a.name)}
                      onChange={() => toggle(a.name)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {a.asset_name} ({a.name})
                  </TableCell>
                </TableRow>
              ))}
              {(assetsQuery.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground text-center">
                    No submitted assets found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-56 gap-2">
          <label className="text-sm font-medium">Branch</label>
          <Select value={branch} onValueChange={(v) => setBranch(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a branch…" />
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
        <Button
          type="button"
          disabled={selectedNames.length === 0 || !branch || batchMutation.isPending}
          onClick={() => batchMutation.mutate()}
        >
          {batchMutation.isPending
            ? "Creating…"
            : `Create Sticker Batch${selectedNames.length ? ` (${selectedNames.length})` : ""}`}
        </Button>
      </div>

      <Separator />

      <div className="grid gap-2">
        <h2 className="font-semibold">Previous Batches</h2>
        {batchesQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Branch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(batchesQuery.data ?? []).map((b) => (
                  <TableRow key={b.name}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.batch_datetime}</TableCell>
                    <TableCell>{b.branch}</TableCell>
                  </TableRow>
                ))}
                {(batchesQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      No sticker batches yet.
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
