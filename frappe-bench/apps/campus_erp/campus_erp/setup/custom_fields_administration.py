# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Administration module (blueprint Phase 5) custom fields. The legacy SMS
Settings table's TIN field is already covered natively by Company.tax_id, so
the only genuinely unaddressed institution-level field is the employer SSS
number (distinct from Employee.sss_number, added in the Personnel phase,
which holds each individual employee's own SSS number).
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

CUSTOM_FIELDS = {
	"Company": [
		{"fieldname": "sms_admin_section", "fieldtype": "Section Break", "label": "PH Administration", "insert_after": "company_logo"},
		{"fieldname": "sss_number", "label": "SSS Number", "fieldtype": "Data", "insert_after": "sms_admin_section"},
	],
}


def sync_administration_custom_fields():
	"""Idempotent — safe to call from after_migrate every time (blueprint Phase 5)."""
	create_custom_fields(CUSTOM_FIELDS, update=True)
	frappe.clear_cache()
