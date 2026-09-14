"use client"

import { useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  PlusIcon,
  Trash2Icon,
  PrinterIcon,
} from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

interface SupplierRow {
  name: string
  supplier_name: string
  legacy_supplier_code: string | null
}

interface SupplierDoc extends SupplierRow {
  supplier_address: string | null
  contact_person: string | null
  telephone: string | null
  fax: string | null
  supplier_email: string | null
  website: string | null
  payment_terms_days: number | null
  tax_percent: number | null
  owner: string
  creation: string
  modified: string
}

interface SupplierFormState {
  supplier_name: string
  legacy_supplier_code: string
  supplier_address: string
  contact_person: string
  telephone: string
  fax: string
  supplier_email: string
  website: string
  payment_terms_days: string
  tax_percent: string
}

const BLANK_FORM: SupplierFormState = {
  supplier_name: "",
  legacy_supplier_code: "",
  supplier_address: "",
  contact_person: "",
  telephone: "",
  fax: "",
  supplier_email: "",
  website: "",
  payment_terms_days: "0",
  tax_percent: "0",
}

function docToForm(doc: SupplierDoc): SupplierFormState {
  return {
    supplier_name: doc.supplier_name ?? "",
    legacy_supplier_code: doc.legacy_supplier_code ?? "",
    supplier_address: doc.supplier_address ?? "",
    contact_person: doc.contact_person ?? "",
    telephone: doc.telephone ?? "",
    fax: doc.fax ?? "",
    supplier_email: doc.supplier_email ?? "",
    website: doc.website ?? "",
    payment_terms_days: doc.payment_terms_days != null ? String(doc.payment_terms_days) : "0",
    tax_percent: doc.tax_percent != null ? String(doc.tax_percent) : "0",
  }
}

function formatDate(value?: string) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString()
}

/** Small local label+control wrapper — only consumer is this component. */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}

/**
 * "Suppliers Masterfile" (Finance > Maintenance): one Supplier record at a
 * time, paged through the same way Registrar's Curriculum Offered pages
 * through curricula — mirrors that screen's toolbar/layout/pager
 * structure. Backed by ERPNext's native "Supplier" doctype (supplier_name,
 * website) plus the Legacy/Purchasing and Supplier Masterfile custom
 * fields added in campus_erp/setup/custom_fields_finance.py
 * (legacy_supplier_code as "Supplier Code", tax_percent as "Supplier Tax",
 * and the flat supplier_address/contact_person/telephone/fax/
 * supplier_email/payment_terms_days fields) — deliberately flat rather
 * than ERPNext's native Contact/Address-linked workflow, to match the
 * legacy single-page form this replaces. Encoder/Date Entered/Date Edited
 * are Frappe's own owner/creation/modified document metadata, not extra
 * fields.
 */
export default function SupplierMasterfile() {
  const queryClient = useQueryClient()

  const suppliersQuery = useQuery({
    queryKey: ["Supplier", "list", "supplier-masterfile"],
    queryFn: () =>
      frappe.list<SupplierRow>("Supplier", {
        fields: ["name", "supplier_name", "legacy_supplier_code"],
        order_by: "supplier_name asc",
        limit_page_length: 500,
      }),
  })

  const suppliers = suppliersQuery.data ?? []

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<SupplierFormState>(BLANK_FORM)

  if (!initialized && suppliers.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? suppliers[selectedIndex] : null

  const { data: fullDoc, isFetching: isLoadingDoc } = useQuery({
    queryKey: ["Supplier", selected?.name],
    queryFn: () => frappe.getDoc<SupplierDoc>("Supplier", selected!.name),
    enabled: !!selected,
  })

  if (fullDoc && fullDoc.name !== syncedName) {
    setSyncedName(fullDoc.name)
    setForm(docToForm(fullDoc))
  }

  if (pendingSelectName) {
    const idx = suppliers.findIndex((s) => s.name === pendingSelectName)
    if (idx !== -1) {
      setSelectedIndex(idx)
      setPendingSelectName(null)
    }
  }

  function handleAdd() {
    setSelectedIndex(null)
    setSyncedName(undefined)
    setForm(BLANK_FORM)
  }

  function handleCancel() {
    setForm(fullDoc ? docToForm(fullDoc) : BLANK_FORM)
  }

  function selectRecord(idx: number) {
    if (idx < 0 || idx >= suppliers.length) return
    setSelectedIndex(idx)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        supplier_name: form.supplier_name,
        legacy_supplier_code: form.legacy_supplier_code || undefined,
        supplier_address: form.supplier_address || undefined,
        contact_person: form.contact_person || undefined,
        telephone: form.telephone || undefined,
        fax: form.fax || undefined,
        supplier_email: form.supplier_email || undefined,
        website: form.website || undefined,
        payment_terms_days: form.payment_terms_days ? Number(form.payment_terms_days) : undefined,
        tax_percent: form.tax_percent ? Number(form.tax_percent) : undefined,
        // Not exposed on this screen (the legacy form doesn't have it either) —
        // native Supplier requires it, so new suppliers default to "Company".
        ...(selected ? {} : { supplier_type: "Company" }),
      }
      return selected
        ? frappe.updateDoc<SupplierDoc>("Supplier", selected.name, payload)
        : frappe.createDoc<SupplierDoc>("Supplier", payload)
    },
    onSuccess: async (saved) => {
      toast.success("Supplier saved")
      setPendingSelectName(saved.name)
      await queryClient.invalidateQueries({ queryKey: ["Supplier"] })
    },
    onError: (error) => toast.error(`Could not save supplier: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("Supplier", selected!.name),
    onSuccess: async () => {
      toast.success("Supplier deleted")
      await queryClient.invalidateQueries({ queryKey: ["Supplier"] })
      handleAdd()
    },
    onError: (error) => toast.error(`Could not delete supplier: ${getErrorMessage(error)}`),
  })

  const canSave = !!form.supplier_name && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-border h-full p-6 flex flex-col gap-5 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Button type="button" onClick={handleAdd}>
          <PlusIcon /> Add
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!selected || deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2Icon /> Delete
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <PrinterIcon /> Print
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {selected && isLoadingDoc ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
            <Field id="sup-code" label="Supplier Code">
              <Input
                id="sup-code"
                value={form.legacy_supplier_code}
                onChange={(e) => setForm((prev) => ({ ...prev, legacy_supplier_code: e.target.value }))}
              />
            </Field>
            <Field id="sup-name" label="Supplier Name">
              <Input
                id="sup-name"
                value={form.supplier_name}
                onChange={(e) => setForm((prev) => ({ ...prev, supplier_name: e.target.value }))}
              />
            </Field>
            <Field id="sup-address" label="Supplier Address">
              <Input
                id="sup-address"
                value={form.supplier_address}
                onChange={(e) => setForm((prev) => ({ ...prev, supplier_address: e.target.value }))}
              />
            </Field>
            <Field id="sup-contact" label="Contact Person">
              <Input
                id="sup-contact"
                value={form.contact_person}
                onChange={(e) => setForm((prev) => ({ ...prev, contact_person: e.target.value }))}
              />
            </Field>
            <Field id="sup-telephone" label="Telephone">
              <Input
                id="sup-telephone"
                value={form.telephone}
                onChange={(e) => setForm((prev) => ({ ...prev, telephone: e.target.value }))}
              />
            </Field>
            <Field id="sup-fax" label="Fax">
              <Input
                id="sup-fax"
                value={form.fax}
                onChange={(e) => setForm((prev) => ({ ...prev, fax: e.target.value }))}
              />
            </Field>
            <Field id="sup-email" label="E-mail">
              <Input
                id="sup-email"
                type="email"
                value={form.supplier_email}
                onChange={(e) => setForm((prev) => ({ ...prev, supplier_email: e.target.value }))}
              />
            </Field>
            <Field id="sup-website" label="Website">
              <Input
                id="sup-website"
                value={form.website}
                onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 max-w-md">
            <Field id="sup-terms" label="Payment Terms">
              <div className="flex items-center gap-2">
                <Input
                  id="sup-terms"
                  type="number"
                  value={form.payment_terms_days}
                  onChange={(e) => setForm((prev) => ({ ...prev, payment_terms_days: e.target.value }))}
                />
                <span className="shrink-0 text-sm text-muted-foreground">Days</span>
              </div>
            </Field>
            <Field id="sup-tax" label="Supplier Tax">
              <div className="flex items-center gap-2">
                <Input
                  id="sup-tax"
                  type="number"
                  value={form.tax_percent}
                  onChange={(e) => setForm((prev) => ({ ...prev, tax_percent: e.target.value }))}
                />
                <span className="shrink-0 text-sm text-muted-foreground">%</span>
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 max-w-2xl rounded-md border p-4">
            <Field id="sup-encoder" label="Encoder">
              <Input id="sup-encoder" value={fullDoc?.owner ?? "—"} disabled />
            </Field>
            <Field id="sup-date-entered" label="Date Entered">
              <Input id="sup-date-entered" value={formatDate(fullDoc?.creation)} disabled />
            </Field>
            <Field id="sup-date-edited" label="Date Edited">
              <Input id="sup-date-edited" value={formatDate(fullDoc?.modified)} disabled />
            </Field>
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="text-sm text-muted-foreground">
          {selectedIndex !== null && suppliers.length > 0
            ? `Record ${selectedIndex + 1} of ${suppliers.length}`
            : "New Supplier"}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord(0)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex === 0}
            onClick={() => selectRecord((selectedIndex ?? 0) - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex >= suppliers.length - 1}
            onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex >= suppliers.length - 1}
            onClick={() => selectRecord(suppliers.length - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
