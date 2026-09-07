"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type BorrowerType = "Student" | "Guest"

interface StudentRow {
  name: string
  student_name: string
}

interface GuestRow {
  name: string
  last_name: string
  first_name: string
}

interface CatalogTitle {
  name: string
  title: string
  available_copies: number
}

interface AvailableBookRow {
  name: string
  accession_no: number
  call_no?: string
}

interface BookDirectoryRow {
  name: string
  accession_no: number
}

interface EligibilityResult {
  ok: boolean
  reason: string | null
}

interface BorrowRequestRow {
  name: string
  borrower_type: BorrowerType
  student?: string
  guest?: string
  book: string
  request_date: string
}

interface LoanRow {
  name: string
  book: string
  borrower_type: BorrowerType
  student?: string
  guest?: string
  date_approved: string
  date_due: string
}

const PENDING_REQUESTS_KEY = ["SMS Library Borrow Request", "list", "pending"]
const OUTSTANDING_LOANS_KEY = ["SMS Library Loan", "list", "outstanding"]

/**
 * Bespoke screen (doesn't fit Master/Detail, Entry, or Report): the
 * librarian's day-to-day circulation desk — create a borrow request with a
 * live eligibility pre-check, approve/reject the pending queue, and close out
 * outstanding loans. Fronts campus_erp.api.library.* directly rather than one
 * DocType's plain CRUD, mirroring registrar/enrollment/page.tsx's structure.
 *
 * Kiosk terminal login/logout (kiosk_login/kiosk_logout/force_logout_kiosk)
 * is out of scope for this screen — no frontend for that exists yet.
 */
export default function CirculationPage() {
  const queryClient = useQueryClient()

  // --- New Borrow Request panel state ---
  const [borrowerType, setBorrowerType] = useState<BorrowerType>("Student")
  const [borrower, setBorrower] = useState("")
  const [catalogSearchInput, setCatalogSearchInput] = useState("")
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("")
  const [selectedTitle, setSelectedTitle] = useState("")
  const [selectedBook, setSelectedBook] = useState("")
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null)

  // --- Per-row transient input state for the two tables below ---
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [orNumbers, setOrNumbers] = useState<Record<string, string>>({})

  const studentsQuery = useQuery({
    queryKey: ["Student", "list", "circulation"],
    queryFn: () =>
      frappe.list<StudentRow>("Student", {
        fields: ["name", "student_name"],
        limit_page_length: 500,
      }),
  })

  const guestsQuery = useQuery({
    queryKey: ["SMS Library Guest", "list", "circulation"],
    queryFn: () =>
      frappe.list<GuestRow>("SMS Library Guest", {
        fields: ["name", "last_name", "first_name"],
        limit_page_length: 500,
      }),
  })

  const catalogQuery = useQuery({
    queryKey: ["library-catalog-search", catalogSearchTerm],
    queryFn: () =>
      frappe.call<CatalogTitle[]>("campus_erp.api.library.search_catalog", {
        query: catalogSearchTerm || undefined,
      }),
  })

  const availableBooksQuery = useQuery({
    queryKey: ["SMS Library Book", "available", selectedTitle],
    queryFn: () =>
      frappe.list<AvailableBookRow>("SMS Library Book", {
        fields: ["name", "accession_no", "call_no"],
        filters: { title: selectedTitle, current_status: "Available" },
        limit_page_length: 100,
      }),
    enabled: !!selectedTitle,
  })

  // Lightweight directory (accession numbers only) purely so the two tables
  // below can show a human-readable book label instead of a raw record id.
  const bookDirectoryQuery = useQuery({
    queryKey: ["SMS Library Book", "list", "accession-directory"],
    queryFn: () =>
      frappe.list<BookDirectoryRow>("SMS Library Book", {
        fields: ["name", "accession_no"],
        limit_page_length: 1000,
      }),
  })

  const pendingQuery = useQuery({
    queryKey: PENDING_REQUESTS_KEY,
    queryFn: () =>
      frappe.list<BorrowRequestRow>("SMS Library Borrow Request", {
        filters: { status: "Pending" },
        fields: ["name", "borrower_type", "student", "guest", "book", "request_date"],
        order_by: "request_date asc",
        limit_page_length: 100,
      }),
  })

  const outstandingQuery = useQuery({
    queryKey: OUTSTANDING_LOANS_KEY,
    queryFn: () =>
      frappe.list<LoanRow>("SMS Library Loan", {
        filters: { status: "Outstanding" },
        fields: ["name", "book", "borrower_type", "student", "guest", "date_approved", "date_due"],
        order_by: "date_due asc",
        limit_page_length: 100,
      }),
  })

  const studentNameMap = useMemo(
    () => Object.fromEntries((studentsQuery.data ?? []).map((s) => [s.name, s.student_name])),
    [studentsQuery.data]
  )
  const guestNameMap = useMemo(
    () =>
      Object.fromEntries(
        (guestsQuery.data ?? []).map((g) => [g.name, `${g.last_name}, ${g.first_name}`])
      ),
    [guestsQuery.data]
  )
  const bookLabelMap = useMemo(
    () =>
      Object.fromEntries(
        (bookDirectoryQuery.data ?? []).map((b) => [b.name, `Acc# ${b.accession_no}`])
      ),
    [bookDirectoryQuery.data]
  )

  function borrowerLabel(row: { borrower_type: BorrowerType; student?: string; guest?: string }) {
    if (row.borrower_type === "Student") {
      return studentNameMap[row.student ?? ""] ?? row.student ?? ""
    }
    return guestNameMap[row.guest ?? ""] ?? row.guest ?? ""
  }

  function bookLabel(book: string) {
    return bookLabelMap[book] ?? book
  }

  function invalidatePending() {
    queryClient.invalidateQueries({ queryKey: PENDING_REQUESTS_KEY })
  }
  function invalidateOutstanding() {
    queryClient.invalidateQueries({ queryKey: OUTSTANDING_LOANS_KEY })
  }
  function invalidateAvailableBooks() {
    queryClient.invalidateQueries({ queryKey: ["SMS Library Book", "available"] })
    queryClient.invalidateQueries({ queryKey: ["SMS Library Book", "list", "accession-directory"] })
  }

  const checkMutation = useMutation({
    mutationFn: () =>
      frappe.call<EligibilityResult>("campus_erp.api.library.check_borrow_eligibility", {
        borrower_type: borrowerType,
        borrower,
        book: selectedBook,
      }),
    onSuccess: setEligibility,
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      frappe.call<{ name: string }>("campus_erp.api.library.create_borrow_request", {
        borrower_type: borrowerType,
        borrower,
        book: selectedBook,
      }),
    onSuccess: (result) => {
      toast.success(`Borrow request ${result.name} created`)
      setBorrower("")
      setSelectedTitle("")
      setSelectedBook("")
      setEligibility(null)
      invalidatePending()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const approveMutation = useMutation({
    mutationFn: (request: string) =>
      frappe.call<{ loan: string }>("campus_erp.api.library.approve_borrow_request", { request }),
    onSuccess: (result) => {
      toast.success(`Loan ${result.loan} created`)
      invalidatePending()
      invalidateOutstanding()
      invalidateAvailableBooks()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ request, reason }: { request: string; reason?: string }) =>
      frappe.call<{ name: string }>("campus_erp.api.library.reject_borrow_request", {
        request,
        reason,
      }),
    onSuccess: (_result, variables) => {
      toast.success(`Request ${variables.request} rejected`)
      setRejectReasons((prev) => {
        const next = { ...prev }
        delete next[variables.request]
        return next
      })
      invalidatePending()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const returnMutation = useMutation({
    mutationFn: ({ loan, or_number }: { loan: string; or_number?: string }) =>
      frappe.call<{ overdue_days: number; fine_amount: number }>(
        "campus_erp.api.library.return_loan",
        { loan, or_number }
      ),
    onSuccess: (result, variables) => {
      toast.success(
        result.overdue_days > 0
          ? `Returned — ${result.overdue_days} day(s) overdue, fine ₱${result.fine_amount.toFixed(2)}`
          : "Returned on time, no fine due"
      )
      setOrNumbers((prev) => {
        const next = { ...prev }
        delete next[variables.loan]
        return next
      })
      invalidateOutstanding()
      invalidateAvailableBooks()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Circulation Desk</h1>
        <p className="text-muted-foreground">
          Create a borrow request, work the pending queue, and close out outstanding loans.
        </p>
      </div>

      <div className="grid gap-3 rounded-md border p-4">
        <h2 className="font-semibold">New Borrow Request</h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-40 gap-2">
            <label className="text-sm font-medium">Borrower Type</label>
            <Select
              value={borrowerType}
              onValueChange={(value) => {
                setBorrowerType((value as BorrowerType) ?? "Student")
                setBorrower("")
                setEligibility(null)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Student">Student</SelectItem>
                <SelectItem value="Guest">Guest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-64 gap-2">
            <label className="text-sm font-medium">Borrower</label>
            {(borrowerType === "Student" ? studentsQuery.isLoading : guestsQuery.isLoading) ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Select
                value={borrower}
                onValueChange={(value) => {
                  setBorrower(value ?? "")
                  setEligibility(null)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Select a ${borrowerType.toLowerCase()}…`} />
                </SelectTrigger>
                <SelectContent>
                  {borrowerType === "Student"
                    ? (studentsQuery.data ?? []).map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.student_name}
                        </SelectItem>
                      ))
                    : (guestsQuery.data ?? []).map((g) => (
                        <SelectItem key={g.name} value={g.name}>
                          {g.last_name}, {g.first_name}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-64 gap-2">
            <label className="text-sm font-medium">Search Catalog</label>
            <div className="flex gap-2">
              <Input
                placeholder="Title, ISBN, or category…"
                value={catalogSearchInput}
                onChange={(e) => setCatalogSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    setCatalogSearchTerm(catalogSearchInput.trim())
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={catalogQuery.isFetching}
                onClick={() => setCatalogSearchTerm(catalogSearchInput.trim())}
              >
                Search
              </Button>
            </div>
          </div>

          <div className="grid min-w-64 gap-2">
            <label className="text-sm font-medium">Title</label>
            {catalogQuery.isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Select
                value={selectedTitle}
                onValueChange={(value) => {
                  setSelectedTitle(value ?? "")
                  setSelectedBook("")
                  setEligibility(null)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a title…" />
                </SelectTrigger>
                <SelectContent>
                  {(catalogQuery.data ?? []).map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.title} — {t.available_copies} available
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid min-w-56 gap-2">
            <label className="text-sm font-medium">Copy</label>
            <Select
              value={selectedBook}
              disabled={!selectedTitle}
              onValueChange={(value) => {
                setSelectedBook(value ?? "")
                setEligibility(null)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={selectedTitle ? "Select a copy…" : "Select a title first…"}
                />
              </SelectTrigger>
              <SelectContent>
                {(availableBooksQuery.data ?? []).map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    Acc# {b.accession_no}
                    {b.call_no ? ` — ${b.call_no}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!borrower || !selectedBook || checkMutation.isPending}
            onClick={() => checkMutation.mutate()}
          >
            {checkMutation.isPending ? "Checking…" : "Check Eligibility"}
          </Button>
          <Button
            type="button"
            disabled={!borrower || !selectedBook || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creating…" : "Create Request"}
          </Button>
          {eligibility && (
            <p className={eligibility.ok ? "text-sm text-green-600" : "text-sm text-destructive"}>
              {eligibility.ok ? "Eligible to borrow." : eligibility.reason}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <h2 className="font-semibold">Pending Requests</h2>
        {pendingQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Book</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Reason (if rejecting)</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pendingQuery.data ?? []).map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.borrower_type}</Badge>
                    </TableCell>
                    <TableCell>{borrowerLabel(row)}</TableCell>
                    <TableCell>{bookLabel(row.book)}</TableCell>
                    <TableCell>{row.request_date}</TableCell>
                    <TableCell>
                      <Input
                        className="w-40"
                        placeholder="Reason…"
                        value={rejectReasons[row.name] ?? ""}
                        onChange={(e) =>
                          setRejectReasons((prev) => ({ ...prev, [row.name]: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(row.name)}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={rejectMutation.isPending}
                        onClick={() =>
                          rejectMutation.mutate({
                            request: row.name,
                            reason: rejectReasons[row.name]?.trim() || undefined,
                          })
                        }
                      >
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(pendingQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No pending requests.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <h2 className="font-semibold">Outstanding Loans</h2>
        {outstandingQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Book</TableHead>
                  <TableHead>Date Approved</TableHead>
                  <TableHead>Date Due</TableHead>
                  <TableHead>OR Number</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(outstandingQuery.data ?? []).map((row) => {
                  const overdue = row.date_due < todayStr
                  return (
                    <TableRow key={row.name}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.borrower_type}</Badge>
                      </TableCell>
                      <TableCell>{borrowerLabel(row)}</TableCell>
                      <TableCell>{bookLabel(row.book)}</TableCell>
                      <TableCell>{row.date_approved}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {row.date_due}
                          {overdue && <Badge variant="destructive">Overdue</Badge>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-32"
                          placeholder="OR number"
                          value={orNumbers[row.name] ?? ""}
                          onChange={(e) =>
                            setOrNumbers((prev) => ({ ...prev, [row.name]: e.target.value }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          disabled={returnMutation.isPending}
                          onClick={() =>
                            returnMutation.mutate({
                              loan: row.name,
                              or_number: orNumbers[row.name]?.trim() || undefined,
                            })
                          }
                        >
                          Return
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {(outstandingQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No outstanding loans.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
