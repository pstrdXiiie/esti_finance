"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { studentSpec } from "@/lib/forms/registrar"

export default function StudentsPage() {
  return <MasterDetailScreen spec={studentSpec} />
}
