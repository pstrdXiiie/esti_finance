"use client"

import { ReportScreen } from "@/components/sms/ReportScreen"
import { trialBalanceSpec } from "@/lib/forms/reports"

export default function TrialBalancePage() {
  return <ReportScreen spec={trialBalanceSpec} />
}
