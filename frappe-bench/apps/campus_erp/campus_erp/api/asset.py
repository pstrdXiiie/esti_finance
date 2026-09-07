# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Asset & Property business rules (blueprint Phase 4). Per the same guiding
principle as registrar.py (blueprint §4.3): DocTypes own schema and
permissions only.

This module deliberately does almost no bookkeeping of its own — ERPNext's
real Asset Movement controller (asset_movement.py) already validates
purpose-specific rules (current custodian/location consistency) and, on
submit/cancel, recomputes and writes Asset.custodian/Asset.location from the
latest submitted movement automatically. These functions are thin,
purpose-shaped wrappers around that native document, not a parallel
implementation of what it already does.

Dispatch = Asset Movement purpose "Issue" (employee-only, no location
fields). Return = purpose "Receipt" (target_location required by ERPNext's
own validation; leaving to_employee blank clears the custodian). Transfer =
purpose "Transfer" (one native document, submittable, so the legacy's
"DELETE trans_details, no WHERE clause" data-loss bug is structurally
impossible — child rows are always fully replaced and versioned).
"""

import frappe
from frappe import _
from frappe.utils import flt


@frappe.whitelist()
def get_asset_filter_report(
	company: str | None = None,
	branch: str | None = None,
	department: str | None = None,
	status: str | None = None,
	asset_category: str | None = None,
	location: str | None = None,
) -> list[dict]:
	"""Replaces the legacy's qryReports/qryreports report-staging tables with
	explicit filter parameters on a whitelisted method."""
	filters = {"docstatus": ["!=", 2]}
	for field, value in (
		("company", company),
		("branch", branch),
		("department", department),
		("status", status),
		("asset_category", asset_category),
		("location", location),
	):
		if value:
			filters[field] = value

	return frappe.get_all(
		"Asset",
		filters=filters,
		fields=[
			"name", "asset_name", "item_code", "asset_category", "serial_number",
			"brand", "model", "location", "custodian", "department", "branch",
			"status", "purchase_date", "warranty_date", "gross_purchase_amount", "remarks",
		],
		order_by="asset_name asc",
	)


@frappe.whitelist()
def get_asset_dispatch_report(
	employee: str | None = None,
	branch: str | None = None,
	purpose: str | None = None,
	date_from: str | None = None,
	date_to: str | None = None,
) -> list[dict]:
	"""Replaces the legacy's qryFinance/qryfinance report-staging tables.
	Reads the real Asset Movement + Asset Movement Item ledger rather than a
	separate report table."""
	asm = frappe.qb.DocType("Asset Movement")
	item = frappe.qb.DocType("Asset Movement Item")

	query = (
		frappe.qb.from_(asm)
		.join(item)
		.on(item.parent == asm.name)
		.select(
			asm.name, asm.purpose, asm.transaction_date, asm.branch, asm.transfer_reason,
			asm.remarks, item.asset, item.asset_name, item.from_employee, item.to_employee,
			item.source_location, item.target_location, item.serial_number,
		)
		.where(asm.docstatus == 1)
	)
	if employee:
		query = query.where((item.to_employee == employee) | (item.from_employee == employee))
	if branch:
		query = query.where(asm.branch == branch)
	if purpose:
		query = query.where(asm.purpose == purpose)
	if date_from:
		query = query.where(asm.transaction_date >= date_from)
	if date_to:
		query = query.where(asm.transaction_date <= date_to)

	return query.orderby(asm.transaction_date, order=frappe.qb.desc).run(as_dict=True)


@frappe.whitelist()
def dispatch_asset(asset: str, to_employee: str, company: str, remarks: str | None = None) -> dict:
	"""Issues an asset to an employee (Asset Movement purpose=Issue). Throws
	if the asset already has a different custodian — the caller must return
	it first (or record it as a Transfer and Issue directly) rather than
	silently double-assigning custody."""
	current_custodian = frappe.db.get_value("Asset", asset, "custodian")
	if current_custodian and current_custodian != to_employee:
		frappe.throw(
			_("Asset {0} is already issued to {1}. Return it before issuing it to {2}.").format(
				asset, current_custodian, to_employee
			)
		)

	doc = frappe.get_doc(
		{
			"doctype": "Asset Movement",
			"purpose": "Issue",
			"company": company,
			"remarks": remarks,
			"assets": [{"asset": asset, "to_employee": to_employee}],
		}
	)
	doc.insert(ignore_permissions=frappe.has_permission("Asset Movement", "create"))
	doc.submit()
	return {"name": doc.name}


@frappe.whitelist()
def return_asset(asset: str, company: str, target_location: str, remarks: str | None = None) -> dict:
	"""Returns a dispatched asset to a location (Asset Movement
	purpose=Receipt). Leaving to_employee unset on the child row clears the
	asset's custodian once this document is submitted — ERPNext's own
	set_latest_location_and_custodian_in_asset() does that automatically."""
	doc = frappe.get_doc(
		{
			"doctype": "Asset Movement",
			"purpose": "Receipt",
			"company": company,
			"remarks": remarks,
			"assets": [{"asset": asset, "target_location": target_location}],
		}
	)
	doc.insert(ignore_permissions=frappe.has_permission("Asset Movement", "create"))
	doc.submit()
	return {"name": doc.name}


@frappe.whitelist()
def transfer_assets(
	assets: list[dict],
	company: str,
	branch: str | None = None,
	transfer_reason: str | None = None,
	requesting_officer: str | None = None,
	authorizing_officer: str | None = None,
	releasing_officer: str | None = None,
) -> dict:
	"""Moves one or more assets to new locations in a single submittable
	Asset Movement (purpose=Transfer). `assets` is a list of
	{"asset": ..., "target_location": ...} dicts — source_location is left
	for ERPNext's own validation to auto-fill from each asset's current
	location."""
	if not assets:
		frappe.throw(_("At least one asset is required for a transfer."))

	doc = frappe.get_doc(
		{
			"doctype": "Asset Movement",
			"purpose": "Transfer",
			"company": company,
			"branch": branch,
			"transfer_reason": transfer_reason,
			"requesting_officer": requesting_officer,
			"authorizing_officer": authorizing_officer,
			"releasing_officer": releasing_officer,
			"assets": [{"asset": row["asset"], "target_location": row["target_location"]} for row in assets],
		}
	)
	doc.insert(ignore_permissions=frappe.has_permission("Asset Movement", "create"))
	doc.submit()
	return {"name": doc.name}


@frappe.whitelist()
def issue_consumable(
	item_code: str,
	qty: float,
	employee: str,
	branch: str,
	company: str,
	warehouse: str,
) -> dict:
	"""Issues a consumable Item to an employee (Stock Entry, Stock Entry Type
	'Material Issue' — already a standard, pre-existing ERPNext type, no new
	setup data needed). Resolves uom/stock_uom/conversion_factor from the Item
	master server-side rather than asking the frontend to reproduce ERPNext's
	own item-detail resolution (normally a client-side JS concern in the
	Frappe desk) — the frontend only has to collect item_code/qty/employee.

	Sets allow_zero_valuation_rate on the line: the blueprint's own
	SMS Asset Consumable Dispatch never carried a cost/valuation field at
	all (quantity tracking only), so requiring every consumable Item to
	first have a purchase-established valuation rate before it can be
	issued would be a scope increase over the legacy behavior, not a
	faithful migration of it."""
	if flt(qty) <= 0:
		frappe.throw(_("Quantity must be greater than zero."))

	stock_uom = frappe.db.get_value("Item", item_code, "stock_uom")
	if not stock_uom:
		frappe.throw(_("Item {0} not found.").format(item_code))

	doc = frappe.get_doc(
		{
			"doctype": "Stock Entry",
			"stock_entry_type": "Material Issue",
			"company": company,
			"issued_to_employee": employee,
			"branch": branch,
			"items": [
				{
					"item_code": item_code,
					"qty": qty,
					"uom": stock_uom,
					"stock_uom": stock_uom,
					"conversion_factor": 1,
					"s_warehouse": warehouse,
					"allow_zero_valuation_rate": 1,
				}
			],
		}
	)
	doc.insert(ignore_permissions=frappe.has_permission("Stock Entry", "create"))
	doc.submit()
	return {"name": doc.name}


@frappe.whitelist()
def create_sticker_batch(assets: list[str], branch: str) -> dict:
	"""Auto-fetches item_description/date_acquired/warranty_date/department
	from each Asset so the caller only has to pick which assets to print,
	replacing the legacy's fixed 4-slot sticker columns."""
	if not assets:
		frappe.throw(_("At least one asset is required for a sticker batch."))

	rows = []
	for asset in assets:
		details = frappe.db.get_value(
			"Asset", asset, ["item_name", "purchase_date", "warranty_date", "department"], as_dict=True
		)
		if not details:
			frappe.throw(_("Asset {0} not found.").format(asset))
		rows.append(
			{
				"asset": asset,
				"item_description": details.item_name,
				"date_acquired": details.purchase_date,
				"warranty_date": details.warranty_date,
				"department": details.department,
			}
		)

	doc = frappe.get_doc(
		{
			"doctype": "SMS Asset Sticker Batch",
			"branch": branch,
			"items": rows,
		}
	)
	doc.insert(ignore_permissions=frappe.has_permission("SMS Asset Sticker Batch", "create"))
	return {"name": doc.name}
