"use client"

import { useForm, useWatch } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { loanApplicationSpec } from "@/lib/forms/personnel"
import { PendingApprovalsList } from "@/components/sms/PendingApprovalsList"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import { EmployeeSearchField } from "@/components/ui/personnel/EmployeeSearchField"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const PENDING_STATUSES = ["Pending Recommendation", "Recommended"]

interface LoanApplicationDoc extends Record<string, unknown> {
    name: string
    docstatus: number
    status?: string
}

interface ComputeLoanTermsResult {
    computed_interest: number
    loan_balance: number
    amortization: number
}

interface ApproveLoanApplicationResult {
    employee_loan: string
}

const listColumns = loanApplicationSpec.fields.filter((f) => f.inListView)

/**
 * Pending-queue list for SMS Loan Application (Administration > Approvals >
 * Loan Applications tab). Loan Applications are workflow-driven (the "SMS
 * Loan Application Approval" Workflow), the same shape as Overtime/Travel
 * Orders, so this is just PendingApprovalsList pointed at the spec —
 * clicking a row goes to that record's own Workflow Actions, rendered by
 * LoanApplicationEntry below.
 */
export function LoanApprovalsPanel({
    basePath = "/administration/approvals",
}: {
    basePath?: string
}) {
    return (
        <PendingApprovalsList
            spec={loanApplicationSpec}
            basePath={basePath}
            pendingStatuses={PENDING_STATUSES}
            title="Pending Loan Applications"
        />
    )
}

/**
 * Shared form/workflow/convert-to-loan screen for one SMS Loan Application —
 * rendered from administration/approvals/[name]/page.tsx,
 * personnel/loan-applications/[name]/page.tsx, AND (as of this pass)
 * EmployeeAccount.tsx's "Loans Application" self-service tab, so the
 * Compute Terms / Workflow Actions / Convert-to-Employee-Loan behavior stays
 * in sync everywhere. `basePath` controls where a brand-new application
 * redirects to after its first save, and where the Recent list's rows link.
 *
 * The Recent Loan Applications table below the form is new in this pass —
 * without it, the EmployeeAccount self-service tab (which renders this with
 * no docName) had no way to see anything after submitting, unlike its
 * sibling tabs (Leave, Overtime). Unfiltered top-20 by `modified desc`,
 * matching those siblings' own "recent" queries — none of them filter to
 * the current employee either.
 */
export function LoanApplicationEntry({
    docName,
    basePath = "/personnel/loan-applications",
}: {
    docName?: string
    basePath?: string
}) {
    const queryClient = useQueryClient()
    const router = useRouter()

    const { data: doc, isLoading } = useQuery({
        queryKey: [loanApplicationSpec.doctype, docName],
        queryFn: () => frappe.getDoc<LoanApplicationDoc>(loanApplicationSpec.doctype, docName!),
        enabled: !!docName,
    })

    const transitionsQuery = useQuery({
        queryKey: [loanApplicationSpec.doctype, docName, "transitions"],
        queryFn: () => frappe.getWorkflowTransitions(loanApplicationSpec.doctype, docName!),
        enabled: !!docName,
    })

    const recentQuery = useQuery({
        queryKey: [loanApplicationSpec.doctype, "list"],
        queryFn: () =>
            frappe.list<Record<string, unknown>>(loanApplicationSpec.doctype, {
                fields: ["name", ...loanApplicationSpec.fields.map((f) => f.fieldname)],
                order_by: "modified desc",
                limit_page_length: 20,
            }),
    })

    const form = useForm<Record<string, unknown>>({
        defaultValues: doc ?? {},
        values: doc,
    })

    const saveMutation = useMutation({
        mutationFn: async (values: Record<string, unknown>) =>
            docName
                ? frappe.updateDoc(loanApplicationSpec.doctype, docName, values)
                : frappe.createDoc(loanApplicationSpec.doctype, values),
        onSuccess: (saved) => {
            toast.success(`${loanApplicationSpec.title} saved`)
            queryClient.invalidateQueries({ queryKey: [loanApplicationSpec.doctype] })
            if (!docName) {
                const newName = (saved as { name?: string } | undefined)?.name
                if (newName) {
                    router.push(`${basePath}/${encodeURIComponent(newName)}`)
                }
            }
        },
        onError: (error) =>
            toast.error(`Could not save ${loanApplicationSpec.title}: ${getErrorMessage(error)}`),
    })

    const computeTermsMutation = useMutation({
        mutationFn: (values: { loan_type: string; amount: number; term_months?: number }) =>
            frappe.call<ComputeLoanTermsResult>("campus_erp.api.personnel.compute_loan_terms", values),
        onSuccess: (result) => {
            form.setValue("computed_interest", result.computed_interest)
            form.setValue("loan_balance", result.loan_balance)
            form.setValue("amortization", result.amortization)
            toast.success("Loan terms computed")
        },
        onError: (error) => toast.error(`Could not compute loan terms: ${getErrorMessage(error)}`),
    })

    const convertMutation = useMutation({
        mutationFn: () =>
            frappe.call<ApproveLoanApplicationResult>(
                "campus_erp.api.personnel.approve_loan_application",
                { loan_application: docName }
            ),
        onSuccess: (result) => {
            toast.success(`Converted to Employee Loan ${result.employee_loan}`)
            queryClient.invalidateQueries({ queryKey: [loanApplicationSpec.doctype, docName] })
        },
        onError: (error) =>
            toast.error(`Could not convert loan application: ${getErrorMessage(error)}`),
    })

    const workflowMutation = useMutation({
        mutationFn: (action: string) =>
            frappe.applyWorkflowAction(loanApplicationSpec.doctype, docName!, action),
        onSuccess: (_, action) => {
            toast.success(`${action} applied`)
            queryClient.invalidateQueries({ queryKey: [loanApplicationSpec.doctype, docName] })
            queryClient.invalidateQueries({
                queryKey: [loanApplicationSpec.doctype, docName, "transitions"],
            })
        },
        onError: (error) => toast.error(`Could not apply workflow action: ${getErrorMessage(error)}`),
    })

    const watchedLoanType = useWatch({ control: form.control, name: "loan_type" }) as
        | string
        | undefined
    const watchedAmount = useWatch({ control: form.control, name: "amount" }) as
        | string
        | number
        | undefined
    const watchedTermMonths = useWatch({ control: form.control, name: "term_months" }) as
        | string
        | number
        | undefined
    const canComputeTerms =
        !!watchedLoanType &&
        Number(watchedAmount) > 0 &&
        !!watchedTermMonths &&
        Number(watchedTermMonths) > 0

    if (docName && isLoading) {
        return <Skeleton className="h-96 w-full" />
    }

    return (
        <div className="grid gap-6 w-full">
            <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold mb-5">{loanApplicationSpec.title}</h1>
                {doc?.status && <Badge variant="outline">{doc.status}</Badge>}
            </div>

            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
                    className="grid gap-6"
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {loanApplicationSpec.fields.map((f) =>
                            f.fieldname === "employee" ? (
                                <EmployeeSearchField key={f.fieldname} control={form.control} label={f.label} idPrefix={f.fieldname} />
                            ) : (
                                <DynamicField key={f.fieldname} control={form.control} spec={f} />
                            )
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? "Saving…" : "Save"}
                        </Button>
                        {docName && (
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={!canComputeTerms || computeTermsMutation.isPending}
                                onClick={() =>
                                    computeTermsMutation.mutate({
                                        loan_type: watchedLoanType!,
                                        amount: Number(watchedAmount),
                                        term_months: Number(watchedTermMonths),
                                    })
                                }
                            >
                                {computeTermsMutation.isPending ? "Computing…" : "Compute Terms"}
                            </Button>
                        )}
                    </div>
                </form>
            </Form>

            {docName && (transitionsQuery.data?.length ?? 0) > 0 && (
                <>
                    <Separator />
                    <div className="grid gap-2 rounded-md border p-4">
                        <h2 className="font-semibold">Workflow Actions</h2>
                        <p className="text-sm text-muted-foreground">
                            Moves this application through recommendation and approval per the SMS Loan
                            Application Approval workflow.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {transitionsQuery.data!.map((t) => (
                                <Button
                                    key={t.action}
                                    type="button"
                                    variant="secondary"
                                    disabled={workflowMutation.isPending}
                                    onClick={() => workflowMutation.mutate(t.action)}
                                >
                                    {t.action}
                                </Button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {docName && doc?.docstatus === 1 && doc?.status === "Approved" && (
                <>
                    <Separator />
                    <div className="grid gap-2 rounded-md border p-4">
                        <h2 className="font-semibold">Convert to Employee Loan</h2>
                        <p className="text-sm text-muted-foreground">
                            Creates the real Employee Loan record this application becomes now that it has
                            been approved.
                        </p>
                        <Button
                            type="button"
                            className="w-fit"
                            disabled={convertMutation.isPending || !!convertMutation.data}
                            onClick={() => convertMutation.mutate()}
                        >
                            {convertMutation.isPending ? "Converting…" : "Convert to Employee Loan"}
                        </Button>
                        {convertMutation.data && (
                            <Link
                                href={`/personnel/loans/${encodeURIComponent(convertMutation.data.employee_loan)}`}
                                className="text-sm font-medium hover:underline"
                            >
                                View Employee Loan {convertMutation.data.employee_loan} →
                            </Link>
                        )}
                    </div>
                </>
            )}

            <Separator />
            <div className="w-full">
                <h2 className="text-lg font-semibold mb-3">Recent Loan Applications</h2>
                {recentQuery.isLoading ? (
                    <Skeleton className="h-64 w-full" />
                ) : (
                    <div className="w-full overflow-x-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {listColumns.map((c) => (
                                        <TableHead key={c.fieldname}>{c.label}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(recentQuery.data ?? []).map((row) => (
                                    <TableRow
                                        key={String(row.name)}
                                        className={
                                            docName && String(row.name) === docName
                                                ? "bg-muted/50"
                                                : "cursor-pointer hover:bg-muted/30"
                                        }
                                        onClick={() => {
                                            if (docName && String(row.name) === docName) return
                                            router.push(`${basePath}/${encodeURIComponent(String(row.name))}`)
                                        }}
                                    >
                                        {listColumns.map((c) => (
                                            <TableCell key={c.fieldname}>{String(row[c.fieldname] ?? "")}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                                {(recentQuery.data ?? []).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={listColumns.length} className="text-muted-foreground text-center">
                                            No loan applications yet.
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