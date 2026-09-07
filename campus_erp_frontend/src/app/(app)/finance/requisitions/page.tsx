"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { requisitionSpec } from "@/lib/forms/purchasing"

export default function RequisitionsListPage() {
  return <EntryListScreen spec={requisitionSpec} basePath="/finance/requisitions" />
}
