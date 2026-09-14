"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Save, Trash2, Printer, Search } from "lucide-react"

import { frappe } from "@/lib/frappe"
import { financeRowInput, financeRowSelect, financeBalanceBadge } from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"
import { FinanceRecordTable, type FinanceRecordColumn } from "@/components/sms/FinanceRecordTable"
import { FinanceVoucherToolbar, type FinanceToolbarAction } from "@/components/sms/FinanceVoucherToolbar"

// Rebuilt from two screenshots of the legacy "Accounts Payable" screen —
// they're one form: the due-payables grid + voucher fields on top, GL
// entries at the bottom. Backed by "SMS Due Purchase Order Payable" /
// "SMS Due Purchase Order Payable GL Entry" (see
// apps/campus_erp/campus_erp/finance/doctype/) and the
// campus_erp.api.finance.get_due_purchase_order_payables RPC. Column
// headers below (ponum, supcode, supname, podate, date_posted, sinum,
// poterms, potax, poamount, aging) are taken verbatim from the legacy
// grid header text — confirm they match your real PO fields.

interface DuePayableRow {
  ponum: string
  supcode: string
  supname: string
  podate: string
  date_posted: string
  sinum: string
  poterms: string
  potax: number
  poamount: number
  aging: number
}

interface ChartOfAccountRow {
  name: string
  account_number: string
  account_name: string
}

interface GLRow {
  account: string
  account_number: string
  account_name: string
  debit: number
  credit: number
}

const today = () => new Date().toISOString().slice(0, 10)

const dueColumns: FinanceRecordColumn<DuePayableRow>[] = [
  { key: "ponum", label: "ponum", render: (r) => <span className="font-medium text-foreground">{r.ponum}</span> },
  { key: "supcode", label: "supcode", render: (r) => <span className="text-muted-foreground">{r.supcode}</span> },
  { key: "supname", label: "supname", render: (r) => <span className="text-muted-foreground">{r.supname}</span> },
  { key: "podate", label: "podate", render: (r) => <span className="text-muted-foreground">{r.podate}</span> },
  { key: "date_posted", label: "date_posted", render: (r) => <span className="text-muted-foreground">{r.date_posted}</span> },
  { key: "sinum", label: "sinum", render: (r) => <span className="text-muted-foreground">{r.sinum}</span> },
  { key: "poterms", label: "poterms", render: (r) => <span className="text-muted-foreground">{r.poterms}</span> },
  { key: "potax", label: "potax", align: "right", render: (r) => Number(r.potax).toFixed(2) },
  { key: "poamount", label: "poamount", align: "right", render: (r) => Number(r.poamount).toFixed(2) },
  { key: "aging", label: "aging", align: "right", render: (r) => r.aging },
]

export default function AccountsPayablePage() {
  const [supplierFilter, setSupplierFilter] = useState("")

  const [poNum, setPoNum] = useState("")
  const [datePoPosted, setDatePoPosted] = useState("")
  const [terms, setTerms] = useState("")
  const [siNumber, setSiNumber] = useState("")
  const [payTo, setPayTo] = useState("")
  const [taxPercent, setTaxPercent] = useState("0")
  const [amount, setAmount] = useState("0")
  const [checkNumber, setCheckNumber] = useState("")
  const [checkDate, setCheckDate] = useState(today())
  const [notes, setNotes] = useState("")

  const [glRows, setGlRows] = useState<GLRow[]>([])
  const [glAccount, setGlAccount] = useState("")
  const [glAmount, setGlAmount] = useState("")
  const [glDrCr, setGlDrCr] = useState<"DR" | "CR">("DR")

  const { data: duePayables = [], isLoading, refetch } = useQuery({
    queryKey: ["campus_erp.api.finance.get_due_purchase_order_payables", supplierFilter],
    queryFn: () =>
      frappe.callGet<DuePayableRow[]>(
        "campus_erp.api.finance.get_due_purchase_order_payables",
        supplierFilter ? { supplier: supplierFilter } : {}
      ),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ["Chart of Account", "list"],
    queryFn: () =>
      frappe.list<ChartOfAccountRow>("Chart of Account", {
        fields: ["name", "account_number", "account_name"],
        limit_page_length: 200,
      }),
  })

  const totals = useMemo(() => {
    return glRows.reduce(
      (acc, r) => {
        acc.debit += Number(r.debit ?? 0)
        acc.credit += Number(r.credit ?? 0)
        return acc
      },
      { debit: 0, credit: 0 }
    )
  }, [glRows])

  const isBalanced = glRows.length > 0 && totals.debit === totals.credit
  const canSave = poNum.trim() !== "" && payTo.trim() !== "" && isBalanced

  function handleSelectPayable(row: DuePayableRow) {
    setPoNum(row.ponum)
    setDatePoPosted(row.date_posted)
    setSiNumber(row.sinum)
    setTerms(row.poterms)
    setPayTo(row.supname)
    setTaxPercent(String(row.potax))
    setAmount(String(row.poamount))
  }

  function addGlRow() {
    if (!glAccount || !glAmount) return
    const acct = accounts.find((a) => a.name === glAccount)
    const numAmount = Number(glAmount)
    setGlRows([
      ...glRows,
      {
        account: glAccount,
        account_number: acct?.account_number ?? "",
        account_name: acct?.account_name ?? "",
        debit: glDrCr === "DR" ? numAmount : 0,
        credit: glDrCr === "CR" ? numAmount : 0,
      },
    ])
    setGlAccount("")
    setGlAmount("")
    setGlDrCr("DR")
  }

  function removeGlRow(index: number) {
    setGlRows(glRows.filter((_, i) => i !== index))
  }

  async function handleSave() {
    const payload = {
      po_num: poNum,
      terms,
      si_number: siNumber,
      pay_to: payTo,
      tax_percent: Number(taxPercent),
      amount: Number(amount),
      check_number: checkNumber,
      check_date: checkDate,
      notes,
      accounts: glRows.map((r) => ({ account: r.account, debit: r.debit, credit: r.credit })),
    }
    try {
      await frappe.createDoc("SMS Due Purchase Order Payable", payload)
      refetch()
    } catch (err) {
      console.error(err)
      // TODO: surface via toast (sonner is already in the component set)
    }
  }

  function handleDelete() {
    if (!poNum) return
    // TODO: wire to frappe.deleteDoc("SMS Due Purchase Order Payable", <name>)
    console.log("delete", poNum)
  }

  function handlePrint() {
    window.print()
  }

  const toolbarActions: FinanceToolbarAction[] = [
    { key: "save", icon: Save, label: "Save", onClick: handleSave, disabled: !canSave },
    { key: "delete", icon: Trash2, label: "Delete", onClick: handleDelete },
    { key: "print", icon: Printer, label: "Print", onClick: handlePrint },
    { key: "find", icon: Search, label: "Find", onClick: () => document.getElementById("ap-po-search")?.focus() },
  ]

  return (
    <div className="grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Due Purchase Order Payables</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update items on-hand quantity based on items received from the Purchase Order. Once posted to GL, a PO
          receipt can never be cancelled.
        </p>
      </div>
      <FinancePropertySection
        title="Due Purchase Order Payables"
        right={
          <input
            className={`w-48 rounded border border-border ${financeRowInput}`}
            type="text"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            placeholder="Supplier…"
          />
        }
      >
        <FinanceRecordTable
          columns={dueColumns}
          rows={duePayables}
          rowKey={(r) => r.ponum}
          selectedRowKey={poNum}
          onSelectRow={handleSelectPayable}
          isLoading={isLoading}
          emptyMessage="No due payables found."
        />
      </FinancePropertySection>

      <FinanceVoucherToolbar actions={toolbarActions} onExit={() => history.back()} />

      <FinancePropertySection title="Voucher Details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            PO #
            <input id="ap-po-search" className={`rounded border border-border ${financeRowInput}`} type="text" value={poNum} onChange={(e) => setPoNum(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Date PO Posted
            <input className={`rounded border border-border bg-muted text-muted-foreground ${financeRowInput}`} type="text" value={datePoPosted} readOnly />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Terms
            <select className={`rounded border border-border ${financeRowSelect}`} value={terms} onChange={(e) => setTerms(e.target.value)}>
              <option value="">—</option>
              <option value="Cash">Cash</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 60">Net 60</option>
              <option value="COD">COD</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            S.I. Number
            <input className={`rounded border border-border ${financeRowInput}`} type="text" value={siNumber} onChange={(e) => setSiNumber(e.target.value)} />
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            Pay to
            <input className={`rounded border border-border ${financeRowInput}`} type="text" value={payTo} onChange={(e) => setPayTo(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Tax %
            <input className={`rounded border border-border text-right ${financeRowInput}`} type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Amount
            <input className={`rounded border border-border text-right ${financeRowInput}`} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Check Number
            <input className={`rounded border border-border ${financeRowInput}`} type="text" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Check Date
            <input className={`rounded border border-border ${financeRowInput}`} type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} />
          </label>

          <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-4">
            Notes
            <input className={`rounded border border-border ${financeRowInput}`} type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
      </FinancePropertySection>

      <FinancePropertySection
        title="General Ledger Entries"
        right={
          glRows.length > 0 ? (
            <span className={financeBalanceBadge(isBalanced)}>
              {isBalanced
                ? `✓ Balanced · ₱${totals.debit.toFixed(2)}`
                : `⚠ Out of balance · DR ${totals.debit.toFixed(2)} / CR ${totals.credit.toFixed(2)}`}
            </span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-[100px_1fr_90px_90px_20px] border-b border-border pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Acct #</span>
          <span>Acct Name</span>
          <span className="text-right">Debit</span>
          <span className="text-right">Credit</span>
          <span />
        </div>
        {glRows.map((row, i) => (
          <div key={i} className="grid grid-cols-[100px_1fr_90px_90px_20px] items-center border-b border-border py-1.5 text-[13px] last:border-b-0">
            <span>{row.account_number}</span>
            <span>{row.account_name}</span>
            <span className="text-right font-mono">{row.debit > 0 ? row.debit.toFixed(2) : "—"}</span>
            <span className="text-right font-mono">{row.credit > 0 ? row.credit.toFixed(2) : "—"}</span>
            <button type="button" onClick={() => removeGlRow(i)} className="text-center text-xs text-muted-foreground hover:text-red-600">✕</button>
          </div>
        ))}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <select className={`min-w-[160px] flex-1 rounded border border-border ${financeRowSelect}`} value={glAccount} onChange={(e) => setGlAccount(e.target.value)}>
            <option value="">+ Chart of Account…</option>
            {accounts.map((a) => (
              <option key={a.name} value={a.name}>{a.account_number} - {a.account_name}</option>
            ))}
          </select>
          <input className={`w-20 shrink-0 rounded border border-border ${financeRowInput}`} type="number" value={glAmount} onChange={(e) => setGlAmount(e.target.value)} placeholder="0.00" />
          <div className="flex shrink-0 overflow-hidden rounded border border-border">
            <button type="button" onClick={() => setGlDrCr("DR")} className={`px-2.5 py-1.5 text-[11px] ${glDrCr === "DR" ? "bg-amber-700 text-white" : "text-muted-foreground"}`}>DR</button>
            <button type="button" onClick={() => setGlDrCr("CR")} className={`border-l border-border px-2.5 py-1.5 text-[11px] ${glDrCr === "CR" ? "bg-amber-700 text-white" : "text-muted-foreground"}`}>CR</button>
          </div>
          <button type="button" className="shrink-0 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90" onClick={addGlRow}>Add</button>
        </div>

        <div className="mt-3 flex justify-end gap-6 text-sm">
          <span>Totals&nbsp; <strong>DR</strong> ₱{totals.debit.toFixed(2)}</span>
          <span><strong>CR</strong> ₱{totals.credit.toFixed(2)}</span>
        </div>
      </FinancePropertySection>

      {glRows.length > 0 && !isBalanced && (
        <p className="text-right text-xs text-amber-700">Debits and credits must match before saving.</p>
      )}
    </div>
  )
}
