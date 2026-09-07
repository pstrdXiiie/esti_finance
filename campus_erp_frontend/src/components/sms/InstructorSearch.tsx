"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { SearchIcon } from "lucide-react"

import { frappe } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface InstructorOption {
  name: string
  instructor_name: string
  department: string | null
  status: string | null
}

/**
 * Shared "find an instructor" control — mirrors StudentSearch's exact UX
 * contract (text input + magnifying-glass button, Enter-key support, a
 * live-typing debounced dropdown of matches, auto-select on a single result
 * only for an explicit Enter/icon search, "No instructor found." on 0, a
 * "Change" link once selected) keyed on Instructor's fields instead of
 * Student's.
 */
export default function InstructorSearch({
  selected,
  onSelect,
  idPrefix,
}: {
  selected: InstructorOption | null
  onSelect: (instructor: InstructorOption | null) => void
  idPrefix: string
}) {
  const [query, setQuery] = useState("")
  const [searchedQuery, setSearchedQuery] = useState("")
  const explicitSearchRef = useRef(false)

  const handleQueryChange = (value: string) => {
    setQuery(value)
    // Clearing is a direct response to this event, not something to debounce.
    if (!value.trim()) setSearchedQuery("")
  }

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return
    const timer = setTimeout(() => {
      explicitSearchRef.current = false
      setSearchedQuery(trimmed)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const instructorQuery = useQuery({
    queryKey: ["Instructor", "search", searchedQuery],
    queryFn: () =>
      frappe.list<InstructorOption>("Instructor", {
        or_filters: [
          ["name", "like", `%${searchedQuery}%`],
          ["instructor_name", "like", `%${searchedQuery}%`],
        ],
        fields: ["name", "instructor_name", "department", "status"],
        limit_page_length: 20,
      }),
    enabled: !!searchedQuery,
  })

  const results = instructorQuery.data ?? []
  const settled =
    !!searchedQuery && instructorQuery.isFetched && !instructorQuery.isFetching
  const notFound = settled && results.length === 0

  useEffect(() => {
    if (settled && results.length === 1 && explicitSearchRef.current) {
      onSelect(results[0])
    }
    // Keyed on the query's data only — `onSelect` is intentionally left out
    // of the deps since the parent may not memoize it, and including it
    // risks re-firing this effect in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructorQuery.data])

  const handleSearch = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    explicitSearchRef.current = true
    if (trimmed === searchedQuery) {
      instructorQuery.refetch()
    } else {
      setSearchedQuery(trimmed)
    }
  }

  const handleChange = () => {
    setQuery("")
    setSearchedQuery("")
    onSelect(null)
  }

  if (selected) {
    return (
      <div className="flex gap-2 items-center">
        <span>
          {selected.instructor_name}
          <span className="text-muted-foreground"> ({selected.name})</span>
        </span>
        <Button type="button" size="sm" variant="link" onClick={handleChange}>
          Change
        </Button>
      </div>
    )
  }

  // Floats over whatever comes after this component rather than pushing it
  // down — the panel is `absolute`, so it needs `relative` on this wrapper
  // as its positioning anchor, and never affects the surrounding layout's
  // own height regardless of how many results (or which status message)
  // it's currently showing.
  const showPanel = !!query.trim() && (instructorQuery.isFetching || settled)

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <Input
          id={`${idPrefix}-instructor-search`}
          className="w-56"
          placeholder="Instructor Name or ID"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleSearch()
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!query.trim() || instructorQuery.isFetching}
          onClick={handleSearch}
          aria-label="Search instructor"
        >
          <SearchIcon />
        </Button>
      </div>

      {showPanel && (
        <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 max-h-64 overflow-y-auto p-1">
          {instructorQuery.isFetching ? (
            <div className="px-2.5 py-1.5 text-sm text-muted-foreground">Searching…</div>
          ) : notFound ? (
            <div className="px-2.5 py-1.5 text-sm text-muted-foreground">No instructor found.</div>
          ) : (
            results.map((option) => (
              <Button
                key={option.name}
                type="button"
                variant="ghost"
                className="w-full justify-start rounded-md hover:bg-accent hover:text-accent-foreground"
                onClick={() => onSelect(option)}
              >
                {option.instructor_name}
                <span className="text-muted-foreground"> ({option.name})</span>
              </Button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
