"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { assetSpec } from "@/lib/forms/asset"

export default function AssetRegisterListPage() {
  return <EntryListScreen spec={assetSpec} basePath="/asset/register" />
}
