// src/app/(app)/personnel/loan-applications/[name]/page.tsx
"use client"

import { use } from "react"

import { LoanApplicationEntry } from "@/components/ui/administration/approvals/LoanApprovalsPanel"

/**
 * Thin route wrapper — same convention as
 * administration/approvals/[name]/page.tsx. The form/workflow/convert-to-loan
 * logic lives in the shared LoanApplicationEntry component so both routes
 * stay in sync; only basePath differs (new applications created from here
 * redirect back into Personnel, not Administration > Approvals).
 */
export default function LoanApplicationEntryPage({
    params,
}: {
    params: Promise<{ name: string }>
}) {
    const { name } = use(params)
    const isNew = name === "new"
    return (
        <LoanApplicationEntry
            docName={isNew ? undefined : decodeURIComponent(name)}
            basePath="/personnel/loan-applications"
        />
    )
}