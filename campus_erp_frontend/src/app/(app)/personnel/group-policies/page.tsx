"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { groupPolicySpec } from "@/lib/forms/personnel"

export default function GroupPoliciesPage() {
  return <MasterDetailScreen spec={groupPolicySpec} />
}
