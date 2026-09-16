import { ChequeVoucherForm } from "@/components/sms/ChequeVoucherForm"
import { BackLink } from "@/components/sms/BackLink"

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return (
    <div className="grid gap-6">
      <BackLink href="/finance/transactions/cheque_voucher_entry" label="Cheque Voucher Entry" />
      <ChequeVoucherForm
        name={name}
        basePath="/finance/transactions/cheque_voucher_entry"
      />
    </div>
  )
}
