"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { titleSpec } from "@/lib/forms/library"

export default function LibraryTitlesListPage() {
  return <EntryListScreen spec={titleSpec} basePath="/library/titles" />
}
