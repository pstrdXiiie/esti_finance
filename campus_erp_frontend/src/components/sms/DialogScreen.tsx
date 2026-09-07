"use client"

import { useForm } from "react-hook-form"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import type { FieldSpec } from "@/lib/forms/types"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * The ~19 legacy modal prompts/utilities (blueprint §5.1): small dialogs like
 * password change, settings toggles, override confirmations — a single-column
 * form with one primary action, never a full page.
 */
export function DialogScreen({
  title,
  fields,
  method,
  open,
  onOpenChange,
  onSuccess,
}: {
  title: string
  fields: FieldSpec[]
  method: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const form = useForm<Record<string, unknown>>({ defaultValues: {} })

  const mutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => frappe.call(method, values),
    onSuccess: () => {
      toast.success(`${title} complete`)
      onOpenChange(false)
      form.reset({})
      onSuccess?.()
    },
    onError: (error) => toast.error(`${title} failed: ${getErrorMessage(error)}`),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="grid gap-4"
          >
            {fields.map((f) => (
              <DynamicField key={f.fieldname} control={form.control} spec={f} />
            ))}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Working…" : "Confirm"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
