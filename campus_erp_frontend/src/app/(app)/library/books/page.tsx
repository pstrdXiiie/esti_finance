"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { bookSpec } from "@/lib/forms/library"

export default function LibraryBooksListPage() {
  return <EntryListScreen spec={bookSpec} basePath="/library/books" />
}
