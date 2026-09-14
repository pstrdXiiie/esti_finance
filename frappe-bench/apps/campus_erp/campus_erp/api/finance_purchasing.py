# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Finance Purchasing business rules (blueprint Phase 2). Per the same guiding
principle as registrar.py (blueprint §4.3): DocTypes own schema and
permissions only, every rule lives here once. This module deliberately reuses
real ERPNext doctypes for procurement (Material Request as Purchase
Requisition, Purchase Order as-is) rather than duplicating them — see
campus_erp/setup/custom_fields_finance.py for the handful of Custom Fields
that carry the legacy-specific data (branch, requested_by, pr_purpose,
supplier-per-line, settlement_reference, payables_settled) those native
doctypes were missing.
"""

import frappe
from erpnext.stock.doctype.material_request.material_request import make_purchase_order
from frappe import _
from frappe.utils import date_diff, flt, today


@frappe.whitelist()
def create_purchase_orders_from_requisition(material_request: str) -> dict:
	"""Groups a submitted Material Request's (Purchase Requisition's) items by
	their (Custom Field) supplier into one Purchase Order per distinct
	supplier. Uses ERPNext's own native Material Request -> Purchase Order
	mapper (erpnext.stock.doctype.material_request.material_request.
	make_purchase_order) rather than re-implementing PO creation from
	scratch; this function only adds the per-supplier split on top. Created
	Purchase Orders are left as Draft — the Purchasing Officer reviews and
	submits manually.
	"""
	mr_doc = frappe.get_doc("Material Request", material_request)
	if mr_doc.docstatus != 1:
		frappe.throw(
			_("Material Request {0} must be submitted before Purchase Orders can be created from it.").format(
				material_request
			)
		)
	if mr_doc.material_request_type != "Purchase":
		frappe.throw(
			_("Material Request {0} is not a Purchase requisition (type is {1}).").format(
				material_request, mr_doc.material_request_type
			)
		)

	# supplier lives on Material Request Item (custom field) — keyed by row
	# name so we can look it up again from the Purchase Order Item rows the
	# native mapper produces (each of which carries material_request_item
	# back to its source row).
	supplier_by_row = {row.name: row.supplier for row in mr_doc.items}
	missing = [row.item_code or row.name for row in mr_doc.items if not row.supplier]
	if missing:
		frappe.throw(
			_(
				"These Material Request items have no Supplier set — a Supplier is required on every "
				"line before Purchase Orders can be created: {0}"
			).format(", ".join(missing))
		)

	draft = make_purchase_order(source_name=material_request)
	if not draft.items:
		frappe.throw(
			_("Material Request {0} has no items left to order (already fully ordered).").format(
				material_request
			)
		)

	suppliers_by_draft_row = []
	for row in draft.items:
		supplier = supplier_by_row.get(row.material_request_item)
		if not supplier:
			frappe.throw(
				_("Could not resolve a Supplier for Material Request item {0}.").format(
					row.material_request_item
				)
			)
		suppliers_by_draft_row.append(supplier)
	distinct_suppliers = sorted(set(suppliers_by_draft_row))

	created = []
	if len(distinct_suppliers) == 1:
		if not draft.supplier:
			draft.supplier = distinct_suppliers[0]
		draft.insert(ignore_permissions=frappe.has_permission("Purchase Order", "create"))
		created.append(draft.name)
	else:
		# Split the single mapped draft across N Purchase Order docs, one per
		# distinct supplier, copying header fields from the first draft.
		table_fieldnames = {df.fieldname for df in draft.meta.fields if df.fieldtype in ("Table", "Table MultiSelect")}
		header_skip = {"name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "amended_from"}
		header_skip |= table_fieldnames
		row_skip = {"name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "parent", "parentfield", "parenttype"}

		for supplier in distinct_suppliers:
			new_po = frappe.new_doc("Purchase Order")
			for fieldname, value in draft.as_dict().items():
				if fieldname in header_skip or fieldname.startswith("_"):
					continue
				new_po.set(fieldname, value)
			new_po.supplier = supplier

			for row, row_supplier in zip(draft.items, suppliers_by_draft_row):
				if row_supplier != supplier:
					continue
				row_dict = {k: v for k, v in row.as_dict().items() if k not in row_skip}
				new_po.append("items", row_dict)

			new_po.insert(ignore_permissions=frappe.has_permission("Purchase Order", "create"))
			created.append(new_po.name)

	return {"purchase_orders": created}


@frappe.whitelist()
def approve_purchase_requisition(
	material_request: str,
	approval_status: str,
	recommending_approval: str | None = None,
	approval_remarks: str | None = None,
) -> dict:
	"""Backs the Purchase Requisition Approval screen. Material Request has no
	native approval workflow of its own, so this drives the `approval_status`
	Custom Field (campus_erp/setup/custom_fields_finance.py) directly: Approved
	submits the document (docstatus 0 -> 1), which is what
	create_purchase_orders_from_requisition requires; Denied leaves it as
	Draft with the remark recorded, which naturally blocks PO creation.
	"""
	if approval_status not in ("Pending", "Approved", "Denied"):
		frappe.throw(_("Approval Status must be Pending, Approved, or Denied."))

	mr_doc = frappe.get_doc("Material Request", material_request)
	if mr_doc.docstatus != 0:
		frappe.throw(_("Material Request {0} has already been submitted.").format(material_request))

	mr_doc.approval_status = approval_status
	mr_doc.recommending_approval = recommending_approval
	mr_doc.approval_remarks = approval_remarks
	mr_doc.approved_by = frappe.session.user
	mr_doc.approval_date = today()
	mr_doc.save(ignore_permissions=frappe.has_permission("Material Request", "write"))

	if approval_status == "Approved":
		mr_doc.submit()

	return {"name": mr_doc.name, "approval_status": mr_doc.approval_status, "docstatus": mr_doc.docstatus}


@frappe.whitelist()
def get_due_purchase_order_payables(supplier: str | None = None) -> list[dict]:
	"""Backs the Due Purchase Order Payables screen. There is no separate "SMS
	Due Purchase Order Payable" doctype — this reads submitted Purchase
	Orders directly, the same way get_purchase_order_aging computes aging
	live rather than from a stored column. `payables_settled` / `settlement_
	reference` (custom_fields_finance.py) track which POs have already been
	paid via settle_purchase_order_payable, below.
	"""
	filters: dict = {"docstatus": 1, "payables_settled": 0}
	if supplier:
		filters["supplier"] = ["like", f"%{supplier}%"]

	orders = frappe.get_all(
		"Purchase Order",
		filters=filters,
		fields=[
			"name",
			"supplier",
			"supplier_name",
			"transaction_date",
			"tc_name",
			"total_taxes_and_charges",
			"grand_total",
		],
		order_by="transaction_date asc",
	)

	rows = []
	for po in orders:
		rows.append(
			{
				"ponum": po.name,
				"supcode": po.supplier,
				"supname": po.supplier_name,
				"podate": po.transaction_date,
				"date_posted": "",
				"sinum": "",
				"poterms": po.tc_name or "",
				"potax": flt(po.total_taxes_and_charges),
				"poamount": flt(po.grand_total),
				"aging": date_diff(today(), po.transaction_date) if po.transaction_date else 0,
			}
		)
	return rows


@frappe.whitelist()
def settle_purchase_order_payable(
	purchase_order: str,
	si_number: str | None = None,
	check_number: str | None = None,
	check_date: str | None = None,
	accounts: list[dict] | None = None,
) -> dict:
	"""Settles a due Purchase Order payable, mirroring
	create_replenishment_voucher's PCV-settlement pattern: builds and submits
	a real Journal Entry from the on-screen GL grid, balanced against the
	PO's grand_total, then marks the PO as settled.
	"""
	if isinstance(accounts, str):
		accounts = frappe.parse_json(accounts)
	if not accounts:
		frappe.throw(_("Add at least one General Ledger entry before settling this payable."))

	po = frappe.get_doc("Purchase Order", purchase_order)
	if po.docstatus != 1:
		frappe.throw(_("Purchase Order {0} must be submitted before its payable can be settled.").format(purchase_order))
	if po.payables_settled:
		frappe.throw(_("Purchase Order {0} has already been settled.").format(purchase_order))

	debit_total = sum(flt(row.get("debit")) for row in accounts)
	credit_total = sum(flt(row.get("credit")) for row in accounts)
	if abs(flt(debit_total, 2) - flt(credit_total, 2)) > 0.005:
		frappe.throw(_("Debits and credits must match before settling this payable."))
	if abs(flt(debit_total, 2) - flt(po.grand_total, 2)) > 0.005:
		frappe.throw(
			_("General Ledger total {0} does not match the Purchase Order amount {1}.").format(
				flt(debit_total, 2), flt(po.grand_total, 2)
			)
		)

	company_doc = frappe.get_doc("Company", po.company)
	if not company_doc.cost_center:
		frappe.throw(_("Company {0} has no default Cost Center configured.").format(po.company))

	je = frappe.new_doc("Journal Entry")
	je.voucher_type = "Bank Entry" if check_number else "Journal Entry"
	je.posting_date = check_date or today()
	je.company = po.company
	je.cheque_no = check_number
	je.cheque_date = check_date
	je.user_remark = _("Purchase Order {0} payable settlement{1}").format(
		purchase_order, f" (SI# {si_number})" if si_number else ""
	)
	for row in accounts:
		account = row.get("account")
		row_data = {
			"account": account,
			"debit_in_account_currency": flt(row.get("debit")),
			"credit_in_account_currency": flt(row.get("credit")),
			"cost_center": company_doc.cost_center,
		}
		# Payable-type accounts (e.g. booking straight against Accounts Payable)
		# require a party — GL Entry.check_mandatory() rejects a Payable-account
		# line with no party_type/party, same as any supplier-facing voucher.
		if frappe.db.get_value("Account", account, "account_type") == "Payable":
			row_data["party_type"] = "Supplier"
			row_data["party"] = po.supplier
		je.append("accounts", row_data)
	je.insert(ignore_permissions=frappe.has_permission("Journal Entry", "create"))
	je.submit()

	frappe.db.set_value(
		"Purchase Order", purchase_order, {"payables_settled": 1, "settlement_reference": je.name}
	)

	return {"journal_entry": je.name, "purchase_order": purchase_order}


@frappe.whitelist()
def get_purchase_order_aging(purchase_order: str) -> dict:
	"""Live-computed replacement for the legacy's stored `aging_days` column,
	which the migration blueprint notes was never actually populated by the
	legacy system. Always recomputed from Purchase Order.transaction_date,
	never stored.
	"""
	po = frappe.get_doc("Purchase Order", purchase_order)
	if not po.transaction_date:
		frappe.throw(_("Purchase Order {0} has no Date set — cannot compute aging.").format(purchase_order))
	return {"aging_days": date_diff(today(), po.transaction_date)}


@frappe.whitelist()
def create_replenishment_voucher(pcv_names: list[str], company: str) -> dict:
	"""Consolidates N submitted, not-yet-replenished SMS Canteen PCVs into one
	real Journal Entry (voucher_type="Cash Entry"), replacing the legacy's
	manual per-branch cash reconciliation. This moves real money: every PCV
	is validated, debit lines are grouped by account across ALL selected
	PCVs, and the grouped total is asserted to balance against the summed
	PCV amounts before the Journal Entry is ever submitted.
	"""
	if isinstance(pcv_names, str):
		pcv_names = frappe.parse_json(pcv_names)
	if not pcv_names:
		frappe.throw(_("Select at least one SMS Canteen PCV to replenish."))
	if not company:
		frappe.throw(_("Company is required to post the replenishment Journal Entry."))

	pcvs = []
	failures = []
	for name in pcv_names:
		pcv = frappe.get_doc("SMS Canteen PCV", name)
		if pcv.docstatus != 1:
			failures.append(_("{0} (not submitted)").format(name))
			continue
		if pcv.replenished:
			failures.append(_("{0} (already replenished)").format(name))
			continue
		pcvs.append(pcv)
	if failures:
		frappe.throw(_("These PCVs cannot be replenished: {0}").format(", ".join(failures)))

	company_doc = frappe.get_doc("Company", company)
	if not company_doc.default_cash_account:
		frappe.throw(_("Company {0} has no Default Cash Account configured.").format(company))
	cost_center = company_doc.cost_center
	if not cost_center:
		frappe.throw(
			_(
				"Company {0} has no default Cost Center configured, and there is no "
				"Branch -> Cost Center mapping to fall back to."
			).format(company)
		)

	# Sum each PCV's total, and each detail line's account + debit_amount,
	# across ALL selected PCVs, grouping by account.
	account_totals: dict[str, float] = {}
	grand_total = 0.0
	for pcv in pcvs:
		grand_total += flt(pcv.amount)
		if not pcv.details:
			frappe.throw(_("PCV {0} has no detail lines.").format(pcv.name))
		for row in pcv.details:
			if not row.account:
				frappe.throw(_("PCV {0} has a detail line with no Account set.").format(pcv.name))
			account_totals[row.account] = account_totals.get(row.account, 0.0) + flt(row.debit_amount)

	debit_total = sum(account_totals.values())
	if abs(flt(debit_total, 2) - flt(grand_total, 2)) > 0.005:
		frappe.throw(
			_(
				"PCV detail lines total {0} does not match the PCV amount total {1} — "
				"refusing to post an unbalanced Journal Entry."
			).format(flt(debit_total, 2), flt(grand_total, 2))
		)

	je = frappe.new_doc("Journal Entry")
	je.voucher_type = "Cash Entry"
	je.posting_date = today()
	je.company = company
	je.user_remark = _("Canteen PCV replenishment: {0}").format(", ".join(pcv_names))
	for account, amount in account_totals.items():
		je.append(
			"accounts",
			{
				"account": account,
				"debit_in_account_currency": flt(amount, 2),
				"cost_center": cost_center,
			},
		)
	je.append(
		"accounts",
		{
			"account": company_doc.default_cash_account,
			"credit_in_account_currency": flt(grand_total, 2),
			"cost_center": cost_center,
		},
	)

	je.insert(ignore_permissions=frappe.has_permission("Journal Entry", "create"))
	je.submit()

	for name in pcv_names:
		frappe.db.set_value("SMS Canteen PCV", name, {"replenished": 1, "replenishment_reference": je.name})

	return {"journal_entry": je.name, "pcv_count": len(pcv_names), "total_amount": flt(grand_total, 2)}
