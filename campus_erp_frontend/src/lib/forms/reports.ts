import { ReportSpec } from "./types";

/**
 * Legacy screen: Finance → Financial Reports → Assessment for the Period
 * (menu item is labelled "Assessment for the Day" but the legacy window
 * title reads "Assessment for the Period <from> - <to>" with a From/To
 * filter, same shape as Collection for the Period — going with "Period"
 * to match the actual screen behavior, not the menu label).
 *
 * Reads from the existing SMS Student Assessment doctype (already live,
 * see assessmentSpec in forms/finance.ts / finance/transactions/student_acc)
 * — no new DocType needed here, unlike Collection for the Period.
 *
 * Column mapping to SMS Student Assessment fields, from the legacy grid
 * (several headers were truncated in the screenshot):
 *   Date        -> posting_date
 *   StudentName -> student_name
 *   Course      -> program (blueprint "Course" = Education app "Program")
 *   Tuition     -> tuition
 *   Nature...   -> student_type (New/Old/Transferee/Returnee) — guess, header cut off
 *   Discount    -> discount_percent
 *   New Tu...   -> new_tuition
 *   Misc Fee    -> misc_fee
 *   Other Fee   -> other_fee
 *   GrossA...   -> "Gross Assessment" — NOT a field on SMS Student Assessment
 *                  today (closest is "assessment", which is already used
 *                  below for Net). Backend method likely needs to compute
 *                  this (tuition + misc_fee + other_fee) rather than read
 *                  a stored field — flagged, not confirmed.
 *   Other Di... -> other_discount
 *   Misc Disc   -> misc_discount
 *   NetAss...   -> assessment (readOnly Currency field, assumed to already
 *                  be post-discount net assessment — guess, unconfirmed)
 *   Old Acc...  -> old_account
 *   Total Fee   -> total_fee
 */
export const assessmentForThePeriodSpec: ReportSpec = {
  title: "Assessment for the Period",
  method: "campus_erp.api.finance.get_assessment_for_the_period",
  filters: [
    { fieldname: "from_date", label: "From", fieldtype: "Date", required: true },
    { fieldname: "to_date", label: "To", fieldtype: "Date", required: true },
  ],
  columns: [
    { fieldname: "posting_date", label: "Date", fieldtype: "Date" },
    { fieldname: "student_name", label: "StudentName", fieldtype: "Data" },
    { fieldname: "program", label: "Course", fieldtype: "Data" },
    { fieldname: "tuition", label: "Tuition", fieldtype: "Currency" },
    { fieldname: "student_type", label: "Nature", fieldtype: "Data" },
    { fieldname: "discount_percent", label: "Discount", fieldtype: "Data" },
    { fieldname: "new_tuition", label: "New Tuition", fieldtype: "Currency" },
    { fieldname: "misc_fee", label: "Misc Fee", fieldtype: "Currency" },
    { fieldname: "other_fee", label: "Other Fee", fieldtype: "Currency" },
    { fieldname: "gross_assessment", label: "Gross Assessment", fieldtype: "Currency" },
    { fieldname: "other_discount", label: "Other Discount", fieldtype: "Currency" },
    { fieldname: "misc_discount", label: "Misc Disc", fieldtype: "Currency" },
    { fieldname: "assessment", label: "Net Assessment", fieldtype: "Currency" },
    { fieldname: "old_account", label: "Old Account", fieldtype: "Currency" },
    { fieldname: "total_fee", label: "Total Fee", fieldtype: "Currency" },
  ],
};

/**
 * Legacy screen: Finance → Financial Reports → Collection for the Period.
 * Filter panel (From/To date range) + result grid, per the legacy VB
 * screenshot. The legacy screen also has a running "Total Collection"
 * footer and a "Generate JV" action (posts the period's collections to a
 * Journal Voucher) — neither is supported by the generic ReportScreen yet,
 * so this spec only covers the filter+grid part for now. See Known Gaps.
 */
export const collectionForThePeriodSpec: ReportSpec = {
  title: "Collection for the Period",
  method: "campus_erp.api.finance.get_collection_for_the_period",
  filters: [
    { fieldname: "from_date", label: "From", fieldtype: "Date", required: true },
    { fieldname: "to_date", label: "To", fieldtype: "Date", required: true },
  ],
  columns: [
    { fieldname: "date", label: "Date", fieldtype: "Date" },
    { fieldname: "student", label: "Student", fieldtype: "Data" },
    { fieldname: "amount", label: "Amount", fieldtype: "Currency" },
    { fieldname: "account_charged", label: "AccountCharged", fieldtype: "Data" },
    { fieldname: "reference_no", label: "Reference#", fieldtype: "Data" },
    { fieldname: "encoder", label: "Encoder", fieldtype: "Data" },
  ],
};

export const trialBalanceSpec: ReportSpec = {
  title: "Trial Balance",
  method: "campus_erp.api.finance.get_trial_balance",
  filters: [
    {
      fieldname: "as_of_date",
      label: "As of",
      fieldtype: "Date",
      required: true,
    },
  ],
  columns: [
    { fieldname: "account_number", label: "Acct No.", fieldtype: "Data" },
    { fieldname: "account_name", label: "Account Titles", fieldtype: "Data" },
    { fieldname: "beginning_debit", label: "Beg. Debit", fieldtype: "Currency" },
    { fieldname: "beginning_credit", label: "Beg. Credit", fieldtype: "Currency" },
    { fieldname: "transactions_debit", label: "Trans. Debit", fieldtype: "Currency" },
    { fieldname: "transactions_credit", label: "Trans. Credit", fieldtype: "Currency" },
    { fieldname: "ending_debit", label: "End. Debit", fieldtype: "Currency" },
    { fieldname: "ending_credit", label: "End. Credit", fieldtype: "Currency" },
  ],
};

/**
 * Legacy screen: Finance → Financial Reports → Tuition Fee Receivables
 * (menu item is labelled "Tuition Fee Receivables", but the legacy window
 * that opens is titled "Summary of Assessment for Semester <n> S.Y.
 * <yyyy>-<yyyy>" — same menu-label-vs-window-title mismatch already seen
 * on Assessment for the Period. Confirmed by the menu screenshot showing
 * "Tuition Fee Receivables" as the highlighted/selected item at the moment
 * the Summary of Assessment window was captured.)
 *
 * Filter panel per screenshot: School Year (from/to year pair), Semester
 * (dropdown, options unconfirmed — see Known Gaps), a single "To" date,
 * and a "Graduating Only" checkbox. Unlike Assessment for the Period, this
 * is NOT a from/to date range — it's a single as-of cutoff.
 *
 * Rows are per-STUDENT (one row per student's current assessment), not
 * per-transaction — different grain than Assessment for the Period.
 *
 * Column mapping to SMS Student Assessment fields, high-confidence only —
 * two columns from the screenshot are deliberately left out, see Known Gaps:
 *   StudentID   -> student
 *   Students    -> student_name
 *   Course      -> program
 *   Nature...   -> student_type
 *   Discount    -> discount_percent
 *   Misc Fee    -> misc_fee
 *   Other Fee   -> other_fee
 *   Other Di... -> other_discount
 *   Misc Disc   -> misc_discount
 *   Old Acc...  -> old_account
 *   Total Fee   -> total_fee
 *   Payment     -> payment
 *   Balance     -> receivable
 *
 * Totals footer per screenshot ("Totals" panel: Assessment/Dues,
 * Collection, Receivables) — NOT stored fields, the backend method must
 * aggregate across the filtered rows. Requires the get_tuition_fee_receivables
 * method to return { rows, totals } per the new ReportSpec.totals shape.
 *
 * Known Gaps (blocking full functionality, not blocking this file existing):
 * 1. Screenshot shows a confusing sequence "Assessment | Tuition | Assess...
 *    | Tuition | Nature..." — two Assessment/Tuition-looking columns back
 *    to back with identical values per row in the sample data. Could be a
 *    frozen-column header split, or two genuinely different fields (e.g.
 *    assessment vs old_assessment, tuition vs new_tuition). Left OUT of
 *    columns below rather than guessed — confirm with a widened screenshot
 *    or column-chooser before adding.
 * 2. Graduating Only has no backing field yet. Decision made: add a new
 *    is_graduating field on Program Enrollment (Student.graduated is a
 *    historical completed-flag, wrong semantics for "graduating this
 *    term"). Field not yet created — filter is present in the spec below
 *    so the UI matches the legacy screen, but it will no-op until the
 *    backend field + get_tuition_fee_receivables both exist.
 * 3. Semester field type unconfirmed — doctype has semester as an Int,
 *    but the legacy dropdown may show text labels ("1st Semester" etc).
 *    Using Select with numeric-string options as a placeholder pending
 *    confirmation; adjust `options` below once confirmed.
 * 4. method points to campus_erp.api.finance.get_tuition_fee_receivables,
 *    which does not exist yet — Run Report will error until it's written
 *    (needs campus_erp/api/finance.py for existing conventions first).
 */
export const tuitionFeeReceivablesSpec: ReportSpec = {
  title: "Tuition Fee Receivables",
  legacyForm: "Summary of Assessment",
  method: "campus_erp.api.finance.get_tuition_fee_receivables",
  filters: [
    { fieldname: "school_year", label: "School Year", fieldtype: "Data", required: true },
    {
      fieldname: "semester",
      label: "Semester",
      fieldtype: "Select",
      options: "1\n2\n3",
      required: true,
      description: "Placeholder options pending confirmation of legacy dropdown labels",
    },
    { fieldname: "to_date", label: "To", fieldtype: "Date", required: true },
    {
      fieldname: "graduating_only",
      label: "Graduating Only",
      fieldtype: "Check",
      description: "No-ops until is_graduating exists on Program Enrollment",
    },
  ],
  columns: [
    { fieldname: "student", label: "StudentID", fieldtype: "Data" },
    { fieldname: "student_name", label: "Students", fieldtype: "Data" },
    { fieldname: "program", label: "Course", fieldtype: "Data" },
    { fieldname: "student_type", label: "Nature", fieldtype: "Data" },
    { fieldname: "discount_percent", label: "Discount", fieldtype: "Data" },
    { fieldname: "misc_fee", label: "Misc Fee", fieldtype: "Currency" },
    { fieldname: "other_fee", label: "Other Fee", fieldtype: "Currency" },
    { fieldname: "other_discount", label: "Other Discount", fieldtype: "Currency" },
    { fieldname: "misc_discount", label: "Misc Disc", fieldtype: "Currency" },
    { fieldname: "old_account", label: "Old Account", fieldtype: "Currency" },
    { fieldname: "total_fee", label: "Total Fee", fieldtype: "Currency" },
    { fieldname: "payment", label: "Payment", fieldtype: "Currency" },
    { fieldname: "receivable", label: "Balance", fieldtype: "Currency" },
  ],
  totals: [
    { fieldname: "total_assessment", label: "Assessment/Dues", fieldtype: "Currency" },
    { fieldname: "total_collection", label: "Collection", fieldtype: "Currency" },
    { fieldname: "total_receivables", label: "Receivables", fieldtype: "Currency" },
  ],
};

/**
 * Legacy screen: Finance → Financial Reports → Subsidiary Reports
 * (legacy window title "Collection by Account" per the Crystal Reports
 * viewer caption — same menu-label-vs-window-title mismatch already seen
 * on Assessment for the Period and Tuition Fee Receivables).
 *
 * Filter panel per screenshot: Account Title (dropdown) + From/To date
 * range. Account Title uses a Link to the existing "Account" doctype,
 * matching every other account-picker in this codebase (see
 * chartOfAccountSpec, cashReceipt's account_charged, etc.) rather than a
 * hardcoded Select — the four titles visible in the legacy dropdown
 * (Accounts Payable, Advances from Canteen, Advances to Employees, Salary
 * Loan Receivables) are almost certainly just is_group=0 Account records
 * that happen to carry a subsidiary ledger, not a fixed enum. Confirm
 * against the real Account list before relying on this.
 *
 * Column mapping from the legacy grid (Date, Particular, Ref No., Debit,
 * Credit, Balance):
 *   Date       -> date
 *   Particular -> particular
 *   Ref No.    -> reference_no
 *   Debit      -> debit
 *   Credit     -> credit
 *   Balance    -> balance
 *
 * KNOWN GAP — blocking full fidelity, not blocking this file existing:
 * the legacy report groups rows by payee/sub-ledger (each name — e.g.
 * "Sore, Richard O." — is its own subheader with its own transaction rows
 * and running balance), then shows one grand total for the whole account
 * at the bottom (e.g. "TOTAL SALARY LOAN RECEIVABLES  -0.10"). The
 * generic ReportScreen only supports a flat row grid plus one flat totals
 * footer (see ReportSpec.totals) — it has no grouping concept, and even
 * the flat totals footer assumes static label text, whereas this legacy
 * report's total label is dynamic ("TOTAL " + selected account name).
 * Shipping the flat filters+grid version below as an MVP; grouping needs
 * either a new "grouped-ledger" variant of ReportScreen or a bespoke
 * component before this fully matches the legacy screen.
 *
 * method points to campus_erp.api.finance.get_subsidiary_ledger, which
 * does not exist yet — campus_erp/api/finance.py itself hasn't been
 * created (confirmed empty on the backend as of this session). Run Report
 * will error until that file + method are written. If grouping is
 * implemented server-side, the method should return
 * { rows: { group: string; date; particular; reference_no; debit; credit;
 * balance }[], totals: { balance: number } } and ReportScreen will need a
 * matching update to render the groups — not required for the flat MVP.
 */
export const subsidiaryLedgerSpec: ReportSpec = {
  title: "Subsidiary Reports",
  legacyForm: "Collection by Account",
  method: "campus_erp.api.finance.get_subsidiary_ledger",
  filters: [
    {
      fieldname: "account",
      label: "Account Title",
      fieldtype: "Link",
      options: "Account",
      required: true,
    },
    { fieldname: "from_date", label: "From", fieldtype: "Date", required: true },
    { fieldname: "to_date", label: "To", fieldtype: "Date", required: true },
  ],
  columns: [
    { fieldname: "date", label: "Date", fieldtype: "Date" },
    { fieldname: "particular", label: "Particular", fieldtype: "Data" },
    { fieldname: "reference_no", label: "Ref No.", fieldtype: "Data" },
    { fieldname: "debit", label: "Debit", fieldtype: "Currency" },
    { fieldname: "credit", label: "Credit", fieldtype: "Currency" },
    { fieldname: "balance", label: "Balance", fieldtype: "Currency" },
  ],
};
