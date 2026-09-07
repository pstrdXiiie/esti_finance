"use client"

import { use } from "react"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { guestSpec } from "@/lib/forms/library"

export default function LibraryGuestEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  return (
    <EntryScreen
      spec={guestSpec}
      name={isNew ? undefined : decodeURIComponent(name)}
      basePath="/library/guests"
    />
  )
}
