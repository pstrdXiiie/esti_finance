"use client"

import type { ComponentType, Dispatch, ReactNode, SetStateAction } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { InfoField } from "@/components/sms/InfoField"
import { ApprovalProcessingTable, type ApprovableRow } from "@/components/sms/ApprovalProcessingTable"
import type { RecordViewField } from "@/components/sms/RecordViewDialog"

export interface FieldSpec<Row> {
    label: string
    render: (row: Row) => ReactNode
}

export interface ColumnSpec<Row> {
    header: string
    render: (row: Row) => ReactNode
}

export interface ApprovalTableConfig<Row extends ApprovableRow, Form> {
    title: string
    queryKey: string
    method: string
    emptyMessage?: string

    columns: ColumnSpec<Row>[]
    infoFields: FieldSpec<Row>[]
    /** Omit if this record type has no free-text reason to display. */
    reasonField?: { label?: string; render: (row: Row) => string | null | undefined }

    dialogTitle: (row: Row) => string
    emptyForm: Form

    /** Custom panel between the info grid and the decision fields (e.g. loan-term calculator). */
    MiddleSection?: ComponentType<{ row: Row; form: Form; setForm: Dispatch<SetStateAction<Form>> }>

    renderDecisionFields: (form: Form, setForm: Dispatch<SetStateAction<Form>>) => ReactNode

    approveMethod: string
    rejectMethod: string
    buildApprovePayload: (row: Row, form: Form) => Record<string, unknown>
    buildRejectPayload: (row: Row, form: Form) => Record<string, unknown>

    invalidateKeys: string[]
    approveSuccessMessage?: string
    rejectSuccessMessage?: string
}

/**
 * Generic factory for the "pending X approvals" tables (leaves, loans, overtime, ...).
 * Each concrete table supplies a config describing its columns/fields/payloads;
 * this factory wires it into the shared ApprovalProcessingTable shell.
 */
export function createApprovalTable<Row extends ApprovableRow, Form>(
    config: ApprovalTableConfig<Row, Form>,
) {
    const viewFields: RecordViewField<Row>[] = config.infoFields

    function ReasonPanel({ row }: { row: Row }) {
        if (!config.reasonField) return null
        return (
            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                    {config.reasonField.label ?? "Reason"}
                </Label>
                <Textarea
                    value={config.reasonField.render(row) ?? ""}
                    readOnly
                    rows={2}
                    className="min-h-17.5 resize-none bg-muted/30 focus-visible:ring-0"
                />
            </div>
        )
    }

    function GeneratedApprovalTable() {
        return (
            <ApprovalProcessingTable<Row, Form>
                title={config.title}
                queryKey={config.queryKey}
                method={config.method}
                emptyMessage={config.emptyMessage}
                viewFields={viewFields}
                viewTitle={config.dialogTitle}
                columns={config.columns}
                dialogTitle={config.dialogTitle}
                emptyForm={config.emptyForm}
                renderInfoGrid={(row) => (
                    <>
                        {config.infoFields.map((f) => (
                            <InfoField key={f.label} label={f.label} value={f.render(row) as any} />
                        ))}
                    </>
                )}
                renderReasonPanel={config.reasonField ? (row) => <ReasonPanel row={row} /> : undefined}
                MiddleSection={config.MiddleSection}
                renderDecisionFields={config.renderDecisionFields}
                approveMethod={config.approveMethod}
                rejectMethod={config.rejectMethod}
                buildApprovePayload={config.buildApprovePayload}
                buildRejectPayload={config.buildRejectPayload}
                invalidateKeys={config.invalidateKeys}
                approveSuccessMessage={config.approveSuccessMessage}
                rejectSuccessMessage={config.rejectSuccessMessage}
            />
        )
    }

    GeneratedApprovalTable.displayName = `ApprovalTable(${config.title})`
    return GeneratedApprovalTable
}