"use client"

import { useEffect, useState, type ReactNode, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { employeeSpec } from "@/lib/forms/personnel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type EmployeeDoc = Record<string, string>

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

/**
 * CONFIRMED against the real `Personnel Info` DocType via
 * `bench --site education.localhost console` -> frappe.get_meta("Personnel Info").
 * All fourteen fields below are genuine `Int` fields on that DocType.
 * (Previous guesses `basic_pay` and `night_differential_rate` do not exist;
 * `overtime_rate` was a wrong name for the real `reg_ot_per_hour`.)
 */
const PAYROLL_FIELDS: { fieldname: string; label: string }[] = [
  { fieldname: "gross_pay", label: "Gross Pay" },
  { fieldname: "allowance", label: "Allowance" },
  { fieldname: "reg_rate_pre_hour", label: "Regular Rate / Hour" },
  { fieldname: "reg_ot_per_hour", label: "Regular OT / Hour" },
  { fieldname: "sunday_rate_per_hour", label: "Sunday Rate / Hour" },
  { fieldname: "sunday_ot_per_hour", label: "Sunday OT / Hour" },
  { fieldname: "holiday_rate_per_hour", label: "Holiday Rate / Hour" },
  { fieldname: "holiday_ot_per_hour", label: "Holiday OT / Hour" },
  { fieldname: "late_rate_per_hour", label: "Late Rate / Hour" },
  { fieldname: "undertime_rate_per_hour", label: "Undertime Rate / Hour" },
  { fieldname: "with_holding_tax", label: "Withholding Tax" },
  { fieldname: "sss_deduction", label: "SSS Deduction" },
  { fieldname: "philhealth_deduction", label: "PhilHealth Deduction" },
  { fieldname: "pagibig_deduction", label: "Pag-IBIG Deduction" },
]

interface EmployeeDetailTabsProps {
  docName: string
  basePath: string
}

export function EmployeeDetailTabs({ docName, basePath }: EmployeeDetailTabsProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: [employeeSpec.doctype, docName],
    queryFn: () => frappe.getDoc<EmployeeDoc>(employeeSpec.doctype, docName),
  })

  const [info, setInfo] = useState<EmployeeDoc>({})
  const [payroll, setPayroll] = useState<EmployeeDoc>({})
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string>("")

  useEffect(() => {
    if (!data) return
    setInfo(data)
    setPayroll(data)
    // Don't stomp an unsaved local pick when this re-runs after a save
    // (queryClient invalidation refetches `data`).
    setProfilePreviewUrl((prev) => (prev.startsWith("blob:") ? prev : data.profile ?? ""))
  }, [data])

  // Same deferred-upload pattern as EmployeeWizard.tsx / registrar's Add
  // Student page — stage locally, upload inside the mutation on Save.
  function handleProfileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileFile(file)
    setProfilePreviewUrl((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  // department's actual fieldtype in personnel.ts is "Select" (confirmed via
  // grep), not a Link field — read the baked-in choice list directly.
  const departmentField = employeeSpec.fields.find((f) => f.fieldname === "department")
  const departmentOptions = (departmentField?.options ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean)

  const infoMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { ...info }
      if (profileFile) {
        const uploaded = await frappe.uploadFile(profileFile, { isPrivate: true })
        payload.profile = uploaded.file_url
      }
      return frappe.updateDoc(employeeSpec.doctype, docName, payload)
    },
    onSuccess: async () => {
      toast.success("Employee info saved")
      setProfileFile(null)
      await queryClient.invalidateQueries({ queryKey: [employeeSpec.doctype] })
    },
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  const payrollMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {}
      for (const f of PAYROLL_FIELDS) payload[f.fieldname] = payroll[f.fieldname]
      return frappe.updateDoc(employeeSpec.doctype, docName, payload)
    },
    onSuccess: () => toast.success("Payroll info saved"),
    onError: (error) => toast.error(`Could not save: ${getErrorMessage(error)}`),
  })

  if (isLoading || !data) {
    return <div className="rounded-2xl border border-border p-7">Loading…</div>
  }

  return (
    <div className="rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">
          {data.first_name} {data.last_name}
        </h1>
        <Button type="button" variant="outline" size="sm" onClick={() => router.push(basePath)}>
          Back
        </Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="violations">Violation List</TabsTrigger>
          <TabsTrigger value="loans-leave">Loan/Leave</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="pt-4">
          <div className="flex gap-4 items-start pb-4">
            <label
              htmlFor="info-profile"
              className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-muted text-[10px] text-muted-foreground"
            >
              {profilePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePreviewUrl} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                "No Photo"
              )}
              <input
                id="info-profile"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileChange}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {employeeSpec.fields.map((f) =>
              f.fieldname === "department" ? (
                <Field key={f.fieldname} id="info-department" label={f.label}>
                  <Select
                    value={info.department ?? ""}
                    onValueChange={(v) => setInfo((prev) => ({ ...prev, department: v ?? "" }))}
                  >
                    <SelectTrigger id="info-department" className="w-full">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field key={f.fieldname} id={`info-${f.fieldname}`} label={f.label}>
                  <Input
                    id={`info-${f.fieldname}`}
                    value={info[f.fieldname] ?? ""}
                    onChange={(e) => setInfo((prev) => ({ ...prev, [f.fieldname]: e.target.value }))}
                  />
                </Field>
              )
            )}
          </div>
          <div className="flex justify-end pt-4">
            <Button type="button" disabled={infoMutation.isPending} onClick={() => infoMutation.mutate()}>
              {infoMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="payroll" className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {PAYROLL_FIELDS.map((f) => (
              <Field key={f.fieldname} id={`payroll-${f.fieldname}`} label={f.label}>
                <Input
                  id={`payroll-${f.fieldname}`}
                  type="number"
                  value={payroll[f.fieldname] ?? ""}
                  onChange={(e) => setPayroll((prev) => ({ ...prev, [f.fieldname]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
          <div className="flex justify-end pt-4">
            <Button type="button" disabled={payrollMutation.isPending} onClick={() => payrollMutation.mutate()}>
              {payrollMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="violations" className="pt-4 text-muted-foreground">
          No infractions backend exists yet — placeholder until that's built.
        </TabsContent>
        <TabsContent value="loans-leave" className="pt-4 text-muted-foreground">
          Backend RPCs already exist but aren't wired up here yet — placeholder pending Phase 2.
        </TabsContent>
        <TabsContent value="benefits" className="pt-4 text-muted-foreground">
          {/* Deliberately left empty per request. */}
        </TabsContent>
      </Tabs>
    </div>
  )
}
