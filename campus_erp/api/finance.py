import frappe
from frappe.utils import getdate, flt
from frappe import _


@frappe.whitelist()
def get_trial_balance(as_of_date: str, period_start: str = None):
	as_of_date = getdate(as_of_date)
	period_start = getdate(period_start) if period_start else as_of_date.replace(month=1, day=1)

	accounts = frappe.get_all("Account", fields=["name", "account_number", "account_name"], order_by="account_number asc")
	rows = []
	for acc in accounts:
		beginning = frappe.db.sql(
			"select sum(debit) as debit, sum(credit) as credit from `tabSMS Campus GL Entry` where account = %s and posting_date < %s and is_cancelled = 0",
			(acc.name, period_start), as_dict=True,
		)[0]
		txn = frappe.db.sql(
			"select sum(debit) as debit, sum(credit) as credit from `tabSMS Campus GL Entry` where account = %s and posting_date between %s and %s and is_cancelled = 0",
			(acc.name, period_start, as_of_date), as_dict=True,
		)[0]
		beg_debit, beg_credit = beginning.debit or 0, beginning.credit or 0
		txn_debit, txn_credit = txn.debit or 0, txn.credit or 0
		if not any([beg_debit, beg_credit, txn_debit, txn_credit]):
			continue
		rows.append({
			"account_number": acc.account_number, "account_name": acc.account_name,
			"beginning_debit": beg_debit, "beginning_credit": beg_credit,
			"transactions_debit": txn_debit, "transactions_credit": txn_credit,
			"ending_debit": beg_debit + txn_debit, "ending_credit": beg_credit + txn_credit,
		})
	return rows

@frappe.whitelist()
def get_collection_for_the_period(from_date: str, to_date: str) -> list[dict]:
        """Collection for the Period — one row per submitted SMS Payment and Cash
        Receipt Entry within the date range. "student" is sourced from that
        doctype's `payee` field (already a resolved display name), not
        `student_number` — flagged since this wasn't confirmed column-by-column
        against a screenshot. "encoder" is the record's Frappe `owner`
        (creating user), read as-is with no display-name lookup, matching this
        file's existing unadorned style.
        """
        from_date = getdate(from_date)
        to_date = getdate(to_date)
        return frappe.get_all(
                "SMS Payment and Cash Receipt Entry",
                filters={"date": ["between", [from_date, to_date]], "docstatus": 1},
                fields=[
                        "date",
                        "payee as student",
                        "amount",
                        "account_charged",
                        "or_number as reference_no",
                        "owner as encoder",
                ],
                order_by="date asc",
        )


@frappe.whitelist()
def get_assessment_for_the_period(from_date: str, to_date: str) -> list[dict]:
        """Assessment for the Period.

        CORRECTION to reports.ts's own comment: SMS Student Assessment.assessment
        is documented in that doctype's JSON as "gross assessment = tuition +
        misc_fee + other_fee, before discount" — i.e. it IS the Gross
        Assessment, not the Net Assessment the frontend spec's comment assumed.
        There is no separate stored "net assessment" field; total_fee is the
        actual post-discount amount the student owes. Returning `assessment`
        under both `assessment` and `gross_assessment` below so the existing
        reports.ts columns keep working unmodified for now — but the "Net
        Assessment" label on the `assessment` column in reports.ts is wrong and
        should be relabeled "Gross Assessment" (pointed at gross_assessment)
        next time that file is touched.
        """
        from_date = getdate(from_date)
        to_date = getdate(to_date)
        rows = frappe.get_all(
                "SMS Student Assessment",
                filters={"posting_date": ["between", [from_date, to_date]], "docstatus": 1},
                fields=[
                        "posting_date",
                        "student_name",
                        "program",
                        "tuition",
                        "student_type",
                        "discount_percent",
                        "new_tuition",
                        "misc_fee",
                        "other_fee",
                        "assessment",
                        "other_discount",
                        "misc_discount",
                        "old_account",
                        "total_fee",
                ],
                order_by="posting_date asc",
        )
        for row in rows:
                row["gross_assessment"] = row["assessment"]
        return rows


@frappe.whitelist()
def get_tuition_fee_receivables(
        school_year: str, semester: str, to_date: str, graduating_only: int = 0
) -> dict:
        """Tuition Fee Receivables (legacy: "Summary of Assessment"). One row per
        STUDENT, not per transaction — the latest submitted assessment on or
        before `to_date` for the given school_year + semester.

        graduating_only is accepted but intentionally NO-OPS: is_graduating
        does not exist yet on Program Enrollment (see reports.ts's own "Known
        Gaps" note on this spec) — flagged again here rather than silently
        pretending to filter on it.
        """
        to_date = getdate(to_date)
        all_rows = frappe.get_all(
                "SMS Student Assessment",
                filters={
                        "school_year": school_year,
                        "semester": semester,
                        "posting_date": ["<=", to_date],
                        "docstatus": 1,
                },
                fields=[
                        "student", "student_name", "program", "student_type",
                        "discount_percent", "misc_fee", "other_fee", "other_discount",
                        "misc_discount", "old_account", "total_fee", "payment",
                        "receivable", "posting_date",
                ],
                order_by="posting_date asc",
        )

        # Collapse to one row per student: the latest assessment as of to_date.
        # Relies on the ascending order_by above so the last write per student
        # in this loop is always the most recent one.
        latest_by_student: dict[str, dict] = {}
        for row in all_rows:
                latest_by_student[row["student"]] = row

        rows = list(latest_by_student.values())
        totals = {
                "total_assessment": sum(flt(r["total_fee"]) for r in rows),
                "total_collection": sum(flt(r["payment"]) for r in rows),
                "total_receivables": sum(flt(r["receivable"]) for r in rows),
        }
        return {"rows": rows, "totals": totals}


# Voucher doctypes that can post to SMS Campus GL Entry, and which of their
# own fields holds the display name shown as "Particular" on the legacy
# ledger (a person/payee name, not a GL remark). Extend this mapping as new
# voucher types start posting to SMS Campus GL Entry.
_PARTICULAR_FIELD_BY_VOUCHER_TYPE = {
        "SMS Payment and Cash Receipt Entry": "payee",
        "SMS Sundry Account": "payee",
        "SMS Purchase Order Payable": "surname",
        "SMS Student Assessment": "student_name",
}


@frappe.whitelist()
def get_subsidiary_ledger(account: str, from_date: str, to_date: str) -> list[dict]:
        """Subsidiary Reports (legacy: "Collection by Account").

        Flat MVP only — see reports.ts's KNOWN GAP comment on
        subsidiaryLedgerSpec: the legacy screen groups these rows by
        payee/sub-ledger with a running balance per group, plus one grand
        total. This method does not attempt that grouping; it returns plain
        chronological rows with one running balance across the whole account,
        and the frontend shows them flat until ReportScreen grows a
        grouped-ledger variant.

        "Particular" is resolved per-row from whichever doctype/field the GL
        entry's voucher_type points at (see _PARTICULAR_FIELD_BY_VOUCHER_TYPE),
        since SMS Campus GL Entry itself has no particular/payee field — only
        `remarks`, which is a free-text note, not a name. Falls back to
        remarks, then the voucher number itself, if the voucher_type isn't in
        the mapping yet.
        """
        from_date = getdate(from_date)
        to_date = getdate(to_date)
        entries = frappe.get_all(
                "SMS Campus GL Entry",
                filters={
                        "account": account,
                        "posting_date": ["between", [from_date, to_date]],
                        "is_cancelled": 0,
                },
                fields=["posting_date", "voucher_type", "voucher_no", "debit", "credit", "remarks"],
                order_by="posting_date asc",
        )

        running_balance = 0.0
        rows = []
        for e in entries:
                particular_field = _PARTICULAR_FIELD_BY_VOUCHER_TYPE.get(e["voucher_type"])
                particular = (
                        frappe.db.get_value(e["voucher_type"], e["voucher_no"], particular_field)
                        if particular_field
                        else None
                ) or e["remarks"] or e["voucher_no"]

                running_balance += flt(e["debit"]) - flt(e["credit"])
                rows.append({
                        "date": e["posting_date"],
                        "particular": particular,
                        "reference_no": e["voucher_no"],
                        "debit": e["debit"],
                        "credit": e["credit"],
                        "balance": running_balance,
                })
        return rows

@frappe.whitelist()
def get_student_billing_list(school_year: str, course: str, year_level: str, term: str) -> list[dict]:
	"""Student Billing (legacy "PERMIT" screen) — filter-driven student list with
	checkboxes, feeding a per-student Statement of Accounts print. Sourced from
	SMS Permit, which already stores total_fee/payment/due_payment/permit_no/status
	directly (no join to SMS Student Assessment needed for this list).

	`course` is passed as a Program doctype name (SMS Permit.course is a Link to
	Program) and `year_level` is cast to int to match SMS Permit's Int fieldtype —
	flagged since the legacy screen's Year Level input may pass it as a string.

	"full_name" is fetched from the linked Student doctype's `student_name` field
	via frappe.db.get_value in a loop — matching this file's existing unadorned
	style rather than a SQL join, since SMS Permit only stores the student, not a
	denormalized name.
	"""
	year_level = int(year_level)
	rows = frappe.get_all(
		"SMS Permit",
		filters={
			"school_year": school_year,
			"course": course,
			"year_level": year_level,
			"term": term,
		},
		fields=[
			"name",
			"student",
			"total_fee",
			"payment",
			"due_payment",
			"permit_no",
			"status",
		],
		order_by="student asc",
	)
	for row in rows:
		row["full_name"] = frappe.db.get_value("Student", row["student"], "student_name")
	return rows


@frappe.whitelist()
def get_tuition_fee_receivables_rows(school_year: str, semester: str, to_date: str, graduating_only: int = 0) -> list[dict]:
        """Thin wrapper around get_tuition_fee_receivables for ReportScreen,
        which expects a flat row array and has no support for a totals
        footer — so the aggregate totals dict is intentionally dropped here.
        If ReportScreen ever grows totals-footer support, call
        get_tuition_fee_receivables directly instead and use both keys."""
        result = get_tuition_fee_receivables(school_year, semester, to_date, graduating_only)
        return result["rows"]
