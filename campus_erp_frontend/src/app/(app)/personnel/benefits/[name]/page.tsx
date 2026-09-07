"use client"

import { use } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { EntryScreen } from "@/components/sms/EntryScreen"
import { employeeBenefitSpec } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface EmployeeBenefitDoc {
  name: string
  docstatus: number
  employee?: string
}

interface BenefitBalance {
  available_fund?: number
  consumed_fund?: number
}

export default function EmployeeBenefitEntryPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = use(params)
  const isNew = name === "new"
  const docName = isNew ? undefined : decodeURIComponent(name)

  return (
    <div className="grid gap-6">
      {docName && <BenefitBalanceCard name={docName} />}
      <EntryScreen spec={employeeBenefitSpec} name={docName} basePath="/personnel/benefits" />
      {docName && <BenefitSubmitPanel name={docName} />}
    </div>
  )
}

/**
 * Read-only summary above the form: the employee's current benefit-fund
 * balance, fetched from campus_erp.api.personnel_payroll.get_employee_benefit_balance
 * once the document (and therefore its Employee) has loaded. Shares the same
 * [doctype, name] query key EntryScreen uses internally for its own `doc`
 * fetch, so this is a free ride on react-query's cache rather than a
 * duplicate request — same reasoning as finance/assessments' AssessmentActions.
 */
function BenefitBalanceCard({ name }: { name: string }) {
  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: [employeeBenefitSpec.doctype, name],
    queryFn: () => frappe.getDoc<EmployeeBenefitDoc>(employeeBenefitSpec.doctype, name),
  })

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["employee-benefit-balance", doc?.employee],
    queryFn: () =>
      frappe.call<BenefitBalance>(
        "campus_erp.api.personnel_payroll.get_employee_benefit_balance",
        { employee: doc?.employee }
      ),
    enabled: !!doc?.employee,
  })

  if (docLoading) {
    return <Skeleton className="h-16 w-full" />
  }
  if (!doc?.employee) {
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-4 rounded-md border p-4 sm:max-w-sm">
      <div>
        <p className="text-sm text-muted-foreground">Available Fund</p>
        <p className="text-lg font-semibold">
          {balanceLoading ? "…" : (balance?.available_fund ?? 0)}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Consumed Fund</p>
        <p className="text-lg font-semibold">
          {balanceLoading ? "…" : (balance?.consumed_fund ?? 0)}
        </p>
      </div>
    </div>
  )
}

/**
 * Bespoke Submit panel alongside the generic EntryScreen — same
 * docstatus-0-to-1 pattern as finance/assessments/[name] and
 * finance/canteen-pcv/[name].
 */
function BenefitSubmitPanel({ name }: { name: string }) {
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery({
    queryKey: [employeeBenefitSpec.doctype, name],
    queryFn: () => frappe.getDoc<EmployeeBenefitDoc>(employeeBenefitSpec.doctype, name),
  })

  const submitMutation = useMutation({
    mutationFn: () => frappe.updateDoc(employeeBenefitSpec.doctype, name, { docstatus: 1 }),
    onSuccess: () => {
      toast.success("Employee benefit submitted")
      queryClient.invalidateQueries({ queryKey: [employeeBenefitSpec.doctype, name] })
    },
    onError: (error) => toast.error(`Could not submit employee benefit: ${getErrorMessage(error)}`),
  })

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }
  if (!doc || doc.docstatus !== 0) {
    return null
  }

  return (
    <>
      <Separator />
      <div className="grid gap-2 rounded-md border p-4">
        <h2 className="font-semibold">Submit Employee Benefit</h2>
        <p className="text-sm text-muted-foreground">
          Submitting locks this benefit record against further edits.
        </p>
        <Button
          type="button"
          className="w-fit"
          disabled={submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </>
  )
}
