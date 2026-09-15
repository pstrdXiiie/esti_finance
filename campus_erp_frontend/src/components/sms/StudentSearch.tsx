"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { SearchIcon } from "lucide-react"

import { frappe } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface StudentOption {
  name: string
  student_name: string
  stdnt_cno: string | null
}

export function studentDisplayName(s: StudentOption): string {
  return s.student_name
}

/**
 * Shared "find a student" control for the enrollment tabs (Pre-Enrollment,
 * Add/Remove Subjects, Withdrawal of Enrollment) — replaces each tab's
 * previously-duplicated exact-control-number search with one componentthat
 * matches on control number OR name (via `frappe.list`'s `or_filters`)and,
 * unlike the old per-tab copies, lets the registrar clear a resolved student
 * and search again without reloading the tab.
 *
 * Results appear live as the registrar types (debounced, so every keystroke
 * doesn't fire a request) rather than requiring Enter/the search icon first
 * — those still work for an immediate, un-debounced search. Auto-selecting
 * a single match only happens on that explicit search; while live-typing,
 * even a single current match is shown as a click target rather than
 * auto-selected, since an in-progress query narrowing to one match doesn't
 * mean that's actually the intended student yet.
 */
export default function StudentSearch({
  selected,
  onSelect,
  idPrefix,
}: {
  selected: StudentOption | null
  onSelect: (student: StudentOption | null) => void
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

  const studentQuery = useQuery({
    queryKey: ["Student", "search", searchedQuery],
    queryFn: () =>
      frappe.list<StudentOption>("Student", {
        or_filters: [
          ["stdnt_cno", "like", `%${searchedQuery}%`],
          ["student_name", "like", `%${searchedQuery}%`],
        ],
        fields: ["name", "student_name", "stdnt_cno"],
        limit_page_length: 20,
      }),
    enabled: !!searchedQuery,
  })

  const results = studentQuery.data ?? []
  const settled =
    !!searchedQuery && studentQuery.isFetched && !studentQuery.isFetching
  const notFound = settled && results.length === 0

  useEffect(() => {
    if (settled && results.length === 1 && explicitSearchRef.current) {
      onSelect(results[0])
    }
    // Keyed on the query's data only — `onSelect` is intentionally left out
    // of the deps since the parent may not memoize it, and including it
    // risks re-firing this effect in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentQuery.data])

  const handleSearch = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    explicitSearchRef.current = true
    if (trimmed === searchedQuery) {
      studentQuery.refetch()
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
          {studentDisplayName(selected)}
          {selected.stdnt_cno ? (
            <span className="text-muted-foreground"> ({selected.stdnt_cno})</span>
          ) : null}
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
  const showPanel = !!query.trim() && (studentQuery.isFetching || settled)

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <Input
          id={`${idPrefix}-student-search`}
          className="min-w-0 flex-1"
          placeholder="Student No. or Name"
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
          disabled={!query.trim() || studentQuery.isFetching}
          onClick={handleSearch}
          aria-label="Search student"
        >
          <SearchIcon />
        </Button>
      </div>

      {showPanel && (
        <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 max-h-64 overflow-y-auto p-1">
          {studentQuery.isFetching ? (
            <div className="px-2.5 py-1.5 text-sm text-muted-foreground">Searching…</div>
          ) : notFound ? (
            <div className="px-2.5 py-1.5 text-sm text-muted-foreground">No student found.</div>
          ) : (
            results.map((option) => (
              <Button
                key={option.name}
                type="button"
                variant="ghost"
                className="w-full justify-start rounded-md hover:bg-accent hover:text-accent-foreground"
                onClick={() => onSelect(option)}
              >
                {studentDisplayName(option)}
                {option.stdnt_cno ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({option.stdnt_cno})
                  </span>
                ) : null}
              </Button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
