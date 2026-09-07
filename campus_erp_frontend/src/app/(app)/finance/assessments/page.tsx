"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { assessmentSpec } from "@/lib/forms/finance"

export default function AssessmentsListPage() {
  return <EntryListScreen spec={assessmentSpec} basePath="/finance/assessments" />
}
