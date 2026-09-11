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
  PencilIcon,
  Trash2Icon,
  PrinterIcon,
  SearchIcon,
} from "lucide-react"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { assetSpec } from "@/lib/forms/asset"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AssetListRow {
  name: string
  item_code: string | null
  serial_number: string | null
  description: string | null
  department: string | null
  status: string | null
}

interface AssetDoc extends AssetListRow {
  docstatus: number
  brand: string | null
  model: string | null
  location: string | null
  company: string | null
  purchase_date: string | null
  warranty_date: string | null
  gross_purchase_amount: number | null
  salvage_value: number | null
  estimated_useful_life_months: number | null
  daily_rate: number | null
  owner: string
  creation: string
  modified: string
}

interface ItemRow {
  name: string
  item_code: string | null
  item_name: string | null
}
interface DepartmentRow {
  name: string
  department_name: string | null
}
interface BrandRow {
  name: string
}
interface AssetModelRow {
  name: string
  model_name: string | null
}
interface LocationRow {
  name: string
}
interface CompanyRow {
  name: string
}

interface AssetFormState {
  item_code: string
  serial_number: string
  department: string
  brand: string
  model: string
  description: string
  location: string
  company: string
  purchase_date: string
  warranty_date: string
  gross_purchase_amount: string
  salvage_value: string
  estimated_useful_life_months: string
  daily_rate: string
}

const BLANK_FORM: AssetFormState = {
  item_code: "",
  serial_number: "",
  department: "",
  brand: "",
  model: "",
  description: "",
  location: "",
  company: "",
  purchase_date: "",
  warranty_date: "",
  gross_purchase_amount: "",
  salvage_value: "",
  estimated_useful_life_months: "",
  daily_rate: "",
}

function docToForm(doc: AssetDoc): AssetFormState {
  return {
    item_code: doc.item_code ?? "",
    serial_number: doc.serial_number ?? "",
    department: doc.department ?? "",
    brand: doc.brand ?? "",
    model: doc.model ?? "",
    description: doc.description ?? "",
    location: doc.location ?? "",
    company: doc.company ?? "",
    purchase_date: doc.purchase_date ?? "",
    warranty_date: doc.warranty_date ?? "",
    gross_purchase_amount: doc.gross_purchase_amount != null ? String(doc.gross_purchase_amount) : "",
    salvage_value: doc.salvage_value != null ? String(doc.salvage_value) : "",
    estimated_useful_life_months:
      doc.estimated_useful_life_months != null ? String(doc.estimated_useful_life_months) : "",
    daily_rate: doc.daily_rate != null ? String(doc.daily_rate) : "",
  }
}

function formatDate(value: string | undefined | null): string {
  if (!value) return "—"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
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
 * Fixed Asset Entry (Asset & Property tab): one Asset record at a time,
 * Add/Edit/Delete/Search/Print toolbar mirroring the legacy desktop screen
 * it replaces — same disabled-until-editing / Record N of M browsing
 * convention as DepartmentMaintenance and Curriculum Offered. Backed by the
 * real erpnext "Asset" doctype (assetSpec) rather than a parallel schema.
 * asset_name/company/available_for_use_date are required by ERPNext but
 * aren't on the legacy screen, so they're derived/defaulted on create
 * instead of adding fields the reference layout doesn't have. status stays
 * read-only per assetSpec's own note: it's system-derived (submit/
 * depreciation/movement lifecycle), not meant for free manual editing.
 */
export default function FixedAssetEntry() {
  const queryClient = useQueryClient()

  const assetsQuery = useQuery({
    queryKey: [assetSpec.doctype, "list", "fixed-asset-entry"],
    queryFn: () =>
      frappe.list<AssetListRow>(assetSpec.doctype, {
        fields: ["name", "item_code", "serial_number", "description", "department", "status"],
        order_by: "modified desc",
        limit_page_length: 500,
      }),
  })

  const itemsQuery = useQuery({
    queryKey: ["Item", "list", "fixed-asset-entry"],
    queryFn: () =>
      frappe.list<ItemRow>("Item", {
        fields: ["name", "item_code", "item_name"],
        limit_page_length: 500,
      }),
  })
  const departmentsQuery = useQuery({
    queryKey: ["Department", "list", "fixed-asset-entry"],
    queryFn: () =>
      frappe.list<DepartmentRow>("Department", {
        fields: ["name", "department_name"],
        limit_page_length: 500,
      }),
  })
  const brandsQuery = useQuery({
    queryKey: ["Brand", "list", "fixed-asset-entry"],
    queryFn: () => frappe.list<BrandRow>("Brand", { fields: ["name"], limit_page_length: 500 }),
  })
  const modelsQuery = useQuery({
    queryKey: ["SMS Asset Model", "list", "fixed-asset-entry"],
    queryFn: () =>
      frappe.list<AssetModelRow>("SMS Asset Model", {
        fields: ["name", "model_name"],
        limit_page_length: 500,
      }),
  })
  const locationsQuery = useQuery({
    queryKey: ["Location", "list", "fixed-asset-entry"],
    queryFn: () => frappe.list<LocationRow>("Location", { fields: ["name"], limit_page_length: 500 }),
  })
  const companiesQuery = useQuery({
    queryKey: ["Company", "list", "fixed-asset-entry"],
    queryFn: () => frappe.list<CompanyRow>("Company", { fields: ["name"], limit_page_length: 500 }),
  })

  const assets = assetsQuery.data ?? []
  const items = itemsQuery.data ?? []
  const departments = departmentsQuery.data ?? []
  const brands = brandsQuery.data ?? []
  const models = modelsQuery.data ?? []
  const locations = locationsQuery.data ?? []
  const companies = companiesQuery.data ?? []

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<AssetFormState>(BLANK_FORM)
  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)

  if (!initialized && assets.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? assets[selectedIndex] : null

  const { data: fullDoc, isFetching: isLoadingDoc } = useQuery({
    queryKey: [assetSpec.doctype, selected?.name],
    queryFn: () => frappe.getDoc<AssetDoc>(assetSpec.doctype, selected!.name),
    enabled: !!selected,
  })

  if (fullDoc && fullDoc.name !== syncedName) {
    setSyncedName(fullDoc.name)
    setForm(docToForm(fullDoc))
  }

  if (pendingSelectName) {
    const idx = assets.findIndex((a) => a.name === pendingSelectName)
    if (idx !== -1) {
      setSelectedIndex(idx)
      setPendingSelectName(null)
    }
  }

  function handleAdd() {
    setSelectedIndex(null)
    setSyncedName(undefined)
    setForm(BLANK_FORM)
    setIsEditing(true)
  }

  function handleEdit() {
    if (!selected) return
    if (fullDoc) setForm(docToForm(fullDoc))
    setIsEditing(true)
  }

  function handleCancel() {
    if (fullDoc) {
      setForm(docToForm(fullDoc))
    } else {
      setForm(BLANK_FORM)
    }
    setIsEditing(false)
  }

  function selectRecord(idx: number) {
    if (idx < 0 || idx >= assets.length) return
    setSelectedIndex(idx)
  }

  const query = searchQuery.trim().toLowerCase()
  const searchMatches = query
    ? assets.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.serial_number?.toLowerCase().includes(query) ||
          a.item_code?.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query)
      )
    : []

  function jumpToAsset(name: string) {
    const idx = assets.findIndex((a) => a.name === name)
    if (idx !== -1) setSelectedIndex(idx)
    setSearchOpen(false)
  }

  function handleSearch() {
    if (!query) return
    const idx = assets.findIndex(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.serial_number?.toLowerCase().includes(query) ||
        a.item_code?.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query)
    )
    if (idx === -1) {
      toast.info(`No asset found matching "${searchQuery}"`)
      return
    }
    setSelectedIndex(idx)
    setSearchOpen(false)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        item_code: form.item_code,
        serial_number: form.serial_number || undefined,
        department: form.department || undefined,
        brand: form.brand || undefined,
        model: form.model || undefined,
        description: form.description || undefined,
        location: form.location || undefined,
        purchase_date: form.purchase_date || undefined,
        warranty_date: form.warranty_date || undefined,
        gross_purchase_amount: form.gross_purchase_amount ? Number(form.gross_purchase_amount) : undefined,
        salvage_value: form.salvage_value ? Number(form.salvage_value) : undefined,
        estimated_useful_life_months: form.estimated_useful_life_months
          ? Number(form.estimated_useful_life_months)
          : undefined,
        daily_rate: form.daily_rate ? Number(form.daily_rate) : undefined,
      }

      if (selected) {
        return frappe.updateDoc<AssetDoc>(assetSpec.doctype, selected.name, payload)
      }

      const item = items.find((i) => i.name === form.item_code)
      return frappe.createDoc<AssetDoc>(assetSpec.doctype, {
        ...payload,
        asset_name: item?.item_name || form.serial_number || form.item_code,
        company: form.company || companies[0]?.name,
        available_for_use_date: form.purchase_date,
      })
    },
    onSuccess: async (saved) => {
      toast.success("Asset saved")
      setPendingSelectName(saved.name)
      setIsEditing(false)
      await queryClient.invalidateQueries({ queryKey: [assetSpec.doctype] })
    },
    onError: (error) => toast.error(`Could not save asset: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (fullDoc?.docstatus === 1) {
        await frappe.updateDoc(assetSpec.doctype, selected!.name, { docstatus: 2 })
      }
      // Every Asset save/submit/cancel logs an "Asset Activity" entry —
      // ERPNext's own audit trail, not user data — which otherwise blocks
      // deletion with a LinkExistsError. Safe to clear and retry, same
      // reasoning as MasterDetailScreen's cascadeDeleteDoctypes.
      for (let attempt = 0; attempt < 20; attempt++) {
        try {
          await frappe.deleteDoc(assetSpec.doctype, selected!.name)
          return
        } catch (error) {
          const message = getErrorMessage(error)
          const marker = "linked with Asset Activity "
          const idx = message.indexOf(marker)
          if (idx === -1) throw error
          const activityName = message.slice(idx + marker.length).trim().split(/[\s,.;]/)[0]
          if (!activityName) throw error
          await frappe.deleteDoc("Asset Activity", activityName)
        }
      }
      throw new Error("Too many linked Asset Activity records to resolve automatically.")
    },
    onSuccess: async () => {
      toast.success("Asset deleted")
      setSelectedIndex(null)
      setSyncedName(undefined)
      setForm(BLANK_FORM)
      await queryClient.invalidateQueries({ queryKey: [assetSpec.doctype] })
    },
    onError: (error) => toast.error(`Could not delete asset: ${getErrorMessage(error)}`),
  })

  // gross_purchase_amount isn't flagged required in assetSpec, but ERPNext's
  // own Asset.validate_asset_values() throws MandatoryError without it on
  // every save (create or update) — confirmed against the real API, not
  // just the spec.
  const canSave =
    !!form.item_code &&
    !!form.location &&
    !!form.purchase_date &&
    !!form.gross_purchase_amount &&
    !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-border h-full p-6 grid gap-5 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4 print:hidden">
        <Button type="button" disabled={isEditing} onClick={handleAdd}>
          <PlusIcon /> New Asset
        </Button>
        <Button type="button" variant="outline" disabled={isEditing || !selected} onClick={handleEdit}>
          <PencilIcon /> Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isEditing || !selected || deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2Icon /> Remove
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <PrinterIcon /> Print
        </Button>

        <div
          className="relative flex items-center gap-2 ml-4"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setSearchOpen(false)
          }}
        >
          <Input
            placeholder="Search asset no., serial, item code…"
            className="w-64"
            value={searchQuery}
            disabled={isEditing}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleSearch()
              } else if (e.key === "Escape") {
                setSearchOpen(false)
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" disabled={isEditing} onClick={handleSearch}>
            <SearchIcon />
          </Button>

          {searchOpen && query && !isEditing && (
            <div className="absolute top-full left-0 z-20 mt-1 w-72 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 max-h-64 overflow-y-auto p-1">
              {searchMatches.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No matches.</div>
              ) : (
                searchMatches.map((a) => (
                  <button
                    key={a.name}
                    type="button"
                    className="w-full text-left rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => jumpToAsset(a.name)}
                  >
                    {a.name}
                    {a.description ? ` — ${a.description}` : ""}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {isEditing && (
          <div className="ml-auto flex gap-2">
            <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {selected && isLoadingDoc ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Field id="asset-no" label="Asset No.">
              <Input id="asset-no" value={selected?.name ?? "(assigned on save)"} disabled />
            </Field>
            <Field id="serial-no" label="Serial No. / Item Tag">
              <Input
                id="serial-no"
                value={form.serial_number}
                disabled={!isEditing}
                onChange={(e) => setForm((prev) => ({ ...prev, serial_number: e.target.value }))}
              />
            </Field>
            <Field id="department" label="Department">
              <Select
                value={form.department}
                disabled={!isEditing}
                onValueChange={(v) => setForm((prev) => ({ ...prev, department: v ?? "" }))}
              >
                <SelectTrigger id="department" className="w-full">
                  <SelectValue placeholder="Select department…" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.name} value={d.name}>
                      {d.department_name || d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field id="item-code" label="Item Code">
              <Select
                value={form.item_code}
                disabled={!isEditing}
                onValueChange={(v) => setForm((prev) => ({ ...prev, item_code: v ?? "" }))}
              >
                <SelectTrigger id="item-code" className="w-full">
                  <SelectValue placeholder="Select item…" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.name} value={i.name}>
                      {i.item_code ? `${i.item_code} — ${i.item_name}` : i.item_name || i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="model" label="Model">
              <Select
                value={form.model}
                disabled={!isEditing}
                onValueChange={(v) => setForm((prev) => ({ ...prev, model: v ?? "" }))}
              >
                <SelectTrigger id="model" className="w-full">
                  <SelectValue placeholder="Select model…" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      {m.model_name || m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="brand" label="Brand">
              <Select
                value={form.brand}
                disabled={!isEditing}
                onValueChange={(v) => setForm((prev) => ({ ...prev, brand: v ?? "" }))}
              >
                <SelectTrigger id="brand" className="w-full">
                  <SelectValue placeholder="Select brand…" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field id="description" label="Description">
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              disabled={!isEditing}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <Field id="acquisition-cost" label="Acquisition Cost">
              <Input
                id="acquisition-cost"
                type="number"
                step="0.01"
                value={form.gross_purchase_amount}
                disabled={!isEditing}
                onChange={(e) => setForm((prev) => ({ ...prev, gross_purchase_amount: e.target.value }))}
              />
            </Field>
            <Field id="purchase-date" label="Purchase Date">
              <Input
                id="purchase-date"
                type="date"
                value={form.purchase_date}
                disabled={!isEditing}
                onChange={(e) => setForm((prev) => ({ ...prev, purchase_date: e.target.value }))}
              />
            </Field>
            <Field id="warranty-coverage" label="Warranty Coverage">
              <Input
                id="warranty-coverage"
                type="date"
                value={form.warranty_date}
                disabled={!isEditing}
                onChange={(e) => setForm((prev) => ({ ...prev, warranty_date: e.target.value }))}
              />
            </Field>
            <Field id="salvage-value" label="Salvage Value">
              <Input
                id="salvage-value"
                type="number"
                step="0.01"
                value={form.salvage_value}
                disabled={!isEditing}
                onChange={(e) => setForm((prev) => ({ ...prev, salvage_value: e.target.value }))}
              />
            </Field>
            <Field id="useful-life" label="Est. Useful Life (mo.)">
              <Input
                id="useful-life"
                type="number"
                step="1"
                value={form.estimated_useful_life_months}
                disabled={!isEditing}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, estimated_useful_life_months: e.target.value }))
                }
              />
            </Field>
            <Field id="daily-rate" label="Daily Rate">
              <Input
                id="daily-rate"
                type="number"
                step="0.01"
                value={form.daily_rate}
                disabled={!isEditing}
                onChange={(e) => setForm((prev) => ({ ...prev, daily_rate: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field id="location" label="Location">
              <Select
                value={form.location}
                disabled={!isEditing}
                onValueChange={(v) => setForm((prev) => ({ ...prev, location: v ?? "" }))}
              >
                <SelectTrigger id="location" className="w-full">
                  <SelectValue placeholder="Select location…" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.name} value={l.name}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="asset-status" label="Asset Status">
              <Input id="asset-status" value={fullDoc?.status ?? "Draft"} disabled />
            </Field>
          </div>

          {companies.length > 1 && (
            <Field id="company" label="Company">
              <Select
                value={form.company}
                disabled={!isEditing}
                onValueChange={(v) => setForm((prev) => ({ ...prev, company: v ?? "" }))}
              >
                <SelectTrigger id="company" className="w-full max-w-xs">
                  <SelectValue placeholder="Select company…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 mt-auto">
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <span>Encoder: {fullDoc?.owner ?? "—"}</span>
          <span>Date Entered: {formatDate(fullDoc?.creation)}</span>
          <span>Date Edited: {formatDate(fullDoc?.modified)}</span>
        </div>
        <div className="flex items-center gap-4 print:hidden">
          <div className="text-sm text-muted-foreground">
            {selectedIndex !== null && assets.length > 0
              ? `Record ${selectedIndex + 1} of ${assets.length}`
              : "New Asset"}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={isEditing || selectedIndex === null || selectedIndex === 0}
              onClick={() => selectRecord(0)}
            >
              <ChevronsLeft />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={isEditing || selectedIndex === null || selectedIndex === 0}
              onClick={() => selectRecord((selectedIndex ?? 0) - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={isEditing || selectedIndex === null || selectedIndex >= assets.length - 1}
              onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
            >
              <ChevronRight />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={isEditing || selectedIndex === null || selectedIndex >= assets.length - 1}
              onClick={() => selectRecord(assets.length - 1)}
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
