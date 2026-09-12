"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import type { EntrySpec } from "@/lib/forms/types"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Pending-approvals queue for a workflow-driven EntrySpec doctype (Loan
 * Applications, Overtime, Travel Orders, ...). Doesn't do any approve/
 * reject itself — that already lives on each record's own detail page via
 * getWorkflowTransitions/applyWorkflowAction (see LoanApplicationEntry.tsx,
 * OvertimeEntry.tsx, TravelOrderEntry.tsx's Workflow Actions panels). This
 * is purely a filtered list of "not yet finished" records so an approver
 * doesn't have to browse the full list to find what needs their attention;
 * clicking a row goes straight to that record's own Workflow Actions.
 *
 * The search box filters client-side across whatever list columns the spec
 * already shows (employee, status, dates, etc.) — the dataset here is
 * already small (one doctype's pending queue), so no server round trip is
 * needed. Same reusable-across-specs shape as the rest of this component:
 * one search box works for Loan Applications, Overtime, and Travel Orders
 * without any per-doctype wiring.
 */
export function PendingApprovalsList({
    spec,
    basePath,
    pendingStatuses,
    title,
}: {
    spec: EntrySpec
    basePath: string
    /** Status values considered "still pending" — everything else is excluded. */
    pendingStatuses: string[]
    title?: string
}) {
    const [search, setSearch] = useState("")

    const listColumns = spec.fields.filter((f) => f.inListView)
    const columns = listColumns.length ? listColumns : spec.fields.slice(0, 4)

    const { data, isLoading } = useQuery({
        queryKey: [spec.doctype, "pending", pendingStatuses],
        queryFn: () =>
            frappe.list(spec.doctype, {
                filters: [["status", "in", pendingStatuses]],
                fields: ["name", ...spec.fields.map((f) => f.fieldname)],
                order_by: "modified desc",
                limit_page_length: 100,
            }),
    })

    const rows = data ?? []
    const trimmedSearch = search.trim().toLowerCase()
    const filteredRows = trimmedSearch
        ? rows.filter((row) =>
            columns.some((c) =>
                String(row[c.fieldname] ?? "").toLowerCase().includes(trimmedSearch)
            )
        )
        : rows

    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{title ?? `Pending ${spec.title}`}</h2>
                <Input
                    placeholder={`Search ${spec.title.toLowerCase()}…`}
                    className="max-w-xs"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            {isLoading ? (
                <Skeleton className="h-48 w-full" />
            ) : (
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map((c) => (
                                    <TableHead key={c.fieldname}>{c.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRows.map((row) => (
                                <TableRow key={String(row.name)}>
                                    {columns.map((c, i) => {
                                        const value =
                                            c.fieldname === "status" ? (
                                                <Badge variant="outline">{String(row[c.fieldname] ?? "")}</Badge>
                                            ) : (
                                                String(row[c.fieldname] ?? row.name)
                                            )
                                        return (
                                            <TableCell key={c.fieldname}>
                                                {i === 0 ? (
                                                    <Link
                                                        href={`${basePath}/${encodeURIComponent(String(row.name))}`}
                                                        className="font-medium hover:underline"
                                                    >
                                                        {value}
                                                    </Link>
                                                ) : (
                                                    value
                                                )}
                                            </TableCell>
                                        )
                                    })}
                                </TableRow>
                            ))}
                            {filteredRows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="text-muted-foreground text-center">
                                        {trimmedSearch ? "No matches for this search." : "Nothing pending."}
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