# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Personnel module (blueprint Phase 3) custom fields, extending real installed
HRMS/ERPNext DocTypes rather than duplicating them — see
IMPLEMENTATION-MAPPING.md's Personnel section for the field-by-field
rationale.

Link-target translation (blueprint name -> real DocType this app extends):
  SMS Position -> Designation (erpnext)             SMS Employee -> Employee (erpnext)
  SMS Employee Schedule -> Shift Type/Shift Schedule/Shift Schedule Assignment (hrms)
  SMS Leave Type -> Leave Type (hrms)                SMS Payroll Run -> Payroll Entry (hrms)
  SMS Payslip -> Salary Slip (hrms)                  SMS Payroll Settings -> Payroll Settings (hrms)
  SMS Employee Seminar -> Training Event + Training Event Employee (hrms)
  SMS Code -> SMS Code (campus_erp, Administration, Phase 0)
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

CUSTOM_FIELDS = {
	"Employee": [
		{"fieldname": "sms_personnel_tab", "fieldtype": "Tab Break", "label": "Personnel (PH)", "insert_after": "iban"},
		{"fieldname": "birth_place", "label": "Birth Place", "fieldtype": "Data", "insert_after": "sms_personnel_tab"},
		{"fieldname": "nationality", "label": "Nationality", "fieldtype": "Link", "options": "SMS Code",
			"description": "Filtered to SMS Code.code_type = Nationality", "insert_after": "birth_place"},
		{"fieldname": "religion", "label": "Religion", "fieldtype": "Link", "options": "SMS Code",
			"description": "Filtered to SMS Code.code_type = Religion", "insert_after": "nationality"},
		{"fieldname": "column_break_sms_emp_1", "fieldtype": "Column Break", "insert_after": "religion"},
		{"fieldname": "dependents", "label": "No. of Dependents", "fieldtype": "Int", "insert_after": "column_break_sms_emp_1"},
		# NOTE: "branch" is already a standard core field on Employee (Link -> Branch) —
		# do not redeclare it as a custom field, it collides with the standard field of the same name.
		{"fieldname": "work_status", "label": "Work Status", "fieldtype": "Select",
			"options": "\nActive\nInactive\nExecutive\nConsultant",
			"description": "Open question per the migration blueprint (exact legacy meaning unconfirmed) — captured as a plain Select so it's usable now without blocking on business sign-off",
			"insert_after": "branch"},
		{"fieldname": "statutory_section", "fieldtype": "Section Break", "label": "Statutory Numbers & Deductions", "insert_after": "work_status"},
		{"fieldname": "tin_number", "label": "TIN", "fieldtype": "Data", "insert_after": "statutory_section"},
		{"fieldname": "sss_number", "label": "SSS Number", "fieldtype": "Data", "insert_after": "tin_number"},
		{"fieldname": "philhealth_number", "label": "PhilHealth Number", "fieldtype": "Data", "insert_after": "sss_number"},
		{"fieldname": "pagibig_number", "label": "Pag-IBIG Number", "fieldtype": "Data", "insert_after": "philhealth_number"},
		{"fieldname": "column_break_sms_emp_2", "fieldtype": "Column Break", "insert_after": "pagibig_number"},
		{"fieldname": "tax_deduction_enabled", "label": "Tax Deduction Enabled", "fieldtype": "Check", "default": "1", "insert_after": "column_break_sms_emp_2"},
		{"fieldname": "sss_deduction_enabled", "label": "SSS Deduction Enabled", "fieldtype": "Check", "default": "1", "insert_after": "tax_deduction_enabled"},
		{"fieldname": "philhealth_deduction_enabled", "label": "PhilHealth Deduction Enabled", "fieldtype": "Check", "default": "1", "insert_after": "sss_deduction_enabled"},
		{"fieldname": "pagibig_deduction_enabled", "label": "Pag-IBIG Deduction Enabled", "fieldtype": "Check", "default": "1", "insert_after": "philhealth_deduction_enabled"},
		{"fieldname": "load_section", "fieldtype": "Section Break", "label": "Teaching Load & Rate Basis", "insert_after": "pagibig_deduction_enabled"},
		{"fieldname": "min_load", "label": "Min Teaching Load", "fieldtype": "Float", "insert_after": "load_section"},
		{"fieldname": "max_load", "label": "Max Teaching Load", "fieldtype": "Float", "insert_after": "min_load"},
		{"fieldname": "column_break_sms_emp_3", "fieldtype": "Column Break", "insert_after": "max_load"},
		{"fieldname": "is_hourly_basis", "label": "Rate Basis Is Hourly", "fieldtype": "Check", "insert_after": "column_break_sms_emp_3"},
		{"fieldname": "statutory_rate", "label": "Statutory Rate", "fieldtype": "Currency", "insert_after": "is_hourly_basis"},
		{"fieldname": "contacts_section", "fieldtype": "Section Break", "label": "Emergency Contacts & Dependents", "collapsible": 1, "insert_after": "statutory_rate"},
		{"fieldname": "employee_contacts", "label": "Contacts", "fieldtype": "Table", "options": "SMS Employee Contact", "insert_after": "contacts_section"},
		{"fieldname": "infractions_section", "fieldtype": "Section Break", "label": "Infractions", "collapsible": 1, "insert_after": "employee_contacts"},
		{"fieldname": "employee_infractions", "label": "Infractions", "fieldtype": "Table", "options": "SMS Employee Infraction", "insert_after": "infractions_section"},
	],
	"Department": [
		{"fieldname": "head", "label": "Department Head", "fieldtype": "Link", "options": "Employee", "insert_after": "department_name"},
	],
	"Training Event Employee": [
		{"fieldname": "certificate", "label": "Certificate", "fieldtype": "Attach", "insert_after": "employee_name"},
	],
	"Shift Type": [
		{"fieldname": "sms_break_section", "fieldtype": "Section Break", "label": "Break (PH)", "insert_after": "auto_update_last_sync"},
		{"fieldname": "break_start_time", "label": "Break Start Time", "fieldtype": "Time", "insert_after": "sms_break_section"},
		{"fieldname": "column_break_sms_shift_1", "fieldtype": "Column Break", "insert_after": "break_start_time"},
		{"fieldname": "break_end_time", "label": "Break End Time", "fieldtype": "Time", "insert_after": "column_break_sms_shift_1"},
	],
	"Leave Application": [
		{"fieldname": "sms_leave_section", "fieldtype": "Section Break", "label": "Recommendation (PH)", "insert_after": "description"},
		{"fieldname": "other_leave_type", "label": "Other Leave Type", "fieldtype": "Data",
			"depends_on": "eval:doc.leave_type=='Others'", "insert_after": "sms_leave_section"},
		{"fieldname": "with_pay_days", "label": "With-Pay Days", "fieldtype": "Float", "read_only": 1, "insert_after": "other_leave_type"},
		{"fieldname": "without_pay_days", "label": "Without-Pay Days", "fieldtype": "Float", "read_only": 1, "insert_after": "with_pay_days"},
		{"fieldname": "column_break_sms_leave_1", "fieldtype": "Column Break", "insert_after": "without_pay_days"},
		{"fieldname": "recommended_by", "label": "Recommended By", "fieldtype": "Link", "options": "User", "read_only": 1, "insert_after": "column_break_sms_leave_1"},
		{"fieldname": "recommended_on", "label": "Recommended On", "fieldtype": "Datetime", "read_only": 1, "insert_after": "recommended_by"},
		{"fieldname": "rejection_reason", "label": "Rejection Reason", "fieldtype": "Small Text", "insert_after": "recommended_on"},
	],
	"Payroll Entry": [
		{"fieldname": "sms_cutoff_section", "fieldtype": "Section Break", "label": "Cutoff (PH)", "insert_after": "grade"},
		{"fieldname": "cutoff", "label": "Cutoff", "fieldtype": "Select", "options": "First Half\nSecond Half", "insert_after": "sms_cutoff_section"},
	],
	"Salary Slip": [
		{"fieldname": "sms_overtime_section", "fieldtype": "Section Break", "label": "Overtime (PH)", "insert_after": "salary_withholding_cycle"},
		{"fieldname": "overtime_hours", "label": "OT Hours Rendered", "fieldtype": "Float", "insert_after": "sms_overtime_section"},
	],
	"Payroll Settings": [
		{"fieldname": "sms_school_year_section", "fieldtype": "Section Break", "label": "School Year (PH)", "insert_after": "email_template"},
		{"fieldname": "current_school_year", "label": "Current School Year", "fieldtype": "Data", "insert_after": "sms_school_year_section"},
	],
}


def sync_personnel_custom_fields():
	"""Idempotent — safe to call from after_migrate every time (blueprint Phase 3)."""
	create_custom_fields(CUSTOM_FIELDS, update=True)
	frappe.clear_cache()
