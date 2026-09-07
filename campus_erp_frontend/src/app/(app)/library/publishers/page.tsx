"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { publisherSpec } from "@/lib/forms/library"

export default function LibraryPublishersPage() {
  return <MasterDetailScreen spec={publisherSpec} />
}
