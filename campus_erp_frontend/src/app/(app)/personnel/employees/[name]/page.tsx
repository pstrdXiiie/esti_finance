"use client"

import { useParams, useRouter } from "next/navigation"

import { EmployeeWizard } from "@/components/ui/personnel/employees/EmployeeWizard"
import { EmployeeDetailTabs } from "@/components/ui/personnel/employees/EmployeeDetailTabs"

const PERSONNEL_PATH = "/personnel"

export default function EmployeeDetailPage() {
  const params = useParams<{ name: string }>()
  const router = useRouter()
  const isNew = params.name === "new"
  const docName = isNew ? undefined : decodeURIComponent(params.name)

  if (isNew) {
    return (
      <EmployeeWizard
        mode="add"
        onDone={() => router.push(PERSONNEL_PATH)}
      />
    )
  }

  return (
    <EmployeeDetailTabs
      docName={docName!}
      basePath={PERSONNEL_PATH}
    />
  )
}
