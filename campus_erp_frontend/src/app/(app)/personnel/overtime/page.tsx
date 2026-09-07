"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { overtimeSpec } from "@/lib/forms/personnel"

export default function OvertimeListPage() {
  return <EntryListScreen spec={overtimeSpec} basePath="/personnel/overtime" />
}
