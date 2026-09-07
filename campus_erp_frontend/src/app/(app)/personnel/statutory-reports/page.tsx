"use client"

import { useState } from "react"
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

const REPORT_TYPES = ["SSS", "PhilHealth", "Withholding Tax"] as const
type ReportType = (typeof REPORT_TYPES)[number]

interface CompanyRow {
  name: string
}

interface BatchRow {
  name: string
  report_type: ReportType
  batch_month: string
  reference_no?: string
  reference_date?: string
}

interface GenerateResult {
  name?: string
  employee_count?: number
  warnings?: string[]
}

interface SssLine {
  employee: string
  sss_number?: string
  monthly_contribution?: number
  ec_contribution?: number
  is_manual_override?: number
  override_remark?: string
}

interface PhilHealthLine {
  employee: string
  philhealth_number?: string
  bracket?: string
  personal_share?: number
  employer_share?: number
  remark?: string
}

interface TaxLine {
  employee: string
  employee_name?: string
  tin_number?: string
  tax_amount?: number
}

interface BatchDoc extends BatchRow {
  sss_lines?: SssLine[]
  philhealth_lines?: PhilHealthLine[]
  tax_lines?: TaxLine[]
}

/**
 * Bespoke screen (doesn't fit Master/Detail, Entry, or Report): a filter
 * panel that calls campus_erp.api.personnel_payroll.generate_statutory_report
 * directly, plus a list of previously-generated SMS Statutory Report Batch
 * records. That doctype is generated, never hand-edited, and has no native
 * Frappe desk view reachable from this app — so instead of a separate detail
 * route, clicking a batch row expands its line-item child table right here.
 */
export default function StatutoryReportsPage() {
  const queryClient = useQueryClient()
  const [reportType, setReportType] = useState<ReportType | "">("")
  const [batchMonth, setBatchMonth] = useState("")
  const [company, setCompany] = useState("")
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)

  const companiesQuery = useQuery({
    queryKey: ["Company", "list"],
    queryFn: () => frappe.list<CompanyRow>("Company", { limit_page_length: 100 }),
  })

  const batchesQuery = useQuery({
    queryKey: ["SMS Statutory Report Batch", "list"],
    queryFn: () =>
      frappe.list<BatchRow>("SMS Statutory Report Batch", {
        fields: ["name", "report_type", "batch_month", "reference_no", "reference_date"],
        order_by: "creation desc",
        limit_page_length: 100,
      }),
  })

  const batchDetailQuery = useQuery({
    queryKey: ["SMS Statutory Report Batch", selectedBatch],
    queryFn: () => frappe.getDoc<BatchDoc>("SMS Statutory Report Batch", selectedBatch!),
    enabled: !!selectedBatch,
  })

  const generateMutation = useMutation({
    mutationFn: () =>
      frappe.call<GenerateResult>(
        "campus_erp.api.personnel_payroll.generate_statutory_report",
        { report_type: reportType, batch_month: batchMonth, company }
      ),
    onSuccess: (result) => {
      toast.success(
        result?.employee_count != null
          ? `Report generated for ${result.employee_count} employee${result.employee_count === 1 ? "" : "s"}.`
          : "Report generated."
      )
      for (const warning of result?.warnings ?? []) {
        toast.warning(warning)
      }
      queryClient.invalidateQueries({ queryKey: ["SMS Statutory Report Batch", "list"] })
      if (result?.name) setSelectedBatch(result.name)
    },
    onError: (error) => toast.error(`Could not generate report: ${getErrorMessage(error)}`),
  })

  const canGenerate = !!reportType && !!batchMonth && !!company && !generateMutation.isPending

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Statutory Reports</h1>
        <p className="text-muted-foreground">
          Generate an SSS, PhilHealth, or Withholding Tax remittance batch for a given month,
          then review previously-generated batches below.
        </p>
      </div>

      <div className="grid gap-3 rounded-md border p-4">
        <h2 className="font-semibold">Generate Report</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid min-w-48 gap-2">
            <label className="text-sm font-medium">Report Type</label>
            <Select
              value={reportType}
              onValueChange={(value) => setReportType((value as ReportType) ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a report type…" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {rt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Batch Month</label>
            <Input
              className="w-36"
              placeholder="2026-08"
              value={batchMonth}
              onChange={(e) => setBatchMonth(e.target.value)}
            />
          </div>
          <div className="grid min-w-48 gap-2">
            <label className="text-sm font-medium">Company</label>
            {companiesQuery.isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Select value={company} onValueChange={(value) => setCompany(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a company…" />
                </SelectTrigger>
                <SelectContent>
                  {(companiesQuery.data ?? []).map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button
            type="button"
            disabled={!canGenerate}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? "Generating…" : "Generate Report"}
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <h2 className="font-semibold">Previously Generated Batches</h2>
        {batchesQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Batch Month</TableHead>
                  <TableHead>Reference No</TableHead>
                  <TableHead>Reference Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(batchesQuery.data ?? []).map((row) => (
                  <TableRow
                    key={row.name}
                    className="cursor-pointer"
                    data-state={selectedBatch === row.name ? "selected" : undefined}
                    onClick={() =>
                      setSelectedBatch((current) => (current === row.name ? null : row.name))
                    }
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.report_type}</Badge>
                    </TableCell>
                    <TableCell>{row.batch_month}</TableCell>
                    <TableCell>{row.reference_no ?? ""}</TableCell>
                    <TableCell>{row.reference_date ?? ""}</TableCell>
                  </TableRow>
                ))}
                {(batchesQuery.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No statutory report batches generated yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedBatch && (
        <>
          <Separator />
          <BatchLinesPanel
            name={selectedBatch}
            isLoading={batchDetailQuery.isLoading}
            doc={batchDetailQuery.data}
          />
        </>
      )}
    </div>
  )
}

/** Renders whichever of sss_lines / philhealth_lines / tax_lines is populated. */
function BatchLinesPanel({
  name,
  isLoading,
  doc,
}: {
  name: string
  isLoading: boolean
  doc?: BatchDoc
}) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />
  }
  if (!doc) {
    return null
  }

  const sssLines = doc.sss_lines ?? []
  const philhealthLines = doc.philhealth_lines ?? []
  const taxLines = doc.tax_lines ?? []

  return (
    <div className="grid gap-2">
      <h2 className="font-semibold">Line Items — {name}</h2>

      {sssLines.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>SSS Number</TableHead>
                <TableHead>Monthly Contribution</TableHead>
                <TableHead>EC Contribution</TableHead>
                <TableHead>Manual Override</TableHead>
                <TableHead>Override Remark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sssLines.map((line, i) => (
                <TableRow key={`${line.employee}-${i}`}>
                  <TableCell>{line.employee}</TableCell>
                  <TableCell>{line.sss_number ?? ""}</TableCell>
                  <TableCell>{line.monthly_contribution ?? ""}</TableCell>
                  <TableCell>{line.ec_contribution ?? ""}</TableCell>
                  <TableCell>{line.is_manual_override ? "Yes" : "No"}</TableCell>
                  <TableCell>{line.override_remark ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {philhealthLines.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>PhilHealth Number</TableHead>
                <TableHead>Bracket</TableHead>
                <TableHead>Personal Share</TableHead>
                <TableHead>Employer Share</TableHead>
                <TableHead>Remark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {philhealthLines.map((line, i) => (
                <TableRow key={`${line.employee}-${i}`}>
                  <TableCell>{line.employee}</TableCell>
                  <TableCell>{line.philhealth_number ?? ""}</TableCell>
                  <TableCell>{line.bracket ?? ""}</TableCell>
                  <TableCell>{line.personal_share ?? ""}</TableCell>
                  <TableCell>{line.employer_share ?? ""}</TableCell>
                  <TableCell>{line.remark ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {taxLines.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead>TIN Number</TableHead>
                <TableHead>Tax Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxLines.map((line, i) => (
                <TableRow key={`${line.employee}-${i}`}>
                  <TableCell>{line.employee}</TableCell>
                  <TableCell>{line.employee_name ?? ""}</TableCell>
                  <TableCell>{line.tin_number ?? ""}</TableCell>
                  <TableCell>{line.tax_amount ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {sssLines.length === 0 && philhealthLines.length === 0 && taxLines.length === 0 && (
        <p className="text-muted-foreground text-sm">This batch has no line items yet.</p>
      )}
    </div>
  )
}
