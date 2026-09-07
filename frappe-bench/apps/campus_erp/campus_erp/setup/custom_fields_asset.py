# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Asset & Property module (blueprint Phase 4) custom fields, extending real
installed ERPNext DocTypes rather than duplicating them — see
IMPLEMENTATION-MAPPING.md's Asset & Property section for the field-by-field
rationale.

Link-target translation (blueprint name -> real DocType this app extends):
  SMS Asset -> Asset (erpnext)                    SMS Asset Brand -> Brand (erpnext)
  SMS Asset Dispatch -> Asset Movement (erpnext, purpose=Issue/Receipt)
  SMS Equipment Transfer -> Asset Movement (erpnext, purpose=Transfer/Transfer and Issue)
  SMS Asset Consumable Dispatch -> Stock Entry (erpnext, purpose=Material Issue)
  SMS Asset Serial Counter -> native Frappe naming series (no doctype)
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

CUSTOM_FIELDS = {
	"Asset": [
		{"fieldname": "sms_asset_section", "fieldtype": "Section Break", "label": "Registrar/Property (PH)", "insert_after": "purchase_invoice_item"},
		{"fieldname": "serial_number", "label": "Serial Number", "fieldtype": "Data", "unique": 1, "insert_after": "sms_asset_section"},
		{"fieldname": "brand", "label": "Brand", "fieldtype": "Link", "options": "Brand", "insert_after": "serial_number"},
		{"fieldname": "model", "label": "Model", "fieldtype": "Link", "options": "SMS Asset Model", "insert_after": "brand"},
		{"fieldname": "column_break_sms_asset_1", "fieldtype": "Column Break", "insert_after": "model"},
		{"fieldname": "warranty_date", "label": "Warranty Expiry", "fieldtype": "Date",
			"description": "Skipped for library book items per the migration blueprint", "insert_after": "column_break_sms_asset_1"},
		{"fieldname": "branch", "label": "Branch", "fieldtype": "Link", "options": "Branch", "insert_after": "warranty_date"},
		{"fieldname": "remarks", "label": "Remarks", "fieldtype": "Small Text", "insert_after": "branch"},
	],
	"Asset Movement": [
		{"fieldname": "sms_movement_section", "fieldtype": "Section Break", "label": "Officers & Notes (PH)", "insert_after": "column_break_9"},
		{"fieldname": "branch", "label": "Branch", "fieldtype": "Link", "options": "Branch", "insert_after": "sms_movement_section"},
		{"fieldname": "transfer_reason", "label": "Transfer Reason", "fieldtype": "Small Text",
			"description": "'purpose' is already the native Select (Issue/Receipt/Transfer/Transfer and Issue) — this captures the free-text reason", "insert_after": "branch"},
		{"fieldname": "remarks", "label": "Remarks", "fieldtype": "Small Text", "insert_after": "transfer_reason"},
		{"fieldname": "column_break_sms_move_1", "fieldtype": "Column Break", "insert_after": "remarks"},
		{"fieldname": "requesting_officer", "label": "Requesting Officer", "fieldtype": "Link", "options": "Employee", "insert_after": "column_break_sms_move_1"},
		{"fieldname": "authorizing_officer", "label": "Authorizing Officer", "fieldtype": "Link", "options": "Employee", "insert_after": "requesting_officer"},
		{"fieldname": "releasing_officer", "label": "Releasing Officer", "fieldtype": "Link", "options": "Employee", "insert_after": "authorizing_officer"},
	],
	"Asset Movement Item": [
		{"fieldname": "serial_number", "label": "Serial Number", "fieldtype": "Data", "read_only": 1,
			"description": "Fetched from Asset.serial_number for convenience on the printed slip", "insert_after": "company"},
	],
	"Stock Entry": [
		{"fieldname": "sms_stock_section", "fieldtype": "Section Break", "label": "Employee Consumable Issue (PH)", "insert_after": "cost_center"},
		{"fieldname": "issued_to_employee", "label": "Issued To Employee", "fieldtype": "Link", "options": "Employee",
			"description": "Stock Entry has no native concept of 'who received this', only warehouse-to-warehouse movement", "insert_after": "sms_stock_section"},
		{"fieldname": "branch", "label": "Branch", "fieldtype": "Link", "options": "Branch", "insert_after": "issued_to_employee"},
	],
}


def sync_asset_custom_fields():
	"""Idempotent — safe to call from after_migrate every time (blueprint Phase 4)."""
	create_custom_fields(CUSTOM_FIELDS, update=True)
	frappe.clear_cache()
