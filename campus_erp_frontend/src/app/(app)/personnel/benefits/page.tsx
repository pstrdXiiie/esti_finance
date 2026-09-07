"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { employeeBenefitSpec } from "@/lib/forms/personnel"

export default function EmployeeBenefitsListPage() {
  return <EntryListScreen spec={employeeBenefitSpec} basePath="/personnel/benefits" />
}
