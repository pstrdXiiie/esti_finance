"use client"

import { VoucherEntryForm } from "@/components/finance/VoucherEntryForm"
import type { ChildTableSpec } from "@/lib/forms/types"

const accountsChildSpec: ChildTableSpec = {
  doctype: "SMS Journal Voucher Entry",
  columns: [
    { fieldname: "account", label: "Account", fieldtype: "Link", options: "Account" },
    { fieldname: "account_name", label: "Account Name", fieldtype: "Data", readOnly: true },
    { fieldname: "debit", label: "Debit", fieldtype: "Currency" },
    { fieldname: "credit", label: "Credit", fieldtype: "Currency" },
  ],
  fieldname: ""
}

export default function JournalVoucherEntryPage() {
  return (
    <VoucherEntryForm
      title="Journal Voucher"
      description="Record a manual journal entry."
      docLabel="JV#"
      namingSeriesOptions={["JV-.YYYY.-", "JV-MANUAL-"]}
      childSpec={accountsChildSpec}
      saveLabel="Save Journal Voucher"
      parentDoctype="SMS Journal Voucher"
      totalCreditFieldname="total_currcy"
    />
  )
}