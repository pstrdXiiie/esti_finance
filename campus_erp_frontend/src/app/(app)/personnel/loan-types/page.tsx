"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { loanTypeSpec } from "@/lib/forms/personnel"

export default function LoanTypesPage() {
  return <MasterDetailScreen spec={loanTypeSpec} />
}
