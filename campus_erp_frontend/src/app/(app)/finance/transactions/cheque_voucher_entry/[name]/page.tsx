import { ChequeVoucherForm } from "@/components/sms/ChequeVoucherForm"

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  return (
    <ChequeVoucherForm
      name={name}
      basePath="/finance/transactions/cheque_voucher_entry"
    />
  )
}
