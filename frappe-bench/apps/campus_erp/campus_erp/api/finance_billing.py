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

Payments are NOT linked back to their assessment via Payment Entry's native
"references" child table — that mechanism assumes an invoice-shaped
reference doctype (grand_total/outstanding_amount fields), and
set_missing_ref_details(force=True) unconditionally overwrites whatever
outstanding_amount a caller supplies by re-deriving it from the referenced
doc's own fields. SMS Student Assessment deliberately doesn't carry those
invoice-shaped fields (it has total_fee/receivable instead, per the
migration's own design choice not to reshape it as another Fees-alike), so
that re-derivation silently comes back as 0 and Payment Entry then rejects
the allocation as "greater than outstanding amount". Instead, the link is a
plain custom Link field on Payment Entry (sms_student_assessment, added in
campus_erp/setup/custom_fields_finance.py) that never enters that
reconciliation path at all.

"Balance owed" fields (SMS Student Assessment.receivable/payment, SMS Wallet
Account.balance) are caches only. They are never incremented — they are
always fully recomputed from the real ledger (submitted Payment Entry rows
tagged with sms_student_assessment, or submitted SMS Wallet Transaction rows)
each time, the same "recompute from source of truth, never trust an
incrementally-updated cache" pattern already used by registrar.py's
compute_grade_points.
"""

import frappe
from frappe import _
from frappe.query_builder.functions import Sum
from frappe.utils import flt

from campus_erp.api.registrar import auto_enroll_prescribed_subjects

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

	# erpnext's Payment Entry does not validate references for party_type
	# "Student" at all (get_valid_reference_doctypes() has no case for it),
	# so this is the only place that actually checks the payment makes
	# sense. Overpayment is allowed (refunds/credits happen in the real
	# world) but flagged rather than silently swallowed.
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
			"sms_student_assessment": doc.name,
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
def refresh_assessment_balance(assessment: str) -> dict:
	"""Recomputes SMS Student Assessment.payment/receivable by summing every
	submitted Payment Entry tagged with this assessment (via the
	sms_student_assessment custom field, not the native References child
	table — see the module docstring) — a full recompute from the real
	ledger, never an increment of the cached value. Written via
	frappe.db.set_value (not doc.save()) so this never re-triggers
	validate()'s one-active-assessment check.
	"""
	total_fee = frappe.db.get_value("SMS Student Assessment", assessment, "total_fee")
	if total_fee is None:
		frappe.throw(_("SMS Student Assessment {0} not found.").format(assessment))

	pe = frappe.qb.DocType("Payment Entry")
	result = (
		frappe.qb.from_(pe)
		.select(Sum(pe.paid_amount).as_("total"))
		.where((pe.sms_student_assessment == assessment) & (pe.docstatus == 1))
	).run(as_dict=True)

	payment = flt(result[0].total) if result and result[0].total is not None else 0.0
	receivable = flt(total_fee) - payment

	frappe.db.set_value("SMS Student Assessment", assessment, {"payment": payment, "receivable": receivable})
	return {"payment": payment, "receivable": receivable}


@frappe.whitelist()
def reassess_for_updated_units(pre_enrollment: str) -> dict | None:
	"""Re-submits a student's Assessment against their Pre Enrollment's
	current total_units, for the case where an Assessment was already
	submitted (Registration/Finished) before total_units changed underneath
	it - e.g. registrar.sync_curriculum_subject_to_pre_enrollments adding a
	newly-curriculum'd subject to an already-assessed student's listing. A
	still-Draft assessment needs no such correction - get_or_create_
	assessment/save_assessment already recompute tuition fresh on every
	open/save - this exists only for the submitted, GL-posted case.

	The standard Frappe correction for a submitted document is cancel +
	amend, not editing fields in place: cancel reverses the original GL
	entries (SMSStudentAssessment.on_cancel -> make_reverse_gl_entries),
	then the amended copy - same student/program/misc fees/discounts/
	payment mode, just tuition and the Tuition line of assessment_detail
	recomputed off the new total_units - resubmits and posts fresh ones
	reflecting the correction.

	Sequencing is load-bearing here, found by actually attempting this
	against synthetic data with a real payment recorded (not just reasoned
	through): a submitted Payment Entry linked via record_payment's
	sms_student_assessment field is a real Link field, so Frappe's own
	check_if_doc_is_linked blocks cancelling the original outright
	(LinkExistsError) while any Payment Entry still points to it - it has
	to be re-pointed to the amended document FIRST. But the amended
	document can't be inserted first either while the original is still
	active: SMSStudentAssessment.validate_one_active_assessment() throws
	for a second non-cancelled assessment on the same student+school_term
	unless is_reassessment is set - which is exactly what that flag is
	for, so the amended copy carries it. Net order: build and submit the
	amended copy (is_reassessment=1 sidesteps the one-active-assessment
	guard while the original is still active) -> re-point any Payment
	Entry to it -> only then cancel the original, now safely unlinked.
	payment/receivable are recomputed from the real, now-correctly-linked
	ledger via refresh_assessment_balance - never carried over as a stale
	copied value.

	Returns None if there's no submitted assessment to correct, or if
	total_units/tuition haven't actually changed (avoids a pointless
	cancel/amend cycle - and reassessment resets whatever it currently
	linked to a payment, so this must stay a true no-op when there's
	nothing to correct).
	"""
	original_name = frappe.get_all(
		"SMS Student Assessment",
		filters={"pre_enrollment": pre_enrollment, "docstatus": 1},
		pluck="name",
		limit=1,
	)
	if not original_name:
		return None
	original = frappe.get_doc("SMS Student Assessment", original_name[0])

	computed = _compute_tuition(original.program, pre_enrollment)
	if flt(computed["tuition"]) == flt(original.tuition) and flt(computed["total_units"]) == flt(original.total_units):
		return None

	payment_names = frappe.get_all(
		"Payment Entry",
		filters={"sms_student_assessment": original.name, "docstatus": 1},
		pluck="name",
	)

	# amended_from is deliberately NOT set before insert here, even though
	# it's the standard field for exactly this lineage - Document.insert()
	# runs validate_amended_from(), which requires whatever it points to to
	# already be cancelled. Original can't be cancelled yet at this point
	# (the still-linked Payment Entry blocks that - see below), so it's
	# backfilled via a plain field write once original really is cancelled,
	# purely for traceability; nothing re-validates it after insert.
	amended = frappe.copy_doc(original)
	amended.docstatus = 0
	amended.is_reassessment = 1
	amended.tuition = computed["tuition"]
	amended.total_units = computed["total_units"]
	for row in amended.assessment_detail:
		if row.item_type == "Tuition":
			row.amount = computed["tuition"]
	amended.insert(ignore_permissions=frappe.has_permission("SMS Student Assessment", "create"))
	amended.flags.ignore_permissions = True
	amended.submit()

	for payment_name in payment_names:
		frappe.db.set_value("Payment Entry", payment_name, "sms_student_assessment", amended.name)

	original.flags.ignore_permissions = True
	original.cancel()

	frappe.db.set_value("SMS Student Assessment", amended.name, "amended_from", original.name)
	refresh_assessment_balance(amended.name)

	return {
		"original": original.name,
		"amended": amended.name,
		"tuition": computed["tuition"],
		"total_units": computed["total_units"],
	}


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


def _compute_tuition(program: str, pre_enrollment: str | None) -> dict:
	"""The single source of truth for a course's per-unit Tuition Fee rate is
	the Finance > Maintenance > Tuition Fee screen (Program.tuition_fee) —
	the Assessment dialog only ever displays the computed result, never lets
	the rate or total be typed in independently. Actual Tuition Fee =
	rate x the student's total_units on their linked SMS Pre Enrollment
	(that record's own total_units is itself server-recomputed on every
	save_pre_enrollment, so this is always reading a trustworthy number).
	"""
	rate = flt(frappe.db.get_value("Program", program, "tuition_fee"))
	total_units = flt(frappe.db.get_value("SMS Pre Enrollment", pre_enrollment, "total_units")) if pre_enrollment else 0.0
	return {"rate": rate, "total_units": total_units, "tuition": rate * total_units}


def _find_default_misc_header(program: str) -> str | None:
	"""Best-effort default 'Miscellaneous' Codes and Fees header for this
	course — just the Assessment dialog's starting selection; the registrar
	can pick a different header from the dropdown. Codes and Fees headers key
	`particular` by the course's short code convention (e.g. "BSCS" for a
	Program whose course_code is "BSCS - 1", see sms_fee_header.py's own
	docstring) rather than a real Link field, so this tries the full
	course_code first and falls back to the code with any " - N" section
	suffix stripped.
	"""
	course_code = (frappe.db.get_value("Program", program, "course_code") or "").strip()
	short_code = course_code.split(" - ")[0].strip()
	for candidate in dict.fromkeys(filter(None, [course_code, short_code, program])):
		name = frappe.db.get_value(
			"SMS Fee Header", {"code_type": "Miscellaneous", "particular": candidate}, "name"
		)
		if name:
			return name
	return None


def _assessment_response(doc) -> dict:
	misc_items = [
		{"particular": row.particular, "amount": flt(row.amount)}
		for row in doc.assessment_detail
		if row.item_type == "Misc Fee"
	]
	tuition_rate = flt(frappe.db.get_value("Program", doc.program, "tuition_fee"))
	return {
		"name": doc.name,
		"docstatus": doc.docstatus,
		"status": doc.status,
		"student": doc.student,
		"student_name": doc.student_name,
		"program_enrollment": doc.program_enrollment,
		"pre_enrollment": doc.pre_enrollment,
		"program": doc.program,
		"school_year": doc.school_year,
		"school_term": doc.school_term,
		"semester": doc.semester,
		"year_level": doc.year_level,
		"posting_date": doc.posting_date,
		"tuition": flt(doc.tuition),
		"tuition_rate": tuition_rate,
		"total_units": flt(doc.total_units),
		"misc_fee": flt(doc.misc_fee),
		"misc_fee_header": doc.misc_fee_header,
		"misc_items": misc_items,
		"other_fee": flt(doc.other_fee),
		"extra_items": [
			{"particular": row.particular, "amount": flt(row.amount)}
			for row in doc.assessment_detail
			if row.item_type == "Surcharge"
		],
		"assessment": flt(doc.assessment),
		"discount_type": doc.discount_type,
		"discount_percent": flt(doc.discount_percent),
		"tuition_discount": flt(doc.other_discount),
		"misc_discount": flt(doc.misc_discount),
		"new_tuition": flt(doc.new_tuition),
		"total_fee": flt(doc.total_fee),
		"payment": flt(doc.payment),
		"receivable": flt(doc.receivable),
		"payment_mode": doc.payment_mode,
		"installment_months": doc.installment_months,
	}


@frappe.whitelist()
def get_or_create_assessment(pre_enrollment: str) -> dict:
	"""Single entry point for the Pre-Enrollment 'Assessment' button. Finds the
	student's existing (non-cancelled) assessment for this term if one
	already exists — keyed the same way validate_one_active_assessment()
	itself keys uniqueness (student + school_term) — else creates a fresh
	Draft seeded from the course's Tuition Fee and a best-effort Miscellaneous
	header match. Never creates a second assessment for the same
	student+term; the registrar edits and re-saves the same Draft instead via
	save_assessment().
	"""
	pe = frappe.db.get_value(
		"SMS Pre Enrollment",
		pre_enrollment,
		["student", "program", "academic_year", "semester", "year_level"],
		as_dict=True,
	)
	if not pe:
		frappe.throw(_("Pre Enrollment {0} not found.").format(pre_enrollment))

	school_year = frappe.db.get_value("Academic Year", pe.academic_year, "academic_year_name") or pe.academic_year
	school_term = f"{school_year} - Sem {pe.semester}"

	existing = frappe.get_all(
		"SMS Student Assessment",
		filters={"student": pe.student, "school_term": school_term, "docstatus": ["!=", 2]},
		limit_page_length=1,
		order_by="creation desc",
		pluck="name",
	)
	if existing:
		doc = frappe.get_doc("SMS Student Assessment", existing[0])
		# Re-sync Tuition (rate x total_units) on every open, while still a
		# Draft — it's never independently editable here, so a change to
		# either the Tuition Fee tab's rate or the student's enrolled units
		# since this assessment was first created should still show up.
		# Older assessments predating the pre_enrollment link get backfilled
		# with it here too, since it's always the current open's own param.
		if doc.docstatus == 0:
			backfilled = not doc.pre_enrollment
			if backfilled:
				doc.pre_enrollment = pre_enrollment
			computed = _compute_tuition(pe.program, doc.pre_enrollment)
			changed = flt(doc.tuition) != computed["tuition"] or flt(doc.total_units) != computed["total_units"]
			if changed or backfilled:
				doc.tuition = computed["tuition"]
				doc.total_units = computed["total_units"]
				for row in doc.assessment_detail:
					if row.item_type == "Tuition":
						row.amount = computed["tuition"]
				doc.save(ignore_permissions=frappe.has_permission("SMS Student Assessment", "write"))
		return _assessment_response(doc)

	program_enrollment = frappe.db.get_value(
		"Program Enrollment",
		{"student": pe.student, "program": pe.program},
		"name",
		order_by="creation desc",
	)
	if not program_enrollment:
		frappe.throw(_("No Program Enrollment found for {0} in {1}.").format(pe.student, pe.program))

	computed = _compute_tuition(pe.program, pre_enrollment)
	misc_header = _find_default_misc_header(pe.program)
	misc_rows = []
	if misc_header:
		header_doc = frappe.get_doc("SMS Fee Header", misc_header)
		misc_rows = [{"particular": r.particular, "amount": flt(r.amount)} for r in header_doc.details]

	assessment_detail = [{"particular": "Tuition Fee", "item_type": "Tuition", "amount": computed["tuition"]}]
	assessment_detail += [
		{"particular": r["particular"], "item_type": "Misc Fee", "amount": r["amount"]} for r in misc_rows
	]

	doc = frappe.get_doc(
		{
			"doctype": "SMS Student Assessment",
			"student": pe.student,
			"program_enrollment": program_enrollment,
			"pre_enrollment": pre_enrollment,
			"program": pe.program,
			"school_year": school_year,
			"school_term": school_term,
			"semester": pe.semester,
			"year_level": str(pe.year_level),
			"posting_date": frappe.utils.today(),
			"tuition": computed["tuition"],
			"total_units": computed["total_units"],
			"misc_fee": sum(r["amount"] for r in misc_rows),
			"misc_fee_header": misc_header,
			"payment_mode": "Cash",
			"installment_months": 1,
			"assessment_detail": assessment_detail,
		}
	)
	doc.insert(ignore_permissions=frappe.has_permission("SMS Student Assessment", "create"))
	return _assessment_response(doc)


@frappe.whitelist()
def save_assessment(
	name: str,
	misc_fee_header: str | None = None,
	misc_items: list | None = None,
	extra_items: list | None = None,
	discount_type: str | None = None,
	payment_mode: str = "Cash",
	installment_months: int = 1,
) -> dict:
	"""Updates a still-Draft assessment's editable inputs from the Assessment
	dialog, then submits it. Tuition is never a parameter here — it always
	tracks Program.tuition_fee (a per-unit rate, the Tuition Fee tab)
	multiplied by the linked Pre Enrollment's total_units, recomputed fresh
	on every save, the same as get_or_create_assessment does on every open.
	misc_items is the registrar's checked subset of the selected header's
	Detail rows (particular/amount pairs); extra_items is the registrar's own
	freeform additional-fee lines (e.g. "Back Subject", "ESC" per the legacy
	screen), summed into other_fee. assessment_detail is fully rebuilt from
	both rather than patched in place, mirroring save_pre_enrollment's own
	never-trust-the-client, replace-the-whole-child-table convention.

	discount_type is an optional SMS Discount code picked in the Assessment
	dialog. The same compute_discount() math the dialog previews against is
	re-run here (never trusting the client's preview numbers) and its
	tuition_discount/misc_discount become other_discount/misc_discount — the
	two fields SMSStudentAssessment.calculate_totals() nets against tuition
	to reach total_fee. Passing None/"" clears a previously-set discount back
	to zero, the same replace-in-full convention as assessment_detail below.

	The Assessment dialog has no separate Submit step of its own - Save IS
	the finalize action from the registrar/cashier's perspective, so this
	submits immediately rather than leaving a Draft that then requires an
	unrelated trip to Finance > Student Assessments (whose own manual
	Submit button stays for anything created some other way) before a
	cashier can record a payment against it under Cash Receipt.
	Submitting here runs the same ignore_permissions posture as the save
	above - reaching this whitelisted endpoint with write access is already
	the trust boundary for the whole finalize action, not just the save.
	"""
	doc = frappe.get_doc("SMS Student Assessment", name)
	if doc.docstatus != 0:
		frappe.throw(_("Assessment {0} is already submitted and can no longer be edited here.").format(name))

	misc_items = misc_items or []
	extra_items = extra_items or []

	computed = _compute_tuition(doc.program, doc.pre_enrollment)
	doc.tuition = computed["tuition"]
	doc.total_units = computed["total_units"]
	doc.misc_fee_header = misc_fee_header
	doc.misc_fee = sum(flt(item.get("amount")) for item in misc_items)
	doc.other_fee = sum(flt(item.get("amount")) for item in extra_items)
	doc.payment_mode = payment_mode
	doc.installment_months = max(1, int(installment_months or 1))

	doc.discount_type = discount_type or None
	doc.discount_percent = 0.0
	doc.other_discount = 0.0
	doc.misc_discount = 0.0
	if doc.discount_type:
		amounts = compute_discount(doc.discount_type, doc.tuition, doc.misc_fee)
		doc.other_discount = amounts["tuition_discount"]
		doc.misc_discount = amounts["misc_discount"]
		tf_discount_mode, tf_discount_value = frappe.get_cached_value(
			"SMS Discount", doc.discount_type, ["tf_discount_mode", "tf_discount_value"]
		)
		if tf_discount_mode == "Percentage":
			doc.discount_percent = flt(tf_discount_value)

	doc.set("assessment_detail", [])
	doc.append("assessment_detail", {"particular": "Tuition Fee", "item_type": "Tuition", "amount": doc.tuition})
	for item in misc_items:
		doc.append(
			"assessment_detail",
			{"particular": item.get("particular"), "item_type": "Misc Fee", "amount": flt(item.get("amount"))},
		)
	for item in extra_items:
		doc.append(
			"assessment_detail",
			{"particular": item.get("particular"), "item_type": "Surcharge", "amount": flt(item.get("amount"))},
		)

	doc.save(ignore_permissions=frappe.has_permission("SMS Student Assessment", "write"))
	doc.flags.ignore_permissions = True
	doc.submit()

	# Advance the linked Pre Enrollment to the next step of the Enrollment
	# Status stepper (Subject Listing -> Assessment -> Registration ->
	# Finished) - a submitted, GL-posted assessment is exactly what
	# "Registration" means: the student's fees for the term are locked in,
	# ready for payment. No controller hooks on SMS Pre Enrollment depend
	# on other fields alongside status, so a direct field write is enough -
	# no need for the full get_doc/save cycle for a single Select field.
	# Registration is also the point the student's schedule should populate
	# itself - auto_enroll_prescribed_subjects() enrolls them into every
	# prescribed subject's offered Student Group so the registrar doesn't
	# have to repeat that by hand in Add/Remove Subjects; anything it skips
	# (not yet offered, capacity, prerequisite) is still reachable there.
	auto_enrollment = None
	if doc.pre_enrollment:
		frappe.db.set_value("SMS Pre Enrollment", doc.pre_enrollment, "status", "Registration")
		auto_enrollment = auto_enroll_prescribed_subjects(doc.pre_enrollment)

	return {**_assessment_response(doc), "auto_enrollment": auto_enrollment}


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
