"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { frappe } from "@/lib/frappe"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { RecordViewDialog, type RecordViewField } from "@/components/sms/RecordViewDialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export interface SearchTableColumn<T> {
    header: string
    render: (row: T) => React.ReactNode
}

export interface SearchTableProps<T> {
    title?: string
    searchPlaceholder?: string
    queryKey: string
    method: string
    searchParamName?: string
    extraParams?: Record<string, unknown>
    columns: SearchTableColumn<T>[]
    emptyMessage?: string
    rowKey?: (row: T, index: number) => string | number
    viewFields?: RecordViewField<T>[]
    viewTitle?: (row: T) => string
}

export function SearchTable<T>({
    title,
    searchPlaceholder = "Search...",
    queryKey,
    method,
    searchParamName = "search",
    extraParams,
    columns,
    emptyMessage = "No records found.",
    rowKey,
    viewFields,
    viewTitle,
}: SearchTableProps<T>) {
    const [search, setSearch] = useState("")
    const [selected, setSelected] = useState<T | null>(null)

    const { data: rows, isLoading, isError, error } = useQuery({
        queryKey: [queryKey, search, extraParams],
        queryFn: async () => {
            const res = await frappe.call(method, {
                [searchParamName]: search,
                ...extraParams,
            })
            return res as T[]
        },
    })

    // Always render the same header row across loading/error/empty/data
    // states — matching the shared Table components used everywhere else
    // (EmployeesList, DepartmentMaintenance, etc.) instead of the old
    // bare <table> that only appeared once rows.length > 0.
    const colSpan = columns.length

    return (
        <div className="space-y-3 pt-6">
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
            />

            <div className="overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((col) => (
                                <TableHead key={col.header}>{col.header}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={colSpan}>
                                    <Skeleton className="h-24 w-full" />
                                </TableCell>
                            </TableRow>
                        ) : isError ? (
                            <TableRow>
                                <TableCell
                                    colSpan={colSpan}
                                    className="text-center text-destructive"
                                >
                                    Something went wrong loading results
                                    {error instanceof Error ? `: ${error.message}` : "."}
                                </TableCell>
                            </TableRow>
                        ) : rows && rows.length > 0 ? (
                            rows.map((row, i) => (
                                <TableRow
                                    key={rowKey ? rowKey(row, i) : i}
                                    className={cn(viewFields && "cursor-pointer")}
                                    onClick={viewFields ? () => setSelected(row) : undefined}
                                >
                                    {columns.map((col) => (
                                        <TableCell key={col.header}>{col.render(row)}</TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={colSpan}
                                    className="text-center text-muted-foreground"
                                >
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {viewFields ? (
                <RecordViewDialog<T>
                    open={selected !== null}
                    onOpenChange={(open) => {
                        if (!open) setSelected(null)
                    }}
                    row={selected}
                    fields={viewFields}
                    title={selected && viewTitle ? viewTitle(selected) : title}
                />
            ) : null}
        </div>
    )
}