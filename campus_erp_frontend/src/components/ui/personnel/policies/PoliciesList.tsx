"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon } from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PolicyRow {
  name: string
  policy_name: string
}

/**
 * Bespoke — SMS Policy is a plain flat master list (one field, no child
 * table, no submittable state), so this mirrors
 * finance/maintenance/codes-and-fees/codes-and-fees.tsx's conventions
 * (own useQuery/useMutation straight against frappe, inline add/edit, no
 * dialog) but without the header/detail split codes-and-fees needs — just
 * a form panel above the list.
 */
export function PoliciesList() {
  const queryClient = useQueryClient()

  const { data: rows, isLoading } = useQuery({
    queryKey: ["SMS Policy", "list"],
    queryFn: () =>
      frappe.list<PolicyRow>("SMS Policy", {
        fields: ["name", "policy_name"],
        order_by: "policy_name asc",
        limit_page_length: 500,
      }),
  })

  const [editingName, setEditingName] = useState<string | null>(null)
  const [policyName, setPolicyName] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  function startAdd() {
    setIsAdding(true)
    setEditingName(null)
    setPolicyName("")
  }

  function startEdit(row: PolicyRow) {
    setIsAdding(false)
    setEditingName(row.name)
    setPolicyName(row.policy_name)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingName(null)
    setPolicyName("")
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editingName
        ? frappe.updateDoc<PolicyRow>("SMS Policy", editingName, { policy_name: policyName })
        : frappe.createDoc<PolicyRow>("SMS Policy", { policy_name: policyName }),
    onSuccess: async () => {
      toast.success("Policy saved")
      cancelForm()
      await queryClient.invalidateQueries({ queryKey: ["SMS Policy"] })
    },
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => frappe.deleteDoc("SMS Policy", name),
    onSuccess: async (_, name) => {
      toast.success("Policy deleted")
      if (editingName === name) cancelForm()
      await queryClient.invalidateQueries({ queryKey: ["SMS Policy"] })
    },
    onError: (error) => toast.error(`Could not delete: ${getErrorMessage(error)}`),
  })

  const isFormOpen = isAdding || !!editingName
  const canSave = isFormOpen && !!policyName && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-black/20 h-full p-7 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Policies</h2>
        <Button type="button" disabled={isAdding} onClick={startAdd}>
          <PlusIcon /> Add
        </Button>
      </div>

      {isFormOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
          <div className="grid gap-1.5">
            <label htmlFor="policy-name">Policy Name</label>
            <Input
              id="policy-name"
              autoFocus
              className="w-64"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
            />
          </div>
          <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : editingName ? "Update" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={cancelForm}>
            Cancel
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy Name</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground text-center">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground text-center">
                  No policies yet. Click Add to create one.
                </TableCell>
              </TableRow>
            ) : (
              (rows ?? []).map((row) => (
                <TableRow
                  key={row.name}
                  className="cursor-pointer"
                  data-state={editingName === row.name ? "selected" : undefined}
                  onClick={() => startEdit(row)}
                >
                  <TableCell className="font-medium">{row.policy_name}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${row.policy_name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteMutation.mutate(row.name)
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
