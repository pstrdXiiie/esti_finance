"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { statutoryBracketSpec } from "@/lib/forms/administration"

export default function StatutoryBracketsPage() {
  return <MasterDetailScreen spec={statutoryBracketSpec} />
}
