"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { discountSpec } from "@/lib/forms/finance"

export default function DiscountsPage() {
  return <MasterDetailScreen spec={discountSpec} />
}
