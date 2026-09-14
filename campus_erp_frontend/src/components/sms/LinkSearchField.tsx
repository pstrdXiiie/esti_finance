"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { frappe } from "@/lib/frappe"
import type { FieldSpec } from "@/lib/forms/types"
import { Input } from "@/components/ui/input"

/**
 * Type-to-search combobox for a Link field (spec.searchable: true). Unlike
 * the existing dropdown:true variant (loads every record up front into a
 * plain <Select>), this queries the target doctype live as the user types --
 * needed for doctypes too large to dump into one dropdown (e.g. Student).
 *
 * On selecting a result, calls onSelect with the full result row so the
 * caller (DynamicField) can apply spec.autofill.
 */
export function LinkSearchField({
  spec,
  value,
  disabled,
  onChange,
  onSelect,
}: {
  spec: FieldSpec
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onSelect: (row: Record<string, unknown>) => void
}) {
  const [query, setQuery] = useState(value ?? "")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Tracks the doc name behind the last selection, so the value-sync effect
  // below doesn't clobber a nicer display label with the raw record name
  // right after picking a result.
  const lastAppliedRef = useRef<string | null>(null)

  useEffect(() => {
    if (value !== lastAppliedRef.current) {
      setQuery(value ?? "")
    }
  }, [value])

  const searchFields = spec.searchFields?.length ? spec.searchFields : ["name"]
  const labelFields = spec.linkLabelFields ?? []
  const fetchFields = Array.from(new Set(["name", ...searchFields, ...labelFields]))

  const trimmed = query.trim()
  const searchQuery = useQuery({
    queryKey: ["Link", "search", spec.options, trimmed, fetchFields.join(",")],
    queryFn: () =>
      frappe.list<Record<string, unknown>>(spec.options as string, {
        fields: fetchFields,
        or_filters: searchFields.map(
          (f) => [f, "like", `%${trimmed}%`] as [string, string, unknown]
        ),
        limit_page_length: 20,
      }),
    enabled: open && trimmed.length >= 2,
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function labelFor(row: Record<string, unknown>): string {
    const extra = labelFields.map((f) => row[f]).filter(Boolean)
    return extra.length ? `${extra.join(" ")} (${row.name as string})` : (row.name as string)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query}
        disabled={disabled}
        placeholder={`Search ${spec.label}…`}
        onChange={(e) => {
          const v = e.target.value
          lastAppliedRef.current = null
          setQuery(v)
          onChange(v)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && trimmed.length >= 2 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {searchQuery.isLoading ? (
            <div className="p-2 text-sm text-muted-foreground">Searching…</div>
          ) : (searchQuery.data ?? []).length === 0 ? (
            <div className="p-2 text-sm text-muted-foreground">No matches</div>
          ) : (
            (searchQuery.data ?? []).map((row) => (
              <button
                type="button"
                key={row.name as string}
                className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  const name = row.name as string
                  lastAppliedRef.current = name
                  setQuery(labelFor(row))
                  onChange(name)
                  onSelect(row)
                  setOpen(false)
                }}
              >
                {labelFor(row)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
