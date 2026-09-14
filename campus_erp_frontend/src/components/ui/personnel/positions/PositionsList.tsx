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

interface PositionRow {
  name: string
  position_name: string
}

/**
 * Bespoke — SMS Personnel Position is a plain flat master list (one field,
 * no child table, no submittable state), same shape/conventions as
 * PoliciesList.tsx. Selectable from Employees via PositionField in
 * EmployeeWizard.tsx / EmployeeDetailTabs.tsx.
 */
export function PositionsList() {
  const queryClient = useQueryClient()

  const { data: rows, isLoading } = useQuery({
    queryKey: ["SMS Personnel Position", "list"],
    queryFn: () =>
      frappe.list<PositionRow>("SMS Personnel Position", {
        fields: ["name", "position_name"],
        order_by: "position_name asc",
        limit_page_length: 500,
      }),
  })

  const [editingName, setEditingName] = useState<string | null>(null)
  const [positionName, setPositionName] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  function startAdd() {
    setIsAdding(true)
    setEditingName(null)
    setPositionName("")
  }

  function startEdit(row: PositionRow) {
    setIsAdding(false)
    setEditingName(row.name)
    setPositionName(row.position_name)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingName(null)
    setPositionName("")
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editingName
        ? frappe.updateDoc<PositionRow>("SMS Personnel Position", editingName, { position_name: positionName })
        : frappe.createDoc<PositionRow>("SMS Personnel Position", { position_name: positionName }),
    onSuccess: async () => {
      toast.success("Position saved")
      cancelForm()
      await queryClient.invalidateQueries({ queryKey: ["SMS Personnel Position"] })
    },
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => frappe.deleteDoc("SMS Personnel Position", name),
    onSuccess: async (_, name) => {
      toast.success("Position deleted")
      if (editingName === name) cancelForm()
      await queryClient.invalidateQueries({ queryKey: ["SMS Personnel Position"] })
    },
    onError: (error) => toast.error(`Could not delete: ${getErrorMessage(error)}`),
  })

  const isFormOpen = isAdding || !!editingName
  const canSave = isFormOpen && !!positionName && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-border h-full p-7 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Positions</h2>
        <Button type="button" disabled={isAdding} onClick={startAdd}>
          <PlusIcon /> Add
        </Button>
      </div>

      {isFormOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
          <div className="grid gap-1.5">
            <label htmlFor="position-name">Position Name</label>
            <Input
              id="position-name"
              autoFocus
              className="w-64"
              value={positionName}
              onChange={(e) => setPositionName(e.target.value)}
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
              <TableHead>Position Name</TableHead>
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
                  No positions yet. Click Add to create one.
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
                  <TableCell className="font-medium">{row.position_name}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${row.position_name}`}
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