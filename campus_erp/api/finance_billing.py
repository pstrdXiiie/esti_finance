# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Finance Billing business rules (blueprint Phase 2). Per the same guiding
principle as registrar.py (blueprint §4.3): DocTypes own schema and
permissions only; every rule that used to live inline in a VB button-click
handler (or worse, re-implemented per form) lives here once instead.

SMS Student Assessment posts real GL Entry rows against the Student party
type (see its on_submit()/make_gl_entries(), mirroring Education's own Fees
doctype). Student payments are recorded as real, submitted ERPNext Payment
Entry documents rather than a shadow ledger, so the same collection reports
and account balances ERPNext already knows how to produce stay correct with
zero extra plumbing. erpnext's Payment Entry has no validation case for
party_type "Student" in get_valid_reference_doctypes() (it falls through to
None, so validate_reference_documents() never checks reference existence,
docstatus, or amount for a Student-party payment) — record_payment() below is
therefore the only gate that actually protects against a bad reference, and
it must be used instead of building Payment Entry documents ad hoc per form.

"Balance owed" fields (SMS Student Assessment.receivable/payment, SMS Wallet
Account.balance) are caches only. They are never incremented — they are
always fully recomputed from the real ledger (submitted Payment Entry
References, or submitted SMS Wallet Transaction rows) each time, the same
"recompute from source of truth, never trust an incrementally-updated cache"
pattern already used by registrar.py's compute_grade_points.
"""

import frappe
from frappe import _
from frappe.query_builder.functions import Sum
from frappe.utils import flt

from campus_erp.api.registrar import enroll


# Rounding tolerance for balance comparisons (a centavo), so float noise from
# repeated recomputation never trips an over/under-payment guard by itself.
FLT_TOLERANCE = 0.01


@frappe.whitelist()
def record_payment(
	assessment: str,
	amount: float,
	mode_of_payment: str | None = None,
	reference_no: str | None = None,
) -> dict:
	"""Single canonical entry point for recording a student's payment against
	an SMS Student Assessment. Creates and submits a real Payment Entry
	(party_type="Student") rather than a shadow ledger, then recomputes the
	assessment's payment/receivable from the real Payment Entry References —
	never trusts or increments a cached balance.
	"""
	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Payment amount must be greater than zero."))

	doc = frappe.get_doc("SMS Student Assessment", assessment)
	if doc.docstatus != 1:
		frappe.throw(
			_("Assessment {0} must be submitted before a payment can be recorded against it.").format(assessment)
		)

	# erpnext's Payment Entry.validate_reference_documents() skips party_type
	# "Student" entirely (get_valid_reference_doctypes() has no case for it),
	# but validate_allocated_amount() and the set_missing_ref_details(force=True)
	# call just before it in validate() apply regardless of party_type --
	# the latter recomputes each reference row's outstanding_amount from
	# get_reference_details(), which falls back to
	# ref_doc.get("grand_total") - ref_doc.get("advance_paid") for any
	# reference doctype it doesn't special-case. SMS Student Assessment
	# mirrors total_fee/payment onto grand_total/advance_paid (see
	# calculate_totals()) specifically so that recompute lands on the real
	# outstanding figure instead of silently zeroing it. So this check below
	# is a genuine second opinion, not the only one -- and overpayment is
	# allowed here (refunds/credits happen in the real world) but flagged
	# rather than silently swallowed.
	if amount - flt(doc.receivable) > FLT_TOLERANCE:
		frappe.msgprint(
			_("Payment of {0} exceeds the outstanding receivable of {1} for {2}. Recording as an overpayment.").format(
				amount, doc.receivable, assessment
			)
		)

	paid_to = frappe.get_cached_value("Company", doc.company, "default_cash_account")
	if not paid_to:
		frappe.throw(_("Company {0} has no Default Cash Account configured.").format(doc.company))

	pe = frappe.get_doc(
		{
			"doctype": "Payment Entry",
			"payment_type": "Receive",
			"party_type": "Student",
			"party": doc.student,
			"party_name": doc.student_name,
			"company": doc.company,
			"paid_from": doc.receivable_account,
			"paid_to": paid_to,
			"paid_amount": amount,
			"received_amount": amount,
			"reference_no": reference_no or "N/A",
			"reference_date": frappe.utils.today(),
			"references": [
				{
					"reference_doctype": "SMS Student Assessment",
					"reference_name": doc.name,
					"allocated_amount": amount,
					"total_amount": doc.total_fee,
					"outstanding_amount": doc.receivable,
				}
			],
		}
	)
	if mode_of_payment:
		pe.mode_of_payment = mode_of_payment

	pe.insert(ignore_permissions=frappe.has_permission("Payment Entry", "create"))
	pe.submit()

	balance = refresh_assessment_balance(doc.name)
	return {
		"payment_entry": pe.name,
		"assessment_payment": balance["payment"],
		"assessment_receivable": balance["receivable"],
	}


@frappe.whitelist()
def record_payment_other_than_assessment(
	student: str,
	account_charged: str,
	amount: float,
	mode_of_payment: str | None = None,
	reference_no: str | None = None,
) -> dict:
	"""Records a student payment that isn't tied to an SMS Student Assessment
	(the legacy screen's "Student Payment (Other than Assessment)" option) --
	e.g. miscellaneous fees or other one-off charges. Posts directly against a
	manually chosen account rather than a receivable pulled from an
	assessment, and creates no Payment Entry Reference since there's no
	source document to reconcile against.
	"""
	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Payment amount must be greater than zero."))

	student_doc = frappe.get_doc("Student", student)
	company = frappe.defaults.get_global_default("company")
	if not company:
		frappe.throw(_("No default Company is configured for this site."))

	paid_to = frappe.get_cached_value("Company", company, "default_cash_account")
	if not paid_to:
		frappe.throw(_("Company {0} has no Default Cash Account configured.").format(company))

	pe = frappe.get_doc(
		{
			"doctype": "Payment Entry",
			"payment_type": "Receive",
			"party_type": "Student",
			"party": student_doc.name,
			"party_name": student_doc.student_name,
			"company": company,
			"paid_from": account_charged,
			"paid_to": paid_to,
			"paid_amount": amount,
			"received_amount": amount,
			"reference_no": reference_no or "N/A",
			"reference_date": frappe.utils.today(),
		}
	)
	if mode_of_payment:
		pe.mode_of_payment = mode_of_payment

	pe.insert(ignore_permissions=frappe.has_permission("Payment Entry", "create"))
	pe.submit()

	return {"payment_entry": pe.name}


@frappe.whitelist()
def refresh_assessment_balance(assessment: str) -> dict:
	"""Recomputes SMS Student Assessment.payment/receivable by summing every
	submitted Payment Entry Reference row against this assessment — a full
	recompute from the real ledger, never an increment of the cached value.
	Written via frappe.db.set_value (not doc.save()) so this never re-triggers
	validate()'s one-active-assessment check.
	"""
	total_fee = frappe.db.get_value("SMS Student Assessment", assessment, "total_fee")
	if total_fee is None:
		frappe.throw(_("SMS Student Assessment {0} not found.").format(assessment))

	per = frappe.qb.DocType("Payment Entry Reference")
	pe = frappe.qb.DocType("Payment Entry")
	result = (
		frappe.qb.from_(per)
		.join(pe)
		.on(per.parent == pe.name)
		.select(Sum(per.allocated_amount).as_("total"))
		.where(
			(per.reference_doctype == "SMS Student Assessment")
			& (per.reference_name == assessment)
			& (pe.docstatus == 1)
		)
	).run(as_dict=True)

	payment = flt(result[0].total) if result and result[0].total is not None else 0.0
	receivable = flt(total_fee) - payment

	frappe.db.set_value(
		"SMS Student Assessment",
		assessment,
		# advance_paid kept in lockstep with payment -- see calculate_totals's
		# comment on grand_total/advance_paid. This write bypasses validate()
		# (same reason as payment/receivable above), so nothing else keeps it
		# in sync for a doc that's already submitted.
		{"payment": payment, "receivable": receivable, "advance_paid": payment},
	)
	return {"payment": payment, "receivable": receivable}


@frappe.whitelist()
def compute_discount(discount_code: str, tuition: float, misc_fee: float) -> dict:
	"""Pure calculation helper mirroring the legacy's discount-calc logic in
	one place, for the frontend to call before an SMS Student Assessment is
	even created (rather than duplicating this math per form — one of the
	original blueprint's flagged tech-debt items).
	"""
	discount = frappe.get_doc("SMS Discount", discount_code)
	if discount.is_disabled:
		frappe.throw(_("Discount {0} is disabled.").format(discount_code))

	tuition = flt(tuition)
	misc_fee = flt(misc_fee)

	if discount.tf_discount_mode == "Fixed Amount":
		tuition_discount = flt(discount.tf_discount_value)
	elif discount.tf_discount_mode == "Percentage":
		base = tuition
		if discount.on_tf and discount.tf_base == "Tuition + Misc":
			base = tuition + misc_fee
		tuition_discount = base * flt(discount.tf_discount_value) / 100
	else:
		tuition_discount = 0.0

	if discount.misc_discount_mode == "Fixed Amount":
		misc_discount = flt(discount.misc_discount_value)
	elif discount.misc_discount_mode == "Percentage":
		misc_discount = misc_fee * flt(discount.misc_discount_value) / 100
	else:
		misc_discount = 0.0

	return {"tuition_discount": flt(tuition_discount), "misc_discount": flt(misc_discount)}


def _ensure_wallet_enabled() -> None:
	if not frappe.db.get_single_value("Education Settings", "enable_wallet"):
		frappe.throw(_("The Wallet feature is not enabled (Education Settings > Enable Wallet)."))


@frappe.whitelist()
def wallet_topup(wallet_account: str, amount: float, particular: str | None = None) -> dict:
	"""Creates and submits an SMS Wallet Transaction crediting a top-up. The
	doctype's own on_submit() fully recomputes SMS Wallet Account.balance from
	all submitted transactions — this function never writes balance directly.
	"""
	_ensure_wallet_enabled()
	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Top-up amount must be greater than zero."))
	if not frappe.db.exists("SMS Wallet Account", wallet_account):
		frappe.throw(_("Wallet Account {0} not found.").format(wallet_account))

	txn = frappe.get_doc(
		{
			"doctype": "SMS Wallet Transaction",
			"wallet_account": wallet_account,
			"transaction_type": "Top-up",
			"credit": amount,
			"particular": particular,
		}
	)
	txn.insert(ignore_permissions=frappe.has_permission("SMS Wallet Transaction", "create"))
	txn.submit()
	return {"name": txn.name, "balance": frappe.db.get_value("SMS Wallet Account", wallet_account, "balance")}


@frappe.whitelist()
def wallet_payment(wallet_account: str, amount: float, particular: str | None = None) -> dict:
	"""Creates and submits an SMS Wallet Transaction debiting a payment.
	Checks the wallet's current balance fresh from the database (never a
	value the caller might be holding stale) before allowing the debit.
	"""
	_ensure_wallet_enabled()
	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Payment amount must be greater than zero."))
	if not frappe.db.exists("SMS Wallet Account", wallet_account):
		frappe.throw(_("Wallet Account {0} not found.").format(wallet_account))

	current_balance = flt(frappe.db.get_value("SMS Wallet Account", wallet_account, "balance"))
	if amount - current_balance > FLT_TOLERANCE:
		frappe.throw(
			_("Insufficient wallet balance: available {0}, requested {1}.").format(current_balance, amount)
		)

	txn = frappe.get_doc(
		{
			"doctype": "SMS Wallet Transaction",
			"wallet_account": wallet_account,
			"transaction_type": "Payment",
			"debit": amount,
			"particular": particular,
		}
	)
	txn.insert(ignore_permissions=frappe.has_permission("SMS Wallet Transaction", "create"))
	txn.submit()
	return {"name": txn.name, "balance": frappe.db.get_value("SMS Wallet Account", wallet_account, "balance")}


@frappe.whitelist()
def get_wallet_balance(wallet_account: str) -> dict:
	"""Thin read accessor for the frontend. Balance is a recomputed cache
	(see SMS Wallet Transaction.refresh_wallet_balance()); callers should go
	through this rather than assuming a direct /api/resource/ read is the
	source of truth.
	"""
	return {"balance": frappe.db.get_value("SMS Wallet Account", wallet_account, "balance")}


@frappe.whitelist()
def record_past_receivable(student: str, as_of_date: str | None = None) -> dict:
	"""Thin snapshot-log writer for the scheduled job the migration blueprint
	calls for (another step owns the actual cron wiring in hooks.py). Sums
	the student's real GL Entry rows (party_type="Student") fresh every time
	rather than trusting any cached balance.
	"""
	if not frappe.db.exists("Student", student):
		frappe.throw(_("Student {0} not found.").format(student))

	gle = frappe.qb.DocType("GL Entry")
	result = (
		frappe.qb.from_(gle)
		.select((Sum(gle.debit) - Sum(gle.credit)).as_("receivable"))
		.where((gle.party_type == "Student") & (gle.party == student) & (gle.is_cancelled == 0))
	).run(as_dict=True)

	receivable = flt(result[0].receivable) if result and result[0].receivable is not None else 0.0

	doc = frappe.get_doc(
		{
			"doctype": "SMS Past Receivable",
			"student": student,
			"receivable": receivable,
			"as_of_date": as_of_date or frappe.utils.today(),
		}
	)
	doc.insert(ignore_permissions=frappe.has_permission("SMS Past Receivable", "create"))
	return {"name": doc.name, "receivable": receivable}


def _sanitized_receivable_account(company_doc) -> str | None:
	"""Company.default_receivable_account is a plain default setting, not
	itself validated against real Account records — on this site it
	currently points at an Account that was never actually created (a
	pre-existing chart-of-accounts gap, unrelated to this feature). Returns
	it only when it resolves to something real; None otherwise, since the
	field is optional here — record_payment() will need it fixed before an
	actual payment can be posted against an assessment missing it.

	Must be re-applied before every save, not just at creation: something
	elsewhere in this site's setup (not this file, not campus_erp's hooks.py
	— no doc_events/Property Setter/fetch_from was found on this field)
	re-populates receivable_account from the Company default on every
	doc.save()/insert(), even when it was explicitly left unset going in.
	"""
	receivable_account = company_doc.default_receivable_account
	if receivable_account and not frappe.db.exists("Account", receivable_account):
		return None
	return receivable_account


def _lookup_program_enrollment(student: str) -> str:
	program_enrollment = frappe.get_all(
		"Program Enrollment",
		filters={"student": student},
		order_by="creation desc",
		limit=1,
		pluck="name",
	)
	if not program_enrollment:
		frappe.throw(_("Student {0} has no Program Enrollment on record.").format(student))
	return program_enrollment[0]


def _auto_enroll_from_pre_enrollment(student: str, school_year: str, semester: int) -> dict | None:
	"""Best-effort auto-enroll into whichever offered class (Student Group)
	matches each of the student's prescribed subjects for this term — same
	logic as registrar.save_pre_enrollment's own pass, re-run here since
	Assessment (not Pre-Enrollment) is this app's actual point of no return
	for a term, and a registrar isn't necessarily re-saving Pre-Enrollment
	again after this. Returns None if there's no Pre-Enrollment on record for
	this student/term at all (shouldn't normally happen, since Assessment is
	only ever reached from an existing Pre-Enrollment, but this function
	doesn't assume that).
	"""
	pre_enrollments = frappe.get_all(
		"SMS Pre Enrollment",
		filters={"student": student, "academic_year": school_year, "semester": semester},
		limit=1,
		pluck="name",
	)
	if not pre_enrollments:
		return None
	pe_doc = frappe.get_doc("SMS Pre Enrollment", pre_enrollments[0])

	enrolled, skipped, failed = [], [], []
	for row in pe_doc.subjects:
		offered = frappe.get_all(
			"Student Group",
			filters={
				"program": pe_doc.program,
				"academic_year": pe_doc.academic_year,
				"course": row.subject,
				"group_based_on": "Course",
			},
			pluck="name",
		)
		if not offered:
			skipped.append({"subject": row.subject, "reason": _("No offered class found for this subject.")})
			continue
		if len(offered) > 1:
			skipped.append({
				"subject": row.subject,
				"reason": _("Multiple classes offered — choose one in Add/Remove Subjects."),
			})
			continue

		already_enrolled = frappe.get_all(
			"Course Enrollment",
			filters={"student": student, "student_group": offered[0]},
			limit=1,
		)
		if already_enrolled:
			enrolled.append({"subject": row.subject, "student_group": offered[0]})
			continue

		try:
			enroll(student, offered[0])
			enrolled.append({"subject": row.subject, "student_group": offered[0]})
		except Exception as e:
			failed.append({"subject": row.subject, "reason": str(e)})

	return {"enrolled": enrolled, "skipped": skipped, "failed": failed}


def _assessment_response(
	doc, auto_enrollment: dict | None = None, payment_mode: str = "Cash", installment_months: int = 1
) -> dict:
	misc_items = [
		{"particular": r.particular, "amount": r.amount}
		for r in doc.assessment_detail
		if r.item_type == "Misc Fee"
	]
	extra_items = [
		{"particular": r.particular, "amount": r.amount}
		for r in doc.assessment_detail
		if r.item_type == "Surcharge"
	]

	program_doc = frappe.get_cached_doc("Program", doc.program) if doc.program else None
	tuition_rate = flt(program_doc.get("tuition_fee")) if program_doc else 0.0

	pre_enrollment = frappe.get_all(
		"SMS Pre Enrollment",
		filters={"student": doc.student, "academic_year": doc.school_year, "semester": doc.semester},
		fields=["total_units"],
		limit=1,
	)
	total_units = pre_enrollment[0].total_units if pre_enrollment else 0

	return {
		"name": doc.name,
		"docstatus": doc.docstatus,
		"status": doc.status,
		"student": doc.student,
		"student_name": doc.student_name,
		"program_enrollment": doc.program_enrollment,
		"program": doc.program,
		"school_year": doc.school_year,
		"school_term": doc.school_term,
		"semester": doc.semester,
		"year_level": doc.year_level,
		"posting_date": str(doc.posting_date),
		"tuition": doc.tuition,
		"tuition_rate": tuition_rate,
		"total_units": total_units,
		"misc_fee": doc.misc_fee,
		# Which SMS Fee Header the misc_items came from isn't persisted on
		# this doctype (it has no field for it, and adding one wasn't worth
		# a second custom-field ask on top of everything else this feature
		# already needed) — always None here. The only user-visible effect:
		# reopening a saved assessment shows every fee under the
		# last-selected header pre-checked rather than restoring the exact
		# original checkbox state. misc_items itself (the actual saved fee
		# lines) is unaffected either way.
		"misc_fee_header": None,
		"misc_items": misc_items,
		"other_fee": doc.other_fee,
		"extra_items": extra_items,
		"assessment": doc.assessment,
		"discount_type": doc.discount_type,
		"discount_percent": doc.discount_percent,
		# other_discount/misc_discount are the doctype's own real fields (the
		# controller's calculate_totals() uses other_discount, not a separate
		# "tuition_discount" field, to compute new_tuition) — read back
		# directly rather than recomputed, so this can never drift from what
		# was actually saved.
		"tuition_discount": flt(doc.other_discount),
		"misc_discount": flt(doc.misc_discount),
		"new_tuition": doc.new_tuition,
		"total_fee": doc.total_fee,
		"payment": doc.payment,
		"receivable": doc.receivable,
		# Not persisted (see save_assessment) — echoed back from what the
		# caller most recently sent, defaulting to Cash/1 when reopening an
		# existing assessment with nothing to echo.
		"payment_mode": payment_mode,
		"installment_months": installment_months,
		"auto_enrollment": auto_enrollment,
	}


@frappe.whitelist()
def get_or_create_assessment(pre_enrollment: str) -> dict:
	"""Get-or-create the SMS Student Assessment for one Pre-Enrollment's term.

	SMS Student Assessment has no link field back to SMS Pre Enrollment, so
	the lookup key is (student, program_enrollment, school_year, semester) —
	the same natural key already implied by check_prerequisites'/enroll's own
	Program Enrollment lookup elsewhere in registrar.py. Only ever derives a
	fresh Tuition figure (from Program.tuition_fee × Pre Enrollment.total_units)
	on first creation; an already-existing assessment's saved figures are
	returned as-is — the registrar's actual Misc/Discount/Payment choices are
	applied only by save_assessment, never silently recomputed just from
	reopening this.

	Only sets the raw inputs (tuition, blank misc/discount) — assessment /
	new_tuition / total_fee / receivable are deliberately left for the real
	SMS Student Assessment controller's own validate() (calculate_totals(),
	set_missing_accounts_and_fields()) to compute on insert, exactly as it
	would for any other consumer of this doctype, rather than duplicating
	that formula here and risking the two silently drifting apart.
	"""
	pe_doc = frappe.get_doc("SMS Pre Enrollment", pre_enrollment)
	program_enrollment = _lookup_program_enrollment(pe_doc.student)

	existing = frappe.get_all(
		"SMS Student Assessment",
		filters={
			"student": pe_doc.student,
			"program_enrollment": program_enrollment,
			"school_year": pe_doc.academic_year,
			"semester": pe_doc.semester,
		},
		limit=1,
	)
	if existing:
		return _assessment_response(frappe.get_doc("SMS Student Assessment", existing[0].name))

	company = frappe.defaults.get_global_default("company")
	if not company:
		frappe.throw(_("No default Company is configured for this site."))
	company_doc = frappe.get_cached_doc("Company", company)

	program_doc = frappe.get_cached_doc("Program", pe_doc.program)
	tuition_rate = flt(program_doc.get("tuition_fee"))
	tuition = flt(pe_doc.total_units) * tuition_rate

	doc = frappe.get_doc({
		"doctype": "SMS Student Assessment",
		"student": pe_doc.student,
		"student_name": pe_doc.student_name,
		"program_enrollment": program_enrollment,
		"program": pe_doc.program,
		"company": company,
		"currency": company_doc.default_currency,
		"school_year": pe_doc.academic_year,
		"school_term": f"Semester {pe_doc.semester}",
		"semester": pe_doc.semester,
		"year_level": str(pe_doc.year_level),
		"posting_date": frappe.utils.today(),
		"tuition": tuition,
		"misc_fee": 0,
		"other_fee": 0,
		"payment": 0,
		"receivable_account": _sanitized_receivable_account(company_doc),
		"status": "Draft",
		"assessment_detail": [{"particular": "Tuition Fee", "item_type": "Tuition", "amount": tuition}],
	})
	doc.insert(ignore_permissions=frappe.has_permission("SMS Student Assessment", "create"))
	return _assessment_response(doc)


@frappe.whitelist()
def save_assessment(
	name: str,
	misc_fee_header: str | None,
	misc_items: list[dict],
	extra_items: list[dict],
	discount_type: str | None,
	payment_mode: str,
	installment_months: int,
) -> dict:
	"""Finalize an SMS Student Assessment: apply the chosen Miscellaneous
	items / Additional Fees / Discount, then submit. assessment / new_tuition
	/ total_fee / receivable are left to the controller's own validate() to
	(re)compute from the raw inputs set here (misc_fee, other_fee,
	other_discount, misc_discount) — same reasoning as get_or_create_assessment.

	payment_mode/installment_months are NOT persisted anywhere: SMS Student
	Assessment's payment_schedule child table isn't read by record_payment()
	or refresh_assessment_balance() (a payment is recorded against the whole
	assessment, not a specific installment row), so building it would add a
	second, unused source of truth rather than serve any real consumer. The
	frontend's own preview math already shows the per-month figure before
	Save; this only needs to echo the choice back, not act on it.

	Also runs the same best-effort auto-enrollment pass as
	registrar.save_pre_enrollment (see _auto_enroll_from_pre_enrollment),
	since Assessment — not Pre-Enrollment — is this app's real point of no
	return for a term.
	"""
	doc = frappe.get_doc("SMS Student Assessment", name)

	misc_fee = sum(flt(i.get("amount")) for i in misc_items)
	other_fee = sum(flt(i.get("amount")) for i in extra_items)

	if discount_type:
		discount = compute_discount(discount_type, doc.tuition, misc_fee)
		tuition_discount = discount["tuition_discount"]
		misc_discount = discount["misc_discount"]
	else:
		tuition_discount = 0.0
		misc_discount = 0.0

	detail = [{"particular": "Tuition Fee", "item_type": "Tuition", "amount": doc.tuition}]
	for item in misc_items:
		detail.append({
			"particular": item.get("particular"),
			"item_type": "Misc Fee",
			"amount": flt(item.get("amount")),
		})
	for item in extra_items:
		detail.append({
			"particular": item.get("particular"),
			"item_type": "Surcharge",
			"amount": flt(item.get("amount")),
		})
	if tuition_discount or misc_discount:
		detail.append({
			"particular": "Discount",
			"item_type": "Discount",
			"amount": tuition_discount + misc_discount,
		})

	doc.misc_fee = misc_fee
	doc.other_fee = other_fee
	doc.discount_type = discount_type
	doc.other_discount = tuition_discount
	doc.misc_discount = misc_discount
	doc.status = "Assessed"
	doc.set("assessment_detail", detail)
	# The controller's set_missing_accounts_and_fields() re-populates
	# receivable_account from Company.default_receivable_account whenever
	# it's left blank — re-sanitized here (and again below, since submit()
	# runs its own independent save cycle) rather than once up front.
	doc.receivable_account = _sanitized_receivable_account(frappe.get_cached_doc("Company", doc.company))

	doc.save(ignore_permissions=frappe.has_permission("SMS Student Assessment", "write", doc=doc))
	doc.receivable_account = _sanitized_receivable_account(frappe.get_cached_doc("Company", doc.company))
	doc.submit()

	auto_enrollment = _auto_enroll_from_pre_enrollment(doc.student, doc.school_year, doc.semester)

	return _assessment_response(
		doc, auto_enrollment, payment_mode=payment_mode, installment_months=int(installment_months or 1)
	)


