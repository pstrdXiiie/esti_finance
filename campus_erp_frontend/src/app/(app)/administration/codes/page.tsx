"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { smsCodeSpec } from "@/lib/forms/administration"

export default function CodesPage() {
  return <MasterDetailScreen spec={smsCodeSpec} />
}
