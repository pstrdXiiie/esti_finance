"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PlusIcon, Trash2Icon } from "lucide-react"

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

const EMPLOYMENT_STATUSES = ["Regular", "Contractual", "Part Timer"]

interface GroupPolicyRow {
  name: string
  employment_status: string
  policy: string
}

interface PolicyOption {
  name: string
  policy_name: string
}

/**
 * Bespoke — SMS Group Policy is a plain flat master list (Select +
 * Link-to-SMS-Policy, no child table, no submittable state). Same
 * conventions as PoliciesList.tsx / codes-and-fees.tsx; the Link field is
 * rendered as a Select of SMS Policy records instead of a raw text input.
 */
export function GroupPoliciesList() {
  const queryClient = useQueryClient()

  const { data: rows, isLoading } = useQuery({
    queryKey: ["SMS Group Policy", "list"],
    queryFn: () =>
      frappe.list<GroupPolicyRow>("SMS Group Policy", {
        fields: ["name", "employment_status", "policy"],
        order_by: "employment_status asc",
        limit_page_length: 500,
      }),
  })

  const { data: policyOptions } = useQuery({
    queryKey: ["SMS Policy", "options"],
    queryFn: () =>
      frappe.list<PolicyOption>("SMS Policy", {
        fields: ["name", "policy_name"],
        order_by: "policy_name asc",
        limit_page_length: 500,
      }),
  })

  const [editingName, setEditingName] = useState<string | null>(null)
  const [employmentStatus, setEmploymentStatus] = useState("")
  const [policy, setPolicy] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  function startAdd() {
    setIsAdding(true)
    setEditingName(null)
    setEmploymentStatus("")
    setPolicy("")
  }

  function startEdit(row: GroupPolicyRow) {
    setIsAdding(false)
    setEditingName(row.name)
    setEmploymentStatus(row.employment_status)
    setPolicy(row.policy)
  }

  function cancelForm() {
    setIsAdding(false)
    setEditingName(null)
    setEmploymentStatus("")
    setPolicy("")
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { employment_status: employmentStatus, policy }
      return editingName
        ? frappe.updateDoc<GroupPolicyRow>("SMS Group Policy", editingName, payload)
        : frappe.createDoc<GroupPolicyRow>("SMS Group Policy", payload)
    },
    onSuccess: async () => {
      toast.success("Group Policy saved")
      cancelForm()
      await queryClient.invalidateQueries({ queryKey: ["SMS Group Policy"] })
    },
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => frappe.deleteDoc("SMS Group Policy", name),
    onSuccess: async (_, name) => {
      toast.success("Group Policy deleted")
      if (editingName === name) cancelForm()
      await queryClient.invalidateQueries({ queryKey: ["SMS Group Policy"] })
    },
    onError: (error) => toast.error(`Could not delete: ${getErrorMessage(error)}`),
  })

  function policyLabel(name: string) {
    return policyOptions?.find((p) => p.name === name)?.policy_name ?? name
  }

  const isFormOpen = isAdding || !!editingName
  const canSave = isFormOpen && !!employmentStatus && !!policy && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-border h-full p-7 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Group Policies</h2>
        <Button type="button" disabled={isAdding} onClick={startAdd}>
          <PlusIcon /> Add
        </Button>
      </div>

      {isFormOpen && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
          <div className="grid gap-1.5">
            <label htmlFor="group-policy-status">Employment Status</label>
            <Select value={employmentStatus} onValueChange={(v) => v && setEmploymentStatus(v)}>
              <SelectTrigger id="group-policy-status" className="w-48">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_STATUSES.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="group-policy-policy">Policy</label>
            <Select value={policy} onValueChange={(v) => v && setPolicy(v)}>
              <SelectTrigger id="group-policy-policy" className="w-56">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {(policyOptions ?? []).map((opt) => (
                  <SelectItem key={opt.name} value={opt.name}>
                    {opt.policy_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <TableHead>Employment Status</TableHead>
              <TableHead>Policy</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  No group policies yet. Click Add to create one.
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
                  <TableCell className="font-medium">{row.employment_status}</TableCell>
                  <TableCell>{policyLabel(row.policy)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${row.employment_status}`}
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
