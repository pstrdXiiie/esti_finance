"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { guestSpec } from "@/lib/forms/library"

export default function LibraryGuestsListPage() {
  return <EntryListScreen spec={guestSpec} basePath="/library/guests" />
}
