"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { permitSpec } from "@/lib/forms/registrar"

export default function PermitsListPage() {
  return <EntryListScreen spec={permitSpec} basePath="/registrar/permits" />
}
