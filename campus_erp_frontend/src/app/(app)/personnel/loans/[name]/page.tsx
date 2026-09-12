"use client"

import { use } from "react"
import { useSearchParams } from "next/navigation"

import { EmployeeBenefitEntry } from "@/components/ui/personnel/EmployeeBenefitEntry"

/**
 * Thin route wrapper — same convention as personnel/loans/[name]/page.tsx
 * (LoanApplicationsPanel). This route had fallen behind: it was still
 * rendering the generic EntryScreen directly with its own duplicated
 * BenefitBalanceCard/BenefitSubmitPanel logic, even though
 * EmployeeBenefitEntry.tsx already has both built in.
 *
 * Also reads an optional `?employee=<Personnel Info docname>` query param
 * so navigating here from an employee's own Benefits tab ("Add Benefit")
 * can pre-select that employee on a brand-new record instead of landing
 * on a blank form.
 */
export default function EmployeeBenefitEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  const searchParams = useSearchParams()
  const prefillEmployee = isNew ? searchParams.get("employee") ?? undefined : undefined

  return <EmployeeBenefitEntry docName={docName} defaultEmployee={prefillEmployee} />
}