"use client"

import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import type { FieldSpec } from "@/lib/forms/types"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import { Skeleton } from "@/components/ui/skeleton"

const DOCTYPE = "SMS Library Settings"

const FIELDS: FieldSpec[] = [
  { fieldname: "fine_per_day", label: "Fine Per Day", fieldtype: "Currency", required: true },
  { fieldname: "default_loan_period_days", label: "Default Loan Period Days", fieldtype: "Int" },
  { fieldname: "max_active_loans_per_borrower", label: "Max Active Loans Per Borrower", fieldtype: "Int" },
  { fieldname: "block_borrowing_if_overdue", label: "Block New Borrowing If Overdue Item Exists", fieldtype: "Check" },
]

/**
 * SMS Library Settings is a Single doctype (blueprint's issingle: 1): there is
 * exactly one record, fetched by the doctype's own name, with no list and no
 * create — so this is a bespoke page rather than MasterDetailScreen/
 * EntryScreen, both of which assume a list of documents to choose from.
 */
export default function LibrarySettingsPage() {
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery({
    queryKey: [DOCTYPE],
    queryFn: () => frappe.getDoc<Record<string, unknown>>(DOCTYPE, DOCTYPE),
  })

  const form = useForm<Record<string, unknown>>({
    defaultValues: doc ?? {},
    values: doc,
  })

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => frappe.updateDoc(DOCTYPE, DOCTYPE, values),
    onSuccess: () => {
      toast.success("Library settings saved")
      queryClient.invalidateQueries({ queryKey: [DOCTYPE] })
    },
    onError: (error) => toast.error(`Could not save library settings: ${getErrorMessage(error)}`),
  })

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Library Settings</h1>
        <p className="text-muted-foreground">
          Fine rate, default loan period, and borrowing limits applied library-wide.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
          className="grid max-w-xl gap-4"
        >
          {FIELDS.map((f) => (
            <DynamicField key={f.fieldname} control={form.control} spec={f} />
          ))}
          <Button type="submit" disabled={saveMutation.isPending} className="w-fit">
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
