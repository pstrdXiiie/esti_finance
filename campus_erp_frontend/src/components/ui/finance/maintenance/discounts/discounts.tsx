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
  SearchIcon,
} from "lucide-react"

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

type DiscountMode = "Fixed Amount" | "Percentage"
type TFBase = "Tuition Only" | "Tuition + Misc"

interface DiscountRow {
  name: string
  discount_code: string
  description: string
  tf_discount_mode: DiscountMode
  tf_discount_value: number | null
  misc_discount_mode: DiscountMode
  misc_discount_value: number | null
  on_tf: 0 | 1
  tf_base: TFBase | null
  is_disabled: 0 | 1
}

interface DiscountFormState {
  discount_code: string
  description: string
  tf_discount_mode: DiscountMode
  tf_discount_value: string
  misc_discount_mode: DiscountMode
  misc_discount_value: string
  on_tf: boolean
  tf_base: TFBase
  is_disabled: boolean
}

const DISCOUNT_MODES: DiscountMode[] = ["Fixed Amount", "Percentage"]
const TF_BASES: TFBase[] = ["Tuition Only", "Tuition + Misc"]

const BLANK_FORM: DiscountFormState = {
  discount_code: "",
  description: "",
  tf_discount_mode: "Fixed Amount",
  tf_discount_value: "",
  misc_discount_mode: "Fixed Amount",
  misc_discount_value: "",
  on_tf: false,
  tf_base: "Tuition Only",
  is_disabled: false,
}

function docToForm(doc: DiscountRow): DiscountFormState {
  return {
    discount_code: doc.discount_code ?? "",
    description: doc.description ?? "",
    tf_discount_mode: doc.tf_discount_mode ?? "Fixed Amount",
    tf_discount_value: doc.tf_discount_value != null ? String(doc.tf_discount_value) : "",
    misc_discount_mode: doc.misc_discount_mode ?? "Fixed Amount",
    misc_discount_value: doc.misc_discount_value != null ? String(doc.misc_discount_value) : "",
    on_tf: !!doc.on_tf,
    tf_base: doc.tf_base ?? "Tuition Only",
    is_disabled: !!doc.is_disabled,
  }
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
 * "Discounts" (Finance > Maintenance tab): SMS Discount browsed one record
 * at a time, matching the Add/Edit/Delete/Find toolbar convention of every
 * other Maintenance screen. on_tf/tf_base only affect
 * campus_erp.api.finance_billing.compute_discount's math when the Tuition
 * Fee mode is Percentage, so they're only shown then.
 */
export default function Discounts() {
  const queryClient = useQueryClient()

  const discountsQuery = useQuery({
    queryKey: ["SMS Discount", "list", "maintenance"],
    queryFn: () =>
      frappe.list<DiscountRow>("SMS Discount", {
        fields: [
          "name",
          "discount_code",
          "description",
          "tf_discount_mode",
          "tf_discount_value",
          "misc_discount_mode",
          "misc_discount_value",
          "on_tf",
          "tf_base",
          "is_disabled",
        ],
        order_by: "discount_code asc",
        limit_page_length: 500,
      }),
  })

  const discounts = discountsQuery.data ?? []

  const [initialized, setInitialized] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<DiscountFormState>(BLANK_FORM)
  const [isEditing, setIsEditing] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findOpen, setFindOpen] = useState(false)

  if (!initialized && discounts.length > 0) {
    setInitialized(true)
    setSelectedIndex(0)
  }

  const selected = selectedIndex !== null ? discounts[selectedIndex] : null

  if (selected && selected.name !== syncedName) {
    setSyncedName(selected.name)
    setForm(docToForm(selected))
  }

  if (pendingSelectName) {
    const idx = discounts.findIndex((d) => d.name === pendingSelectName)
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
    setForm(docToForm(selected))
    setIsEditing(true)
  }

  function handleCancel() {
    if (selected) {
      setForm(docToForm(selected))
    } else {
      setForm(BLANK_FORM)
    }
    setIsEditing(false)
  }

  function selectRecord(idx: number) {
    if (idx < 0 || idx >= discounts.length) return
    setSelectedIndex(idx)
  }

  const findMatches = findQuery.trim()
    ? discounts.filter(
        (d) =>
          d.discount_code?.toLowerCase().includes(findQuery.trim().toLowerCase()) ||
          d.description?.toLowerCase().includes(findQuery.trim().toLowerCase())
      )
    : []

  function jumpToDiscount(name: string) {
    const idx = discounts.findIndex((d) => d.name === name)
    if (idx !== -1) setSelectedIndex(idx)
    setFindOpen(false)
  }

  function handleFind() {
    const query = findQuery.trim().toLowerCase()
    if (!query) return
    const idx = discounts.findIndex(
      (d) =>
        d.discount_code?.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query)
    )
    if (idx === -1) {
      toast.info(`No discount found matching "${findQuery}"`)
      return
    }
    setSelectedIndex(idx)
    setFindOpen(false)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        discount_code: form.discount_code,
        description: form.description,
        tf_discount_mode: form.tf_discount_mode,
        tf_discount_value: form.tf_discount_value ? Number(form.tf_discount_value) : 0,
        misc_discount_mode: form.misc_discount_mode,
        misc_discount_value: form.misc_discount_value ? Number(form.misc_discount_value) : 0,
        on_tf: form.tf_discount_mode === "Percentage" && form.on_tf ? 1 : 0,
        tf_base: form.tf_discount_mode === "Percentage" ? form.tf_base : "Tuition Only",
        is_disabled: form.is_disabled ? 1 : 0,
      }
      return selected
        ? frappe.updateDoc<DiscountRow>("SMS Discount", selected.name, payload)
        : frappe.createDoc<DiscountRow>("SMS Discount", payload)
    },
    onSuccess: async (saved) => {
      toast.success("Discount saved")
      setPendingSelectName(saved.name)
      setIsEditing(false)
      await queryClient.invalidateQueries({ queryKey: ["SMS Discount"] })
    },
    onError: (error) => toast.error(`Could not save discount: ${getErrorMessage(error)}`),
  })

  const deleteMutation = useMutation({
    mutationFn: () => frappe.deleteDoc("SMS Discount", selected!.name),
    onSuccess: async () => {
      toast.success("Discount deleted")
      setSelectedIndex(null)
      setSyncedName(undefined)
      setForm(BLANK_FORM)
      await queryClient.invalidateQueries({ queryKey: ["SMS Discount"] })
    },
    onError: (error) => toast.error(`Could not delete discount: ${getErrorMessage(error)}`),
  })

  const canSave = !!form.discount_code && !!form.description && !saveMutation.isPending

  return (
    <div className="rounded-2xl border border-black/20 h-full p-6 grid gap-5 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 pb-4">
        <Button type="button" disabled={isEditing} onClick={handleAdd}>
          <PlusIcon /> Add
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
          <Trash2Icon /> Delete
        </Button>

        <div
          className="relative flex items-center gap-2 ml-4"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFindOpen(false)
          }}
        >
          <Input
            placeholder="Find by code or description…"
            className="w-64"
            value={findQuery}
            disabled={isEditing}
            onChange={(e) => {
              setFindQuery(e.target.value)
              setFindOpen(true)
            }}
            onFocus={() => setFindOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleFind()
              } else if (e.key === "Escape") {
                setFindOpen(false)
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" disabled={isEditing} onClick={handleFind}>
            <SearchIcon />
          </Button>

          {findOpen && findQuery.trim() && !isEditing && (
            <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 max-h-64 overflow-y-auto p-1">
              {findMatches.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No matches.</div>
              ) : (
                findMatches.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    className="w-full text-left rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => jumpToDiscount(d.name)}
                  >
                    {d.discount_code} — {d.description}
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

      <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
        <Field id="discount-code" label="Discount Code">
          <Input
            id="discount-code"
            value={form.discount_code}
            disabled={!isEditing || !!selected}
            onChange={(e) => setForm((prev) => ({ ...prev, discount_code: e.target.value }))}
          />
        </Field>
        <Field id="discount-description" label="Description">
          <Input
            id="discount-description"
            value={form.description}
            disabled={!isEditing}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </Field>

        <Field id="tf-discount-mode" label="Tuition Fee Discount Mode">
          <Select
            value={form.tf_discount_mode}
            disabled={!isEditing}
            onValueChange={(v) =>
              setForm((prev) => ({ ...prev, tf_discount_mode: (v as DiscountMode) ?? "Fixed Amount" }))
            }
          >
            <SelectTrigger id="tf-discount-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCOUNT_MODES.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          id="tf-discount-value"
          label={form.tf_discount_mode === "Percentage" ? "Tuition Fee Discount Value (%)" : "Tuition Fee Discount Value"}
        >
          <Input
            id="tf-discount-value"
            type="number"
            value={form.tf_discount_value}
            disabled={!isEditing}
            onChange={(e) => setForm((prev) => ({ ...prev, tf_discount_value: e.target.value }))}
          />
        </Field>

        {form.tf_discount_mode === "Percentage" && (
          <>
            <Field id="on-tf" label="Base Includes Misc Fee">
              <div className="flex h-9 items-center">
                <input
                  id="on-tf"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.on_tf}
                  disabled={!isEditing}
                  onChange={(e) => setForm((prev) => ({ ...prev, on_tf: e.target.checked }))}
                />
              </div>
            </Field>
            {form.on_tf && (
              <Field id="tf-base" label="Percentage Base">
                <Select
                  value={form.tf_base}
                  disabled={!isEditing}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, tf_base: (v as TFBase) ?? "Tuition Only" }))}
                >
                  <SelectTrigger id="tf-base" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TF_BASES.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </>
        )}

        <Field id="misc-discount-mode" label="Misc Fee Discount Mode">
          <Select
            value={form.misc_discount_mode}
            disabled={!isEditing}
            onValueChange={(v) =>
              setForm((prev) => ({ ...prev, misc_discount_mode: (v as DiscountMode) ?? "Fixed Amount" }))
            }
          >
            <SelectTrigger id="misc-discount-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCOUNT_MODES.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          id="misc-discount-value"
          label={form.misc_discount_mode === "Percentage" ? "Misc Fee Discount Value (%)" : "Misc Fee Discount Value"}
        >
          <Input
            id="misc-discount-value"
            type="number"
            value={form.misc_discount_value}
            disabled={!isEditing}
            onChange={(e) => setForm((prev) => ({ ...prev, misc_discount_value: e.target.value }))}
          />
        </Field>

        <Field id="is-disabled" label="Disabled">
          <div className="flex h-9 items-center">
            <input
              id="is-disabled"
              type="checkbox"
              className="h-4 w-4"
              checked={form.is_disabled}
              disabled={!isEditing}
              onChange={(e) => setForm((prev) => ({ ...prev, is_disabled: e.target.checked }))}
            />
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-black/10 pt-4 mt-auto">
        <div className="text-sm text-muted-foreground">
          {selectedIndex !== null && discounts.length > 0
            ? `Record ${selectedIndex + 1} of ${discounts.length}`
            : "New Discount"}
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
            disabled={isEditing || selectedIndex === null || selectedIndex >= discounts.length - 1}
            onClick={() => selectRecord((selectedIndex ?? -1) + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={isEditing || selectedIndex === null || selectedIndex >= discounts.length - 1}
            onClick={() => selectRecord(discounts.length - 1)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
