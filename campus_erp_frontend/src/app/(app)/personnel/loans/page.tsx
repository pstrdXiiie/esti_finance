"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { employeeLoanSpec } from "@/lib/forms/personnel"

export default function EmployeeLoansListPage() {
  return <EntryListScreen spec={employeeLoanSpec} basePath="/personnel/loans" />
}
