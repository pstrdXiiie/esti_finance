"use client"

import { use } from "react"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { titleSpec } from "@/lib/forms/library"

export default function LibraryTitleEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  return (
    <EntryScreen
      spec={titleSpec}
      name={isNew ? undefined : decodeURIComponent(name)}
      basePath="/library/titles"
    />
  )
}
