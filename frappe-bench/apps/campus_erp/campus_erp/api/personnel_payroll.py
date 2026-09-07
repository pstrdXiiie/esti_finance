# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Personnel payroll business rules (blueprint Phase 3): statutory-contribution
report generation and the employee-benefit fund. Per the same guiding
principle as registrar.py / finance_billing.py / personnel.py (blueprint
§4.3): DocTypes own schema and permissions only; every rule lives here once.

Statutory contribution amounts are never hand-computed here — they are
always looked up from SMS Statutory Contribution Bracket (Administration
module, Phase 0), the real bracket table, keyed by bracket_type + company +
the employee's gross-pay-equivalent falling within [range_from, range_to].
"Withholding Tax" is deliberately NOT computed this way: SMS Statutory
Contribution Bracket's own bracket_type options are only SSS/PhilHealth/
Pag-IBIG — no BIR withholding-tax bracket table exists yet on this bench, so
generate_statutory_report() below creates an empty Tax Lines batch with a
warning rather than fabricating numbers.

Gross-pay-equivalent field: Employee has no native "gross_pay" field. The
parallel custom-fields step that ran alongside this one added
Employee.statutory_rate (Currency, under the "Teaching Load & Rate Basis"
section) specifically for rate-basis/statutory computations — that is the
field this module reads first. Employee.ctc (erpnext's native
Cost-to-Company field) is used only as a fallback for employees who have no
statutory_rate on file, per the migration's own guidance that ctc is the
best available proxy where nothing more specific exists.

SMS Employee Benefit.available_fund/consumed_fund are cache fields only.
consumed_fund is always fully recomputed by summing every submitted SMS
Employee Benefit row for the employee (never incremented blind) — the same
"recompute from source of truth" pattern already used by registrar.py's
compute_grade_points, finance_billing.py's refresh_assessment_balance, and
personnel.py's record_loan_payment. available_fund is different in kind: it
is a fund ceiling set by HR policy, not something derived from the ledger,
so it is carried forward unchanged from the most recent row rather than
recomputed — see get_employee_benefit_balance()'s docstring.
"""

import frappe
from frappe import _
from frappe.utils import flt, today

# Rounding tolerance for balance comparisons (a centavo), so float noise from
# repeated recomputation never trips the "would exceed available fund" guard
# by itself — same tolerance used by finance_billing.py and personnel.py.
FLT_TOLERANCE = 0.01

STATUTORY_REPORT_TYPES = ("SSS", "PhilHealth", "Withholding Tax")
# SMS Statutory Contribution Bracket.bracket_type options — "Withholding Tax"
# is deliberately absent; there is no bracket table for it yet (see module
# docstring), so it is handled as its own branch, never queried against
# SMS Statutory Contribution Bracket.
BRACKET_REPORT_TYPES = ("SSS", "PhilHealth")


def _gross_pay_equivalent(employee_row) -> float:
	"""Employee.statutory_rate (the field the custom-fields step added
	specifically for this) if set, else Employee.ctc as a fallback proxy.
	"""
	return flt(employee_row.statutory_rate) or flt(employee_row.ctc)


@frappe.whitelist()
def generate_statutory_report(report_type: str, batch_month: str, company: str) -> dict:
	"""Creates one SMS Statutory Report Batch for a single company/month and,
	for SSS/PhilHealth, populates it by matching every active employee (with
	a non-empty statutory number for that report type) against the single
	SMS Statutory Contribution Bracket row whose range covers their gross
	pay. Employees with no matching bracket are skipped rather than aborting
	the whole batch — their names are collected into "warnings" instead, so
	HR can fix the underlying data (missing bracket coverage, no statutory
	number, no rate on file) and re-run.

	Company scopes both sides of the match: only employees belonging to
	`company` are considered, and only brackets for that same `company` are
	queried against — SMS Statutory Contribution Bracket is itself
	company-scoped, so mixing companies in one batch would silently match
	employees against another branch's bracket table.
	"""
	if report_type not in STATUTORY_REPORT_TYPES:
		frappe.throw(
			_("Report Type must be one of: {0}.").format(", ".join(STATUTORY_REPORT_TYPES))
		)
	if not batch_month:
		frappe.throw(_("Batch Month is required."))
	if not frappe.db.exists("Company", company):
		frappe.throw(_("Company {0} not found.").format(company))

	batch = frappe.get_doc(
		{
			"doctype": "SMS Statutory Report Batch",
			"report_type": report_type,
			"batch_month": batch_month,
			"reference_date": today(),
		}
	)
	batch.insert(ignore_permissions=frappe.has_permission("SMS Statutory Report Batch", "create"))

	warnings = []
	line_count = 0

	if report_type not in BRACKET_REPORT_TYPES:
		# Out of scope for this pass — no bracket data exists to compute
		# real numbers from. Batch is created (so the run is on record) but
		# tax_lines is deliberately left empty rather than fabricated.
		warnings.append(
			_(
				"Withholding-tax bracket data isn't modeled yet (SMS Statutory Contribution Bracket "
				"only covers SSS/PhilHealth/Pag-IBIG) — batch created with no Tax Lines."
			)
		)
	else:
		number_field = "sss_number" if report_type == "SSS" else "philhealth_number"
		employees = frappe.get_all(
			"Employee",
			filters={
				"status": "Active",
				"company": company,
				number_field: ["is", "set"],
			},
			fields=["name", "employee_name", number_field, "statutory_rate", "ctc"],
		)

		for emp in employees:
			number_value = emp.get(number_field)
			gross_pay = _gross_pay_equivalent(emp)
			if not gross_pay:
				warnings.append(
					_("{0} ({1}) has no Statutory Rate or CTC on file — skipped.").format(
						emp.employee_name, emp.name
					)
				)
				continue

			bracket_matches = frappe.get_all(
				"SMS Statutory Contribution Bracket",
				filters={
					"bracket_type": report_type,
					"company": company,
					"range_from": ["<=", gross_pay],
					"range_to": [">=", gross_pay],
				},
				fields=["name", "range_from", "range_to", "er_share", "ee_share", "ec_share"],
				order_by="range_from asc",
				limit=1,
			)
			if not bracket_matches:
				warnings.append(
					_("No {0} bracket covers {1} ({2})'s gross pay of {3} — skipped.").format(
						report_type, emp.employee_name, emp.name, gross_pay
					)
				)
				continue

			bracket = bracket_matches[0]
			if report_type == "SSS":
				batch.append(
					"sss_lines",
					{
						"employee": emp.name,
						"sss_number": number_value,
						"monthly_contribution": bracket.ee_share,
						"ec_contribution": bracket.ec_share,
					},
				)
			else:
				batch.append(
					"philhealth_lines",
					{
						"employee": emp.name,
						"philhealth_number": number_value,
						"bracket": f"{bracket.range_from}-{bracket.range_to}",
						"personal_share": bracket.ee_share,
						"employer_share": bracket.er_share,
					},
				)
			line_count += 1

	batch.save(ignore_permissions=frappe.has_permission("SMS Statutory Report Batch", "write", doc=batch))
	return {"name": batch.name, "employee_count": line_count, "warnings": warnings}


@frappe.whitelist()
def get_employee_benefit_balance(employee: str) -> dict:
	"""Recomputes an employee's benefit-fund balance fresh from the SMS
	Employee Benefit ledger rather than trusting any single row's cached
	available_fund/consumed_fund.

	consumed_fund is a real sum: total amount over every submitted row for
	this employee. available_fund is not summed — it is a fund ceiling HR
	sets, not something this function derives — so it is read off the most
	recent row (by benefit_date, then creation, both descending) instead.
	Only submitted (docstatus=1) rows count for either number, mirroring the
	rest of this app's "the ledger of record is submitted documents" pattern.
	If the employee has no submitted rows at all yet, both come back 0.
	"""
	if not frappe.db.exists("Employee", employee):
		frappe.throw(_("Employee {0} not found.").format(employee))

	rows = frappe.get_all(
		"SMS Employee Benefit",
		filters={"employee": employee, "docstatus": 1},
		fields=["amount", "available_fund"],
		order_by="benefit_date desc, creation desc",
	)
	if not rows:
		return {"available_fund": 0.0, "consumed_fund": 0.0}

	consumed_fund = flt(sum(flt(row.amount) for row in rows))
	available_fund = flt(rows[0].available_fund)
	return {"available_fund": available_fund, "consumed_fund": consumed_fund}


@frappe.whitelist()
def record_employee_benefit(
	employee: str,
	amount: float,
	benefit_date: str | None = None,
	petty_cash_voucher: str | None = None,
	description: str | None = None,
	available_fund: float | None = None,
) -> dict:
	"""Creates and submits one SMS Employee Benefit draw against an
	employee's benefit fund. The balance is always fetched fresh via
	get_employee_benefit_balance() — never a value the caller might be
	holding stale — and the draw is rejected if it would push consumption
	past the fund ceiling (reaching exactly zero headroom is allowed).

	An employee's very first-ever draw has no prior row to carry an
	available_fund forward from, so there is nothing to check against yet.
	Rather than a separate one-off "set up the fund" endpoint, the optional
	`available_fund` parameter folds that setup into this same call: pass it
	together with the employee's first draw to establish the fund ceiling at
	the same time. It is ignored on every later call (the ceiling is then
	always carried forward unchanged from the prior balance, per HR policy
	being the only thing that can move it) — if a later ceiling change is
	ever needed, that is a separate concern this function does not take on.
	"""
	if not frappe.db.exists("Employee", employee):
		frappe.throw(_("Employee {0} not found.").format(employee))

	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Benefit amount must be greater than zero."))
	if petty_cash_voucher and not frappe.db.exists("SMS Canteen PCV", petty_cash_voucher):
		frappe.throw(_("SMS Canteen PCV {0} not found.").format(petty_cash_voucher))

	balance = get_employee_benefit_balance(employee)
	is_first_draw = not frappe.db.exists(
		"SMS Employee Benefit", {"employee": employee, "docstatus": 1}
	)

	if is_first_draw:
		if available_fund is None:
			frappe.throw(
				_(
					"{0} has no benefit-fund history yet — pass available_fund to set the fund "
					"ceiling together with this first draw."
				).format(employee)
			)
		fund_ceiling = flt(available_fund)
	else:
		fund_ceiling = flt(balance["available_fund"])

	consumed_so_far = flt(balance["consumed_fund"])
	if (consumed_so_far + amount) - fund_ceiling > FLT_TOLERANCE:
		frappe.throw(
			_(
				"Benefit amount {0} would exceed the available fund for {1}: {2} already consumed "
				"of {3}."
			).format(amount, employee, consumed_so_far, fund_ceiling)
		)

	consumed_fund = flt(consumed_so_far + amount)

	doc = frappe.get_doc(
		{
			"doctype": "SMS Employee Benefit",
			"employee": employee,
			"petty_cash_voucher": petty_cash_voucher,
			"available_fund": fund_ceiling,
			"consumed_fund": consumed_fund,
			"amount": amount,
			"benefit_date": benefit_date or today(),
			"description": description,
		}
	)
	doc.insert(ignore_permissions=frappe.has_permission("SMS Employee Benefit", "create"))
	doc.submit()

	return {"name": doc.name, "available_fund": fund_ceiling, "consumed_fund": consumed_fund}
