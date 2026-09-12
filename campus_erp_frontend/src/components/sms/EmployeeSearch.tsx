"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { SearchIcon } from "lucide-react"

import { frappe } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface EmployeeOption {
    name: string
    employee_id: string | null
    first_name: string
    last_name: string
}

/**
 * Shared "find an employee" control — structural copy of StudentSearch.tsx
 * (same debounce/explicit-search/auto-select contract), adapted for
 * Personnel Info's fields: there's no single combined name field like
 * Student's student_name, so the display label is first_name + last_name,
 * and the lookup key shown alongside it is employee_id instead of
 * stdnt_cno. Everything else — query/searchedQuery state, the 300ms
 * debounce, explicitSearchRef gating auto-select to only an explicit
 * Enter/icon search, the "Change" link once resolved, the floating
 * absolute dropdown panel — is unchanged from StudentSearch.
 */
export default function EmployeeSearch({
    selected,
    onSelect,
    idPrefix,
}: {
    selected: EmployeeOption | null
    onSelect: (employee: EmployeeOption | null) => void
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

    const employeeQuery = useQuery({
        queryKey: ["Personnel Info", "search", searchedQuery],
        queryFn: () =>
            frappe.list<EmployeeOption>("Personnel Info", {
                or_filters: [
                    ["employee_id", "like", `%${searchedQuery}%`],
                    ["first_name", "like", `%${searchedQuery}%`],
                    ["last_name", "like", `%${searchedQuery}%`],
                ],
                fields: ["name", "employee_id", "first_name", "last_name"],
                limit_page_length: 20,
            }),
        enabled: !!searchedQuery,
    })

    const results = employeeQuery.data ?? []
    const settled =
        !!searchedQuery && employeeQuery.isFetched && !employeeQuery.isFetching
    const notFound = settled && results.length === 0

    useEffect(() => {
        if (settled && results.length === 1 && explicitSearchRef.current) {
            onSelect(results[0])
        }
        // Keyed on the query's data only — `onSelect` is intentionally left out
        // of the deps since the parent may not memoize it, and including it
        // risks re-firing this effect in a loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeQuery.data])

    const handleSearch = () => {
        const trimmed = query.trim()
        if (!trimmed) return
        explicitSearchRef.current = true
        if (trimmed === searchedQuery) {
            employeeQuery.refetch()
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
                    {selected.first_name} {selected.last_name}
                    {selected.employee_id ? (
                        <span className="text-muted-foreground"> ({selected.employee_id})</span>
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
    const showPanel = !!query.trim() && (employeeQuery.isFetching || settled)

    return (
        <div className="relative flex flex-col gap-2">
            <div className="flex gap-2 items-center">
                <Input
                    id={`${idPrefix}-employee-search`}
                    className="w-56"
                    placeholder="Employee ID or Name"
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
                    disabled={!query.trim() || employeeQuery.isFetching}
                    onClick={handleSearch}
                    aria-label="Search employee"
                >
                    <SearchIcon />
                </Button>
            </div>

            {showPanel && (
                <div className="absolute top-full left-0 z-20 mt-1 w-64 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 max-h-64 overflow-y-auto p-1">
                    {employeeQuery.isFetching ? (
                        <div className="px-2.5 py-1.5 text-sm text-muted-foreground">Searching…</div>
                    ) : notFound ? (
                        <div className="px-2.5 py-1.5 text-sm text-muted-foreground">No employee found.</div>
                    ) : (
                        results.map((option) => (
                            <Button
                                key={option.name}
                                type="button"
                                variant="ghost"
                                className="w-full justify-start rounded-md hover:bg-accent hover:text-accent-foreground"
                                onClick={() => onSelect(option)}
                            >
                                {option.first_name} {option.last_name}
                                {option.employee_id ? (
                                    <span className="text-muted-foreground">
                                        {" "}
                                        ({option.employee_id})
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