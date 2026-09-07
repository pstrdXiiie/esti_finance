"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { policySpec } from "@/lib/forms/personnel"

export default function PoliciesPage() {
  return <MasterDetailScreen spec={policySpec} />
}
