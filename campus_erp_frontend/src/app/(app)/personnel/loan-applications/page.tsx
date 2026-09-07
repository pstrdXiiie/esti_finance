"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { loanApplicationSpec } from "@/lib/forms/personnel"

export default function LoanApplicationsListPage() {
  return <EntryListScreen spec={loanApplicationSpec} basePath="/personnel/loan-applications" />
}
