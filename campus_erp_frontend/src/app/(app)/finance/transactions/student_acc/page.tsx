"use client"

import { EntryListScreen } from "@/components/sms/EntryListScreen"
import { assessmentSpec } from "@/lib/forms/finance"

/**
 * "Student Accounts" now just points at the real SMS Student Assessment
 * ledger instead of the disconnected, always-empty SMS Student Account
 * doctype it used to render (no backend wiring ever fed it, and its
 * breadcrumb resolver even pointed at a nonexistent "SMS Student" doctype --
 * see git history). Rows link into the same assessment detail screen
 * finance/assessments uses, so opening one here can actually record a
 * payment or view GL status, not just show a stale hand-typed balance.
 */
export default function StudentAccountsListPage() {
  return <EntryListScreen spec={assessmentSpec} basePath="/finance/assessments" allowDelete />
}
