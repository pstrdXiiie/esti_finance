"use client"

import { ReportScreen } from "@/components/sms/ReportScreen"
import { BackLink } from "@/components/sms/BackLink"
import { trialBalanceSpec } from "@/lib/forms/reports"

export default function TrialBalancePage() {
  return (
    <div className="grid gap-6">
      <BackLink href="/finance/financialreport" label="Financial Reports" />
      <ReportScreen spec={trialBalanceSpec} />
    </div>
  )
}
