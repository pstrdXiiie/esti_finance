"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import type { FormSpec } from "@/lib/forms/types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import * as form_1 from "@/components/ui/form"
import { DynamicField } from "@/components/sms/DynamicField"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function DetailScreen({
  spec,
  name,
  extraActions,
  basePath,
}: {
  spec: FormSpec
  name: string
  extraActions?: ReactNode
  /** Route this record's list/parent lives under, e.g. "/finance/transactions/student_acc".
      Used to build the post-create/post-delete redirect instead of guessing from the
      current URL, which breaks on static (non-[name]) routes. Falls back to the old
      pathname-slicing behavior if omitted, for screens not yet updated. */
  basePath?: string
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const [isEditing, setIsEditing] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const defaultValues = spec.fields.reduce<Record<string, unknown>>((acc, f) => {
    acc[f.fieldname] =
      f.fieldtype === "Check" ? false : f.fieldtype === "Int" || f.fieldtype === "Float" ? 0 : ""
    return acc
  }, {})

  const form = useForm<Record<string, unknown>>({ defaultValues })

  const { data, isLoading } = useQuery({
    queryKey: [spec.doctype, name],
    queryFn: () => frappe.getDoc<Record<string, unknown>>(spec.doctype, name),
  })

  useEffect(() => {
    if (data && !isNew) {
      form.reset({ ...defaultValues, ...data })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      frappe.updateDoc(spec.doctype, name, values),
    onSuccess: () => {
      toast.success(`${spec.title} saved`)
      queryClient.invalidateQueries({ queryKey: [spec.doctype, name] })
      setIsEditing(false)
    },
    onError: (error) => toast.error(`Could not save ${spec.title}: ${getErrorMessage(error)}`),
  })

  const createMutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) =>
      frappe.createDoc<Record<string, unknown>>(spec.doctype, values),
    onSuccess: (created) => {
      toast.success(`${spec.title} created`)
      queryClient.invalidateQueries({ queryKey: [spec.doctype] })
      setIsEditing(false)
      setIsNew(false)
      const parentPath = basePath ?? pathname.split("/").slice(0, -1).join("/")
      const newName = String(created.name)
      router.push(`${parentPath}/${encodeURIComponent(newName)}`)
    },
    onError: (error) => toast.error(`Could not create ${spec.title}: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => frappe.deleteDoc(spec.doctype, name),
    onSuccess: () => {
      toast.success(`${spec.title} deleted`)
      queryClient.invalidateQueries({ queryKey: [spec.doctype] })
      setConfirmDelete(false)
      const parentPath = basePath ?? pathname.split("/").slice(0, -1).join("/")
      router.push(parentPath)
    },
    onError: (error) => {
      toast.error(`Could not delete ${spec.title}: ${getErrorMessage(error)}`)
      setConfirmDelete(false)
    },
  })

  function handleNew() {
    form.reset(defaultValues)
    setIsNew(true)
    setIsEditing(true)
  }

  function handleCancel() {
    form.reset({ ...defaultValues, ...data })
    setIsNew(false)
    setIsEditing(false)
  }

  function onSubmit(values: Record<string, unknown>) {
    if (isNew) {
      createMutation.mutate(values)
    } else {
      saveMutation.mutate(values)
    }
  }

  const isSaving = saveMutation.isPending || createMutation.isPending

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const sectionOrder: string[] = []
  const sectionMap = new Map<string, typeof spec.fields>()
  for (const f of spec.fields) {
    const key = f.section ?? ""
    if (!sectionMap.has(key)) {
      sectionOrder.push(key)
      sectionMap.set(key, [])
    }
    sectionMap.get(key)!.push(f)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {isNew ? `New ${spec.title}` : spec.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage {spec.title.toLowerCase()} details below.
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="detail-form"
                className="bg-slate-900 text-white hover:bg-emerald-500"
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : isNew ? "Create" : "Save"}
              </Button>
            </>
          ) : (
            <>
              {extraActions}
              <Button type="button" variant="outline" onClick={handleNew}>
                New
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
              <Button className="bg-slate-800" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            </>
          )}
        </div>
      </div>

      <form_1.Form {...form}>
        <fieldset disabled={!isEditing} className="contents">
          <form
            id="detail-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-6"
          >
            {sectionOrder.map((sectionKey) => (
              <div key={sectionKey || "default"} className="grid gap-4">
                {sectionKey && (
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {sectionKey}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 rounded-lg border p-4 md:grid-cols-2">
                  {sectionMap.get(sectionKey)!.map((f) => {
                    if (f.dependsOn) {
                      const trigger = form.watch(f.dependsOn)
                      if (!trigger) return null
                    }
                    return <DynamicField key={f.fieldname} control={form.control} spec={f} />
                  })}
                </div>
              </div>
            ))}
          </form>
        </fieldset>
      </form_1.Form>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {spec.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this {spec.title.toLowerCase()} record. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
