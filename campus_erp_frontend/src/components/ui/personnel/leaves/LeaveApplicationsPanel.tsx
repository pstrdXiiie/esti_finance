"use client"

import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { leaveApplicationFields } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"

type LeaveRow = {
    name: string
    personnel_info: string
    employee_id: string
    employee_name: string
    department?: string
    leave_type: string
    from_date: string
    to_date: string
    half_day: number
    reason?: string
    date: string
    status: "Pending" | "Approved" | "Rejected"
    days_approved?: number
    with_pay?: number
    without_pay?: number
    immediate_superior?: string
    hrd_head?: string
}

/**
 * Bespoke — mirrors loan-applications/[name]/page.tsx's reasoning. There is
 * no standalone Leave Application doctype; campus_erp.api.personnel's leave
 * RPCs read/write rows directly on Personnel Info's `leaves` child table
 * (confirmed via campus_erp/api/personnel.py), so this can't be a generic
 * EntrySpec/EntryListScreen the way Loan Applications is.
 *
 * Layout follows registrar/enrollment/pre-enrollment.tsx's pattern: fields
 * on top in a bordered panel, Submit inline (no dialog), table of existing
 * records underneath.
 *
 * Submission + status view only. Approve/Reject stay in
 * LeaveApprovalsPanel.tsx (Personnel > Approvals tab) — unchanged by this
 * layout pass, same split as before.
 */
export function LeaveApplicationsPanel() {
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery<LeaveRow[]>({
        queryKey: ["personnel-leaves", "recent"],
        queryFn: () => frappe.call("campus_erp.api.personnel.list_recent_leaves", {}),
    })

    const form = useForm<Record<string, unknown>>({ defaultValues: {} })

    const addMutation = useMutation({
        mutationFn: (values: Record<string, unknown>) =>
            frappe.call("campus_erp.api.personnel.add_leave_application", values),
        onSuccess: () => {
            toast.success("Leave application submitted")
            queryClient.invalidateQueries({ queryKey: ["personnel-leaves"] })
            form.reset({})
        },
        onError: (error) =>
            toast.error(`Could not submit leave application: ${getErrorMessage(error)}`),
    })

    return (
        <div className="grid gap-6 w-full">
            <div className="w-full rounded-2xl border border-border p-7">
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}
                        className="grid gap-5"
                    >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {leaveApplicationFields.map((f) => (
                                <DynamicField key={f.fieldname} control={form.control} spec={f} />
                            ))}
                        </div>
                        <Button type="submit" className="w-fit" disabled={addMutation.isPending}>
                            {addMutation.isPending ? "Submitting…" : "Submit"}
                        </Button>
                    </form>
                </Form>
            </div>

            <div className="w-full">
                <h2 className="text-lg font-semibold mb-3">Recent Leave Applications</h2>
                {isLoading ? (
                    <Skeleton className="h-64 w-full" />
                ) : (
                    <div className="w-full overflow-x-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>From</TableHead>
                                    <TableHead>To</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Days Approved</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(data ?? []).map((row) => (
                                    <TableRow key={row.name}>
                                        <TableCell>{row.employee_name}</TableCell>
                                        <TableCell>{row.leave_type}</TableCell>
                                        <TableCell>{row.from_date}</TableCell>
                                        <TableCell>{row.to_date}</TableCell>
                                        <TableCell>{row.status}</TableCell>
                                        <TableCell>{row.days_approved ?? "—"}</TableCell>
                                    </TableRow>
                                ))}
                                {(data ?? []).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-muted-foreground text-center">
                                            No leave applications yet.
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
