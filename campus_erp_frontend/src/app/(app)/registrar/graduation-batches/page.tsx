"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { graduationBatchSpec } from "@/lib/forms/registrar"

export default function GraduationBatchesPage() {
  return <MasterDetailScreen spec={graduationBatchSpec} />
}
