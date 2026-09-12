"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { curriculumSpec } from "@/lib/forms/registrar"

export default function CurriculumListPage() {
  return <EntryListScreen spec={curriculumSpec} basePath="/registrar/curriculum" />
}
