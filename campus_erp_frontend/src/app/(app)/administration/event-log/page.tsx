"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
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

const EVENT_TYPES = ["Login", "Logout", "Update", "Delete", "Approval"] as const

interface UserRow {
  name: string
  full_name?: string
}

interface EventLogRow {
  timestamp: string
  user: string
  event_type: string
  reference_doctype?: string
  reference_name?: string
  detail?: string
}

/**
 * Bespoke report (doesn't fit Master/Detail, Entry, or ReportScreen's
 * run-on-submit shape): filters live in plain query state rather than a
 * react-hook-form instance, so each filter's queryKey entry refetches
 * campus_erp.api.administration.get_event_log as soon as it changes —
 * closer to a live audit view than a print-and-run report.
 */
export default function EventLogPage() {
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [user, setUser] = useState("")
  const [eventType, setEventType] = useState("")

  const usersQuery = useQuery({
    queryKey: ["User", "list"],
    queryFn: () =>
      frappe.list<UserRow>("User", {
        fields: ["name", "full_name"],
        order_by: "full_name asc",
        limit_page_length: 200,
      }),
  })

  const eventsQuery = useQuery({
    queryKey: [
      "campus_erp.api.administration.get_event_log",
      fromDate,
      toDate,
      user,
      eventType,
    ],
    queryFn: () =>
      frappe.call<EventLogRow[]>("campus_erp.api.administration.get_event_log", {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        user: user || undefined,
        event_type: eventType || undefined,
      }),
  })

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Event Log</h1>
        <p className="text-muted-foreground">
          System activity across every module: logins, updates, deletes, and approvals.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">From Date</label>
          <Input
            type="date"
            className="w-40"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium">To Date</label>
          <Input
            type="date"
            className="w-40"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div className="grid min-w-48 gap-2">
          <label className="text-sm font-medium">User</label>
          <Select value={user} onValueChange={(v) => setUser(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              {(usersQuery.data ?? []).map((u) => (
                <SelectItem key={u.name} value={u.name}>
                  {u.full_name ?? u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-48 gap-2">
          <label className="text-sm font-medium">Event Type</label>
          <Select value={eventType} onValueChange={(v) => setEventType(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All event types" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((et) => (
                <SelectItem key={et} value={et}>
                  {et}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {eventsQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Reference Doctype</TableHead>
                <TableHead>Reference Name</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(eventsQuery.data ?? []).map((row, i) => (
                <TableRow key={`${row.timestamp}-${i}`}>
                  <TableCell>{row.timestamp}</TableCell>
                  <TableCell>{row.user}</TableCell>
                  <TableCell>{row.event_type}</TableCell>
                  <TableCell>{row.reference_doctype ?? ""}</TableCell>
                  <TableCell>{row.reference_name ?? ""}</TableCell>
                  <TableCell>{row.detail ?? ""}</TableCell>
                </TableRow>
              ))}
              {(eventsQuery.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center">
                    No events match these filters.
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
