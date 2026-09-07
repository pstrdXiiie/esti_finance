"use client"

import { MasterDetailScreen } from "@/components/sms/MasterDetailScreen"
import { assetModelSpec } from "@/lib/forms/asset"

export default function AssetModelsPage() {
  return <MasterDetailScreen spec={assetModelSpec} />
}
