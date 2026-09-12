"use client"

import { use } from "react"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { curriculumSpec } from "@/lib/forms/registrar"

export default function CurriculumEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  return (
    <EntryScreen
      spec={curriculumSpec}
      name={isNew ? undefined : decodeURIComponent(name)}
      basePath="/registrar/curriculum"
    />
  )
}
