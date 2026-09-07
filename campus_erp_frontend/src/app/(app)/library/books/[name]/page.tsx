"use client"

import { use } from "react"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { bookSpec } from "@/lib/forms/library"

export default function LibraryBookEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  return (
    <EntryScreen
      spec={bookSpec}
      name={isNew ? undefined : decodeURIComponent(name)}
      basePath="/library/books"
    />
  )
}
