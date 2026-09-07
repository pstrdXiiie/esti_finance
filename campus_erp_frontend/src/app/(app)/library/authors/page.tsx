"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { authorSpec } from "@/lib/forms/library"

export default function LibraryAuthorsPage() {
  return <MasterDetailScreen spec={authorSpec} />
}
