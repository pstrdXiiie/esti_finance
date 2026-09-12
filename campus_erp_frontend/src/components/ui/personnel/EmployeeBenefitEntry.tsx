"use client"

import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { employeeBenefitSpec } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import { EmployeeSearchField } from "@/components/ui/personnel/EmployeeSearchField"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface EmployeeBenefitDoc extends Record<string, unknown> {
  name: string
  docstatus: number
  employee?: string
}

interface BenefitBalance {
  available_fund?: number
  consumed_fund?: number
}

const listColumns = employeeBenefitSpec.fields.filter((f) => f.inListView)

/**
 * Bespoke — replaces the generic EntryScreen. BenefitBalanceCard and
 * BenefitSubmitPanel are moved over unchanged from the old
 * personnel/benefits/[name]/page.tsx: submitting a benefit is a raw
 * docstatus 0→1 field update (no Workflow doctype here, unlike Travel
 * Orders/Overtime), and the balance card is a free ride on the same
 * [doctype, name] query key this component's own `doc` fetch uses.
 *
 * Same docName-optional pattern as LoanApplicationEntry.tsx.
 *
 * `defaultEmployee` pre-selects the Employee field on a brand-new record
 * (docName undefined) — used when navigating here from an employee's own
 * Benefits tab, so "Add Benefit" doesn't land on a blank form. Ignored
 * once `doc` loads for an existing record (docName set); `doc` always wins.
 */
export function EmployeeBenefitEntry({
  docName,
  defaultEmployee,
}: {
  docName?: string
  defaultEmployee?: string
}) {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: doc, isLoading } = useQuery({
    queryKey: [employeeBenefitSpec.doctype, docName],
    queryFn: () => frappe.getDoc<EmployeeBenefitDoc>(employeeBenefitSpec.doctype, docName!),
    enabled: !!docName,
  })

  const recentQuery = useQuery({
    queryKey: [employeeBenefitSpec.doctype, "list"],
    queryFn: () =>
      frappe.list<Record<string, unknown>>(employeeBenefitSpec.doctype, {
        fields: ["name", ...employeeBenefitSpec.fields.map((f) => f.fieldname)],
        order_by: "modified desc",
        limit_page_length: 20,
      }),
  })

  const form = useForm<Record<string, unknown>>({
    defaultValues: doc ?? (defaultEmployee ? { employee: defaultEmployee } : {}),
    values: doc,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      docName
        ? frappe.updateDoc(employeeBenefitSpec.doctype, docName, values)
        : frappe.createDoc(employeeBenefitSpec.doctype, values),
    onSuccess: (saved) => {
      toast.success(`${employeeBenefitSpec.title} saved`)
      queryClient.invalidateQueries({ queryKey: [employeeBenefitSpec.doctype] })
      if (!docName) {
        const newName = (saved as { name?: string } | undefined)?.name
        if (newName) {
          router.push(`/personnel/benefits/${encodeURIComponent(newName)}`)
        }
      }
    },
    onError: (error) =>
      toast.error(`Could not save ${employeeBenefitSpec.title}: ${getErrorMessage(error)}`),
  })

  if (docName && isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <div className="grid gap-6 w-full">
      <div className="w-full rounded-2xl border border-border p-7">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold">{employeeBenefitSpec.title}</h1>
          {doc && <Badge variant="outline">{doc.docstatus === 1 ? "Submitted" : "Draft"}</Badge>}
        </div>

        {docName && <BenefitBalanceCard name={docName} />}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            className="grid gap-6 mt-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {employeeBenefitSpec.fields.map((f) =>
                f.fieldname === "employee" ? (
                  <EmployeeSearchField key={f.fieldname} control={form.control} label={f.label} idPrefix={f.fieldname} />
                ) : (
                  <DynamicField key={f.fieldname} control={form.control} spec={f} />
                )
              )}
            </div>
            <Button type="submit" className="w-fit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </Form>

        {docName && <BenefitSubmitPanel name={docName} />}
      </div>

      <div className="w-full">
        <h2 className="text-lg font-semibold mb-3">Recent Employee Benefits</h2>
        {recentQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {listColumns.map((c) => (
                    <TableHead key={c.fieldname}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentQuery.data ?? []).map((row) => (
                  <TableRow
                    key={String(row.name)}
                    className={
                      docName && String(row.name) === docName
                        ? "bg-muted/50"
                        : "cursor-pointer hover:bg-muted/30"
                    }
                    onClick={() => {
                      if (docName && String(row.name) === docName) return
                      router.push(`/personnel/benefits/${encodeURIComponent(String(row.name))}`)
                    }}
                  >
                    {listColumns.map((c) => (
                      <TableCell key={c.fieldname}>{String(row[c.fieldname] ?? "")}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {(recentQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={listColumns.length} className="text-muted-foreground text-center">
                      No employee benefits yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

/** Moved unchanged from the old route file. */
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

/** Moved unchanged from the old route file. */
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
      <Separator className="my-6" />
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