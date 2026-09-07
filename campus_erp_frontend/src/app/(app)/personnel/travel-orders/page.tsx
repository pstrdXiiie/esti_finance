"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { travelOrderSpec } from "@/lib/forms/personnel"

export default function TravelOrdersListPage() {
  return <EntryListScreen spec={travelOrderSpec} basePath="/personnel/travel-orders" />
}
