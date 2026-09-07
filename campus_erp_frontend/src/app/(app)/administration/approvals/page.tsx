"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface PendingApprovalRow {
  doctype: string
  name: string
  status: string
  employee: string
  creation: string
}

const DETAIL_BASE_PATH: Record<string, string> = {
  "SMS Loan Application": "/personnel/loan-applications",
  "SMS Overtime": "/personnel/overtime",
  "SMS Travel Order": "/personnel/travel-orders",
}

/**
 * Triage/navigation view only — the Recommend/Approve/Reject buttons that
 * actually move a record live on that record's own detail page (its
 * Workflow Actions section), since a valid action there depends on the
 * current user and the doc's current state, not on this list.
 */
export default function PendingApprovalsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["administration", "pending-approvals"],
    queryFn: () =>
      frappe.call<PendingApprovalRow[]>("campus_erp.api.administration.get_pending_approvals"),
  })

  const rows = data ?? []

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Pending Approvals</h1>
        <p className="text-muted-foreground">
          Loan applications, overtime, and travel orders awaiting your recommendation or
          approval.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctype</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Creation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.doctype}-${row.name}`}>
                  <TableCell>{row.doctype}</TableCell>
                  <TableCell>
                    <Link
                      href={`${DETAIL_BASE_PATH[row.doctype]}/${encodeURIComponent(row.name)}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.employee}</TableCell>
                  <TableCell>{row.creation}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    Nothing pending on you right now.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
