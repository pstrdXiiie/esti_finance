"use client"

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

interface SessionRow {
  user: string
  full_name?: string
  login_time?: string
  ip_address?: string
}

/**
 * Bespoke report: campus_erp.api.administration.get_active_sessions takes
 * no filters, so this is a plain load-on-mount table rather than a filter
 * panel.
 */
export default function ActiveSessionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["campus_erp.api.administration.get_active_sessions"],
    queryFn: () =>
      frappe.call<SessionRow[]>("campus_erp.api.administration.get_active_sessions"),
  })

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Active Sessions</h1>
        <p className="text-muted-foreground">Users currently logged in.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Login Time</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((row, i) => (
                <TableRow key={`${row.user}-${i}`}>
                  <TableCell>{row.user}</TableCell>
                  <TableCell>{row.full_name ?? ""}</TableCell>
                  <TableCell>{row.login_time ?? ""}</TableCell>
                  <TableCell>{row.ip_address ?? ""}</TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No active sessions.
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
