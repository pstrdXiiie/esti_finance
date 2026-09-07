# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Personnel business rules (blueprint Phase 3): the employee-loan subsystem,
overtime, and travel orders. Per the same guiding principle as registrar.py
and finance_billing.py (blueprint §4.3): DocTypes own schema and permissions
only; every rule that used to live inline in a VB button-click handler (or
worse, re-implemented per form) lives here once instead.

Employee loans deliberately do NOT touch HRMS's historical Loan Management
schema (Loan / Loan Product / Salary Slip Loan) — that schema's "Loan"
doctype does not exist on this bench (erpnext dropped loan-management in
v14/v15) and no lending app is installed here. SMS Loan Type / SMS Loan
Application / SMS Employee Loan / SMS Loan Payment below are a
self-contained build instead. When a loan repayment needs to hit payroll,
the intended path (wired by a later step, not this module) is HRMS's real,
working Additional Salary doctype — a submittable per-employee one-off
deduction that Payroll Entry/Salary Slip generation already picks up
natively — not the dead Salary Slip "loans" child table.

SMS Employee Loan.loan_balance (and its "closed" flag) is a cache only. It
is never incremented — it is always fully recomputed from the real ledger
(every SMS Loan Payment row tagged with this employee_loan) each time, the
same "recompute from source of truth, never trust an incrementally-updated
cache" pattern already used by registrar.py's compute_grade_points and
finance_billing.py's refresh_assessment_balance.

SMS Loan Application, SMS Overtime, and SMS Travel Order all carry a plain
"status" Select field (Draft/Pending Recommendation/Recommended/Approved/
Rejected) that a native Frappe Workflow is meant to drive (a later step
configures the actual Workflow/Workflow Transition records against the
Recommending/Approving Officer roles) — this module treats that status
field as the single source of truth for "has this been approved", and never
re-derives approval from recommended_by/approved_by alone. docstatus
(submit/cancel/amend) is a separate, independent axis on these doctypes —
per their permission blocks only Finance Officer / HR Manager (and, for
Overtime/Travel Order, SMS Administrator) can actually submit, while the
Recommending/Approving Officer roles only have write access to move the
status field — so conversion/approval logic here keys off status, not
docstatus.
"""

import frappe
from frappe import _
from frappe.query_builder.functions import Sum
from frappe.utils import cint, flt, today

# Rounding tolerance for balance comparisons (a centavo), so float noise from
# repeated recomputation never trips the "loan fully paid off" check by itself.
FLT_TOLERANCE = 0.01

LOAN_PAYMENT_DETAILS = ("Principal", "Interest", "Other")


@frappe.whitelist()
def compute_loan_terms(loan_type: str, amount: float, term_months: int | None = None) -> dict:
	"""Pure calculation helper the frontend can call while an SMS Loan
	Application is being filled in, before it's even saved (mirrors
	finance_billing.py's compute_discount in spirit — one canonical formula,
	not duplicated per form). Flat, one-time interest on the principal (this
	is a simple employee salary loan, not a compounding bank loan):

		computed_interest = amount * loan_type.interest_rate
		loan_balance       = amount + computed_interest
		amortization       = loan_balance / term_months   (0 if term_months not yet chosen)
	"""
	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Amount must be greater than zero."))

	# term_months may legitimately be None/0 — the user hasn't picked a term
	# yet — in which case amortization simply comes back as 0 rather than
	# throwing. A genuinely negative value, though, is a bad input.
	term_months = cint(term_months) if term_months else 0
	if term_months < 0:
		frappe.throw(_("Term (Months) cannot be negative."))

	loan_type_doc = frappe.get_doc("SMS Loan Type", loan_type)
	interest_rate = flt(loan_type_doc.interest_rate)

	computed_interest = flt(amount * interest_rate)
	loan_balance = flt(amount + computed_interest)
	amortization = flt(loan_balance / term_months) if term_months else 0.0

	return {
		"computed_interest": computed_interest,
		"loan_balance": loan_balance,
		"amortization": amortization,
	}


@frappe.whitelist()
def approve_loan_application(loan_application: str) -> dict:
	"""Converts an approved SMS Loan Application into a real SMS Employee
	Loan. Meant to be called right after a Workflow transition sets status
	to "Approved", or by an HR Manager directly — either way, the status
	field is the single source of truth; recommended_by/approved_by are not
	re-checked here.
	"""
	doc = frappe.get_doc("SMS Loan Application", loan_application)
	if doc.status != "Approved":
		frappe.throw(
			_("Loan Application {0} is not Approved (current status: {1}).").format(
				loan_application, doc.status
			)
		)

	if frappe.db.exists("SMS Employee Loan", {"loan_application": loan_application}):
		frappe.throw(
			_("An Employee Loan already exists for Loan Application {0}.").format(loan_application)
		)

	# Snapshotted fresh from SMS Loan Type at conversion time (not from the
	# application) — the whole point of a snapshot is capturing the rate
	# that will actually apply going forward, in case the loan type's rate
	# changed since the application was filed.
	interest_rate = frappe.get_cached_value("SMS Loan Type", doc.loan_type, "interest_rate")

	loan_amount = flt(doc.loan_balance)  # already includes interest, per compute_loan_terms
	employee_loan = frappe.get_doc(
		{
			"doctype": "SMS Employee Loan",
			"employee": doc.employee,
			"loan_type": doc.loan_type,
			"loan_application": doc.name,
			"gross_amount": doc.amount,
			"loan_amount": loan_amount,
			"amortization_amount": doc.amortization,
			"loan_balance": loan_amount,  # starting balance — nothing paid yet
			"interest_rate": interest_rate,
			"term_months": doc.term_months,
			"closed": 0,
		}
	)
	employee_loan.insert(ignore_permissions=frappe.has_permission("SMS Employee Loan", "create"))
	return {"employee_loan": employee_loan.name}


@frappe.whitelist()
def record_loan_payment(
	employee_loan: str,
	amount: float,
	detail: str = "Principal",
	reference_no: str | None = None,
	payslip: str | None = None,
) -> dict:
	"""Records one SMS Loan Payment row, then fully recomputes the parent
	SMS Employee Loan's loan_balance (never increments a cached value) by
	summing ALL SMS Loan Payment rows against this employee_loan and
	subtracting from loan_amount — the sum is computed once, after the new
	row is inserted, and that single freshly-computed number is written to
	both the loan's loan_balance and this row's balance_after.
	"""
	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Payment amount must be greater than zero."))
	if detail not in LOAN_PAYMENT_DETAILS:
		frappe.throw(_("Detail must be one of: {0}.").format(", ".join(LOAN_PAYMENT_DETAILS)))

	loan = frappe.get_doc("SMS Employee Loan", employee_loan)
	if loan.closed:
		frappe.throw(_("Employee Loan {0} is already closed — no further payments can be recorded.").format(
			employee_loan
		))

	payment = frappe.get_doc(
		{
			"doctype": "SMS Loan Payment",
			"employee_loan": employee_loan,
			"employee": loan.employee,
			"payment_date": today(),
			"detail": detail,
			"amount": amount,
			"reference_no": reference_no,
			"payslip": payslip,
		}
	)
	payment.insert(ignore_permissions=frappe.has_permission("SMS Loan Payment", "create"))

	lp = frappe.qb.DocType("SMS Loan Payment")
	result = (
		frappe.qb.from_(lp)
		.select(Sum(lp.amount).as_("total"))
		.where(lp.employee_loan == employee_loan)
	).run(as_dict=True)
	total_paid = flt(result[0].total) if result and result[0].total is not None else 0.0

	loan_balance = flt(flt(loan.loan_amount) - total_paid)
	closed = 1 if loan_balance <= FLT_TOLERANCE else 0

	frappe.db.set_value("SMS Employee Loan", employee_loan, {"loan_balance": loan_balance, "closed": closed})
	frappe.db.set_value("SMS Loan Payment", payment.name, "balance_after", loan_balance)

	return {"payment": payment.name, "loan_balance": loan_balance, "closed": closed}


@frappe.whitelist()
def get_loan_summary(employee: str) -> list[dict]:
	"""Thin read helper backing an employee-facing "my loans" screen.
	Individual SMS Loan Payment rows are viewed per-loan rather than needing
	their own dedicated whitelisted list function — the frontend can call
	frappe.list("SMS Loan Payment", {filters: {employee_loan: ...}}) directly
	for that, same as it does for other child-ledger-style doctypes
	elsewhere in this app.
	"""
	if not frappe.db.exists("Employee", employee):
		frappe.throw(_("Employee {0} not found.").format(employee))

	rows = frappe.get_all(
		"SMS Employee Loan",
		filters={"employee": employee},
		fields=["name", "loan_type", "loan_amount", "loan_balance", "closed"],
		order_by="creation desc",
	)
	return [
		{
			"employee_loan": row.name,
			"loan_type": row.loan_type,
			"loan_amount": row.loan_amount,
			"loan_balance": row.loan_balance,
			"closed": row.closed,
		}
		for row in rows
	]
