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

import { useAuth } from "@/providers/AuthProvider"
import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// "Buying" Item Price rows are the per-supplier price history grid (the
// blueprint's own Link-target translation table maps "SMS Item Supplier/
// Price History" to native Item Price — see custom_fields_finance.py's
// module docstring). Item Price already has a native `supplier` field, so
// no custom field was needed for that half; `price_list` is required by
// the native doctype with no free-standing default, so new rows are
// posted against ERPNext's conventional default Buying price list —
// confirm "Standard Buying" actually exists on the real site.
const DEFAULT_BUYING_PRICE_LIST = "Standard Buying"

interface ItemRow {
  name: string
  item_name: string
  is_stock_item: number
}

interface ItemDoc extends ItemRow {
  item_group: string
  stock_uom: string
  item_quantity: number | null
  reorder_quantity: number | null
  default_cost: number | null
  max_order_qty: number | null
  default_supplier: string | null
  owner: string
  creation: string
  modified: string
}

interface ItemPriceRow {
  name: string
  supplier: string | null
  price_list_rate: number
  valid_from: string | null
  valid_upto: string | null
}

interface SupplierOption {
  name: string
  supplier_name: string
}

interface ItemGroupOption {
  name: string
}

interface UomOption {
  name: string
}

interface ItemFormState {
  item_code: string
  item_name: string
  item_group: string
  is_stock_item: boolean
  stock_uom: string
  item_quantity: string
  reorder_quantity: string
  default_cost: string
  max_order_qty: string
  default_supplier: string
}

const BLANK_FORM: ItemFormState = {
  item_code: "",
  item_name: "",
  item_group: "",
  is_stock_item: true,
  stock_uom: "",
  item_quantity: "0",
  reorder_quantity: "0",
  default_cost: "0",
  max_order_qty: "0",
  default_supplier: "",
}

function docToForm(doc: ItemDoc): ItemFormState {
  return {
    item_code: doc.name,
    item_name: doc.item_name ?? "",
    item_group: doc.item_group ?? "",
    is_stock_item: !!doc.is_stock_item,
    stock_uom: doc.stock_uom ?? "",
    item_quantity: doc.item_quantity != null ? String(doc.item_quantity) : "0",
    reorder_quantity: doc.reorder_quantity != null ? String(doc.reorder_quantity) : "0",
    default_cost: doc.default_cost != null ? String(doc.default_cost) : "0",
    max_order_qty: doc.max_order_qty != null ? String(doc.max_order_qty) : "0",
    default_supplier: doc.default_supplier ?? "",
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
 * "Items Masterfile" (Finance > Maintenance): one Item record at a time,
 * paged through the same way Registrar's Curriculum Offered pages through
 * curricula, whose layout/toolbar/pager this mirrors directly. Backed by
 * ERPNext's native "Item" doctype (item_code as the record name, item_name,
 * item_group, stock_uom, is_stock_item repurposed as the Consumables/
 * Non-Consumables toggle) plus the Items Masterfile custom fields added in
 * campus_erp/setup/custom_fields_finance.py (item_quantity and
 * reorder_quantity — simple manually-tracked fields, not linked to the
 * real Stock Ledger/Bin — plus the pre-existing default_cost/max_order_qty
 * from the earlier purchasing pass, and default_supplier). The price-
 * history grid below is native "Item Price" records (already has its own
 * `supplier` field) rather than a child table.
 *
 * "View by Encoder Only" and "Item Group" have no equivalent in the legacy
 * screenshot this replaces — the former is a client-side filter on the
 * record list (by `owner`), the latter is a genuinely required native
 * Item field with no safe universal default, so it's shown rather than
 * guessed at.
 */
export default function ItemsMasterfile() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [viewByEncoderOnly, setViewByEncoderOnly] = useState(false)

  const itemsQuery = useQuery({
    queryKey: ["Item", "list", "items-masterfile", viewByEncoderOnly, user?.user],
    queryFn: () =>
      frappe.list<ItemRow>("Item", {
        fields: ["name", "item_name", "is_stock_item"],
        filters: viewByEncoderOnly && user ? [["owner", "=", user.user]] : undefined,
        order_by: "item_name asc",
        limit_page_length: 500,
      }),
    enabled: !viewByEncoderOnly || !!user,
  })

  const itemGroupsQuery = useQuery({
    queryKey: ["Item Group", "list", "items-masterfile"],
    queryFn: () =>
      frappe.list<ItemGroupOption>("Item Group", {
        fields: ["name"],
        filters: [["is_group", "=", 0]],
        limit_page_length: 200,
      }),
  })

  const uomsQuery = useQuery({
    queryKey: ["UOM", "list", "items-masterfile"],
    queryFn: () => frappe.list<UomOption>("UOM", { fields: ["name"], limit_page_length: 200 }),
  })

  const suppliersQuery = useQuery({
    queryKey: ["Supplier", "list", "items-masterfile"],
    queryFn: () =>
      frappe.list<SupplierOption>("Supplier", {
        fields: ["name", "supplier_name"],
        limit_page_length: 500,
      }),
  })

  const items = itemsQuery.data ?? []
  const suppliers = suppliersQuery.data ?? []
  const supplierByName = new Map(suppliers.map((s) => [s.name, s]))

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<ItemFormState>(BLANK_FORM)

  if (!initialized && items.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? items[selectedIndex] : null

  const { data: fullDoc, isFetching: isLoadingDoc } = useQuery({
    queryKey: ["Item", selected?.name],
    queryFn: () => frappe.getDoc<ItemDoc>("Item", selected!.name),
    enabled: !!selected,
  })

  if (fullDoc && fullDoc.name !== syncedName) {
    setSyncedName(fullDoc.name)
    setForm(docToForm(fullDoc))
  }

  if (pendingSelectName) {
    const idx = items.findIndex((i) => i.name === pendingSelectName)
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
    if (idx < 0 || idx >= items.length) return
    setSelectedIndex(idx)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        item_name: form.item_name,
        item_group: form.item_group,
        is_stock_item: form.is_stock_item ? 1 : 0,
        stock_uom: form.stock_uom,
        item_quantity: form.item_quantity ? Number(form.item_quantity) : undefined,
        reorder_quantity: form.reorder_quantity ? Number(form.reorder_quantity) : undefined,
        default_cost: form.default_cost ? Number(form.default_cost) : undefined,
        max_order_qty: form.max_order_qty ? Number(form.max_order_qty) : undefined,
        default_supplier: form.default_supplier || undefined,
      }
      return selected
        ? frappe.updateDoc<ItemDoc>("Item", selected.name, payload)
        : frappe.createDoc<ItemDoc>("Item", { ...payload, item_code: form.item_code })
    },
    onSuccess: async (saved) => {
      toast.success("Item saved")
      setPendingSelectName(saved.name)
      await queryClient.invalidateQueries({ queryKey: ["Item"] })
    },
    onError: (error) => toast.error(`Could not save item: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("Item", selected!.name),
    onSuccess: async () => {
      toast.success("Item deleted")
      await queryClient.invalidateQueries({ queryKey: ["Item"] })
      handleAdd()
    },
    onError: (error) => toast.error(`Could not delete item: ${getErrorMessage(error)}`),
  })

  const canSave = !!form.item_name && !!form.item_group && !!form.stock_uom && (!!selected || !!form.item_code) && !saveMutation.isPending

  // --- Price history (native Item Price, not a child table) ---
  const pricesQuery = useQuery({
    queryKey: ["Item Price", "list", selected?.name],
    queryFn: () =>
      frappe.list<ItemPriceRow>("Item Price", {
        fields: ["name", "supplier", "price_list_rate", "valid_from", "valid_upto"],
        filters: [["item_code", "=", selected!.name], ["buying", "=", 1]],
        order_by: "valid_from desc",
        limit_page_length: 100,
      }),
    enabled: !!selected,
  })
  const prices = pricesQuery.data ?? []

  const [selectedPriceName, setSelectedPriceName] = useState<string | null>(null)
  const [priceForm, setPriceForm] = useState({ supplier: "", rate: "" })
  const [historySupplier, setHistorySupplier] = useState<string | null>(null)

  const addPriceMutation = useMutation({
    mutationFn: () =>
      frappe.createDoc("Item Price", {
        item_code: selected!.name,
        supplier: priceForm.supplier,
        price_list_rate: Number(priceForm.rate) || 0,
        uom: form.stock_uom || undefined,
        price_list: DEFAULT_BUYING_PRICE_LIST,
        buying: 1,
      }),
    onSuccess: async () => {
      toast.success("Price added")
      setPriceForm({ supplier: "", rate: "" })
      await queryClient.invalidateQueries({ queryKey: ["Item Price", "list", selected?.name] })
    },
    onError: (error) => toast.error(`Could not add price: ${getErrorMessage(error)}`),
  })

  const removePriceMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("Item Price", selectedPriceName!),
    onSuccess: async () => {
      toast.success("Price removed")
      setSelectedPriceName(null)
      await queryClient.invalidateQueries({ queryKey: ["Item Price", "list", selected?.name] })
    },
    onError: (error) => toast.error(`Could not remove price: ${getErrorMessage(error)}`),
  })

  const selectedPriceRow = prices.find((p) => p.name === selectedPriceName) ?? null

  const historyQuery = useQuery({
    queryKey: ["Item Price", "history", selected?.name, historySupplier],
    queryFn: () =>
      frappe.list<ItemPriceRow>("Item Price", {
        fields: ["name", "supplier", "price_list_rate", "valid_from", "valid_upto"],
        filters: [["item_code", "=", selected!.name], ["supplier", "=", historySupplier!]],
        order_by: "valid_from desc",
        limit_page_length: 100,
      }),
    enabled: !!selected && !!historySupplier,
  })

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
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-4 md:grid-cols-2 max-w-xl flex-1">
              <Field id="item-code" label="Item Code">
                <Input
                  id="item-code"
                  disabled={!!selected}
                  value={form.item_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, item_code: e.target.value }))}
                />
              </Field>
              <Field id="item-name" label="Item Name">
                <Input
                  id="item-name"
                  value={form.item_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, item_name: e.target.value }))}
                />
              </Field>
            </div>
            <label className="flex shrink-0 items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={viewByEncoderOnly}
                onChange={(e) => setViewByEncoderOnly(e.target.checked)}
              />
              View by Encoder Only
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 max-w-xl">
            <div className="grid gap-1.5">
              <span>Item Type</span>
              <div className="flex gap-6 pt-1.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    className="h-4 w-4"
                    checked={form.is_stock_item}
                    onChange={() => setForm((prev) => ({ ...prev, is_stock_item: true }))}
                  />
                  Consumables
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    className="h-4 w-4"
                    checked={!form.is_stock_item}
                    onChange={() => setForm((prev) => ({ ...prev, is_stock_item: false }))}
                  />
                  Non-Consumables
                </label>
              </div>
            </div>
            <Field id="item-group" label="Item Group">
              <Select
                value={form.item_group}
                onValueChange={(v) => setForm((prev) => ({ ...prev, item_group: v ?? "" }))}
              >
                <SelectTrigger id="item-group" className="w-full">
                  <SelectValue placeholder="Select Item Group" />
                </SelectTrigger>
                <SelectContent>
                  {(itemGroupsQuery.data ?? []).map((g) => (
                    <SelectItem key={g.name} value={g.name}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2 max-w-xl">
            <Field id="item-quantity" label="Item Quantity">
              <Input
                id="item-quantity"
                type="number"
                value={form.item_quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, item_quantity: e.target.value }))}
              />
            </Field>
            <Field id="reorder-qty" label="Reorder Quantity">
              <Input
                id="reorder-qty"
                type="number"
                value={form.reorder_quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, reorder_quantity: e.target.value }))}
              />
            </Field>
            <Field id="item-uom" label="Item Units">
              <Select
                value={form.stock_uom}
                onValueChange={(v) => setForm((prev) => ({ ...prev, stock_uom: v ?? "" }))}
              >
                <SelectTrigger id="item-uom" className="w-full">
                  <SelectValue placeholder="Select Unit" />
                </SelectTrigger>
                <SelectContent>
                  {(uomsQuery.data ?? []).map((u) => (
                    <SelectItem key={u.name} value={u.name}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="item-cost" label="Item Cost">
              <Input
                id="item-cost"
                type="number"
                value={form.default_cost}
                onChange={(e) => setForm((prev) => ({ ...prev, default_cost: e.target.value }))}
              />
            </Field>
            <Field id="item-supplier" label="Supplier">
              <Select
                value={form.default_supplier}
                onValueChange={(v) => setForm((prev) => ({ ...prev, default_supplier: v ?? "" }))}
              >
                <SelectTrigger id="item-supplier" className="w-full">
                  <SelectValue placeholder="Select Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.supplier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="max-order" label="Maximum Order">
              <Input
                id="max-order"
                type="number"
                value={form.max_order_qty}
                onChange={(e) => setForm((prev) => ({ ...prev, max_order_qty: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid gap-3 rounded-md border p-4">
            <span className="text-sm font-semibold text-muted-foreground">Supplier Price History</span>

            {!selected && (
              <p className="text-xs text-muted-foreground">Save this item before adding supplier prices.</p>
            )}

            {selected && (
              <div className="flex flex-wrap items-end gap-4">
                <Field id="price-supplier" label="Supplier">
                  <Select
                    value={priceForm.supplier}
                    onValueChange={(v) => setPriceForm((prev) => ({ ...prev, supplier: v ?? "" }))}
                  >
                    <SelectTrigger id="price-supplier" className="w-56">
                      <SelectValue placeholder="Select a supplier…" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.supplier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="price-rate" label="Cost">
                  <Input
                    id="price-rate"
                    type="number"
                    className="w-28"
                    value={priceForm.rate}
                    onChange={(e) => setPriceForm((prev) => ({ ...prev, rate: e.target.value }))}
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!priceForm.supplier || !priceForm.rate || addPriceMutation.isPending}
                  onClick={() => addPriceMutation.mutate()}
                >
                  {addPriceMutation.isPending ? "Adding…" : "Add"}
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>supname</TableHead>
                      <TableHead className="text-right">cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prices.map((row) => (
                      <TableRow
                        key={row.name}
                        className="cursor-pointer"
                        data-state={selectedPriceName === row.name ? "selected" : undefined}
                        onClick={() => setSelectedPriceName(row.name)}
                      >
                        <TableCell>{row.supplier ? supplierByName.get(row.supplier)?.supplier_name ?? row.supplier : "—"}</TableCell>
                        <TableCell className="text-right">{row.price_list_rate.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    {prices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No supplier prices on file.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-row gap-2 sm:flex-col">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedPriceRow || removePriceMutation.isPending}
                  onClick={() => removePriceMutation.mutate()}
                >
                  {removePriceMutation.isPending ? "Removing…" : "Remove"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedPriceRow?.supplier}
                  onClick={() => setHistorySupplier(selectedPriceRow!.supplier)}
                >
                  View Price History
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 max-w-2xl rounded-md border p-4">
            <Field id="item-encoder" label="Encoder">
              <Input id="item-encoder" value={fullDoc?.owner ?? "—"} disabled />
            </Field>
            <Field id="item-date-entered" label="Date Entered">
              <Input id="item-date-entered" value={formatDate(fullDoc?.creation)} disabled />
            </Field>
            <Field id="item-date-edited" label="Date Edited">
              <Input id="item-date-edited" value={formatDate(fullDoc?.modified)} disabled />
            </Field>
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="text-sm text-muted-foreground">
          {selectedIndex !== null && items.length > 0
            ? `Record ${selectedIndex + 1} of ${items.length}`
            : "New Item"}
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
            disabled={selectedIndex === null || selectedIndex >= items.length - 1}
            onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={selectedIndex === null || selectedIndex >= items.length - 1}
            onClick={() => selectRecord(items.length - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>

      <Dialog open={!!historySupplier} onOpenChange={(open) => !open && setHistorySupplier(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Price History — {historySupplier ? supplierByName.get(historySupplier)?.supplier_name ?? historySupplier : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Valid From</TableHead>
                  <TableHead>Valid Upto</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(historyQuery.data ?? []).map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.valid_from ?? "—"}</TableCell>
                    <TableCell>{row.valid_upto ?? "—"}</TableCell>
                    <TableCell className="text-right">{row.price_list_rate.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {(historyQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No price history for this supplier.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
