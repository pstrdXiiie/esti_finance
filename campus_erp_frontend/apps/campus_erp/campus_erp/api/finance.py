
import frappe
from frappe.utils import date_diff, nowdate, getdate

@frappe.whitelist()
def get_due_purchase_order_payables(supplier=None):
	"""Powers the 'Due Purchase Order Payables' grid on SMS Accounts
	Payable. Returns open POs with a computed `aging` in days.
	NOTE: `payment_status` filter is guessed — confirm the real field
	that marks a PO as already paid/closed."""
	filters = {"payment_status": ["!=", "Paid"]}
	if supplier:
		filters["supplier_name"] = ["like", f"%{supplier}%"]

	rows = frappe.get_all(
		"SMS Purchase Order",
		filters=filters,
		fields=[
			"name as ponum",
			"supplier_code as supcode",
			"supplier_name as supname",
			"po_date as podate",
			"date_posted as date_posted",
			"si_num as sinum",
			"po_terms as poterms",
			"po_tax as potax",
			"po_total as poamount",
		],
		limit_page_length=200,
	)

	for row in rows:
		row["aging"] = date_diff(nowdate(), row.get("podate")) if row.get("podate") else 0

	return rows


@frappe.whitelist()
def get_student_ledger(student_number=None):
	"""Powers the 'Ledger' dialog on Student Account (see legacy screenshot:
	Date / Transaction / OR # / Debit / Credit / Balance). Built from
	'SMS Student Account' rows for this student, oldest first.
	NOTE: this guesses that each row's `payment` value marks it as a credit
	(cash received) and `assessment` marks a debit (charge posted), and that
	`current_balance` on each row is already the correct running balance —
	confirm both against your real data before relying on this."""
	if not student_number:
		frappe.throw("student_number is required")

	rows = frappe.get_all(
		"SMS Student Account",
		filters={"student_number": student_number},
		fields=[
			"payment_date",
			"assessment",
			"payment",
			"or_number",
			"amount",
			"current_balance",
		],
		order_by="payment_date asc",
	)

	ledger = []
	for r in rows:
		is_payment = bool(r.payment)
		ledger.append({
			"date": r.payment_date,
			"transaction": r.payment or r.assessment or "",
			"or_number": r.or_number,
			"debit": 0 if is_payment else (r.amount or 0),
			"credit": (r.amount or 0) if is_payment else 0,
			"balance": r.current_balance,
		})
	return ledger


@frappe.whitelist()
def get_trial_balance(as_of_date: str, period_start: str = None):
	"""
	Returns one row per Account with non-zero activity:
	  beginning_debit / beginning_credit   - all Campus GL Entry rows before period_start
	  transactions_debit / transactions_credit - rows from period_start through as_of_date
	  ending_debit / ending_credit         - beginning + transactions
 
	period_start: TEMPORARY placeholder logic (Jan 1 of as_of_date's year).
	Replace once it's confirmed whether periods come from a School Year
	doctype or ERPNext's Fiscal Year — this directly affects what
	"Beginning Balance" means for a mid-year school term.
	"""
	as_of_date = getdate(as_of_date)
	period_start = getdate(period_start) if period_start else as_of_date.replace(month=1, day=1)
 
	accounts = frappe.get_all(
		"Account",
		fields=["name", "account_number", "account_name"],
		order_by="account_number asc",
	)
 
	rows = []
	for acc in accounts:
		beginning = frappe.db.sql(
			"""
			select sum(debit) as debit, sum(credit) as credit
			from `tabCampus GL Entry`
			where account = %s and posting_date < %s and is_cancelled = 0
			""",
			(acc.name, period_start),
			as_dict=True,
		)[0]
 
		txn = frappe.db.sql(
			"""
			select sum(debit) as debit, sum(credit) as credit
			from `tabCampus GL Entry`
			where account = %s and posting_date between %s and %s and is_cancelled = 0
			""",
			(acc.name, period_start, as_of_date),
			as_dict=True,
		)[0]
 
		beg_debit, beg_credit = beginning.debit or 0, beginning.credit or 0
		txn_debit, txn_credit = txn.debit or 0, txn.credit or 0
 
		# Legacy report only lists accounts with activity — confirm this is
		# still wanted, or whether all accounts should always show.
		if not any([beg_debit, beg_credit, txn_debit, txn_credit]):
			continue
 
		rows.append({
			"account_number": acc.account_number,
			"account_name": acc.account_name,
			"beginning_debit": beg_debit,
			"beginning_credit": beg_credit,
			"transactions_debit": txn_debit,
			"transactions_credit": txn_credit,
			"ending_debit": beg_debit + txn_debit,
			"ending_credit": beg_credit + txn_credit,
		})
 
	return rows
 