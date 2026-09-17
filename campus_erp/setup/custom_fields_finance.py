# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Finance module (blueprint Phase 2: Billing + Purchasing) custom fields,
extending real installed DocTypes rather than duplicating them — see
IMPLEMENTATION-MAPPING.md's two Finance sections for the field-by-field
rationale.

Link-target translation (blueprint name -> real DocType this app extends):
  SMS Fee Code -> Fee Category (education)         SMS Chart of Account -> Account (erpnext)
  SMS GL Voucher -> Journal Entry (erpnext)         SMS Finance Settings -> Education Settings (billing half) /
                                                                             Buying Settings (purchasing half)
  SMS Purchase Requisition -> Material Request      SMS Purchase Order -> Purchase Order (erpnext)
  SMS Supplier -> Supplier (erpnext)                SMS Item -> Item (erpnext)
  SMS Item Supplier/Price History -> Item Price     SMS Code -> SMS Code (campus_erp, Administration, Phase 0)
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

CUSTOM_FIELDS = {
	"Fee Category": [
		{"fieldname": "code_type", "label": "Code Type", "fieldtype": "Select",
			"options": "Header\nDetail", "default": "Detail", "insert_after": "item_defaults"},
		{"fieldname": "header", "label": "Header Group", "fieldtype": "Link", "options": "Fee Category",
			"description": "Only for Detail rows", "depends_on": "eval:doc.code_type=='Detail'", "insert_after": "code_type"},
		{"fieldname": "priority", "label": "Payment Allocation Priority", "fieldtype": "Int",
			"description": "Drives Priority-mode payment allocation; absorbs the legacy Fee Priority Setting table",
			"insert_after": "header"},
		{"fieldname": "is_disabled", "label": "Disabled", "fieldtype": "Check", "insert_after": "priority"},
	],
	"Education Settings": [
		{"fieldname": "sms_finance_tab", "fieldtype": "Tab Break", "label": "Finance Billing (PH)", "insert_after": "cor_layout"},
		{"fieldname": "billing_due_date", "label": "Billing Due Date", "fieldtype": "Date", "insert_after": "sms_finance_tab"},
		{"fieldname": "surcharge_percent", "label": "Installment Surcharge %", "fieldtype": "Percent", "insert_after": "billing_due_date"},
		{"fieldname": "column_break_sms_fin_1", "fieldtype": "Column Break", "insert_after": "surcharge_percent"},
		{"fieldname": "enable_wallet", "label": "Enable Student Wallet (e-cash)", "fieldtype": "Check", "default": "0",
			"description": "Gate for the SMS Wallet Account/Transaction screens — open product question per the migration blueprint; defaults off until Finance confirms the e-cash feature is still in active use",
			"insert_after": "column_break_sms_fin_1"},
	],
	"Material Request": [
		{"fieldname": "sms_purchasing_tab", "fieldtype": "Tab Break", "label": "Purchasing (PH)", "insert_after": "last_scanned_warehouse"},
		{"fieldname": "requested_by", "label": "Requested By", "fieldtype": "Link", "options": "Employee", "insert_after": "sms_purchasing_tab"},
		{"fieldname": "pr_purpose", "label": "Purpose", "fieldtype": "Small Text", "insert_after": "requested_by"},
		{"fieldname": "justification", "label": "Justification", "fieldtype": "Small Text",
			"description": "Why this requisition is needed -- distinct from Purpose (what it's for)",
			"insert_after": "pr_purpose"},
		{"fieldname": "column_break_sms_mr_1", "fieldtype": "Column Break", "insert_after": "justification"},
		{"fieldname": "branch", "label": "Branch", "fieldtype": "Link", "options": "Branch", "insert_after": "column_break_sms_mr_1"},
		{"fieldname": "total_amount", "label": "Total Amount", "fieldtype": "Currency", "read_only": 1,
			"description": "Computed, read-only — Material Request has no header total by default", "insert_after": "branch"},
		{"fieldname": "column_break_sms_mr_2", "fieldtype": "Column Break", "insert_after": "total_amount"},
		{"fieldname": "approval_status", "label": "Approval Status", "fieldtype": "Select",
			"options": "Pending\nApproved\nRejected\nRevision Requested", "default": "Pending",
			"description": "Drives the Purchase Requisition Approval screen; Approved submits the document, Rejected/Revision Requested both leave it as Draft (Revision Requested signals the requester should edit and resubmit, Rejected does not)",
			"insert_after": "column_break_sms_mr_2"},
		{"fieldname": "recommending_approval", "label": "Recommending Approval", "fieldtype": "Link", "options": "Employee",
			"insert_after": "approval_status"},
		{"fieldname": "approved_by", "label": "Approved By", "fieldtype": "Link", "options": "User", "read_only": 1,
			"description": "Set to frappe.session.user — Link to User (not Employee), same convention as SMS Graduation Candidate.approved_by",
			"insert_after": "recommending_approval"},
		{"fieldname": "approval_date", "label": "Approval Date", "fieldtype": "Date", "read_only": 1,
			"insert_after": "approved_by"},
		{"fieldname": "approval_remarks", "label": "Approval Remarks", "fieldtype": "Small Text", "insert_after": "approval_date"},
	],
	"Material Request Item": [
		{"fieldname": "supplier", "label": "Supplier", "fieldtype": "Link", "options": "Supplier",
			"description": "Needed to later group requisition lines into one Purchase Order per distinct supplier",
			"insert_after": "price_list_rate"},
	],
	"Purchase Order": [
		{"fieldname": "sms_purchasing_section", "fieldtype": "Section Break", "label": "Purchasing (PH)", "insert_after": "last_scanned_warehouse"},
		{"fieldname": "branch", "label": "Branch", "fieldtype": "Link", "options": "Branch", "insert_after": "sms_purchasing_section"},
		{"fieldname": "settlement_reference", "label": "Settlement Voucher", "fieldtype": "Link", "options": "Journal Entry",
			"read_only": 1, "insert_after": "branch"},
		{"fieldname": "column_break_sms_po_1", "fieldtype": "Column Break", "insert_after": "settlement_reference"},
		{"fieldname": "payables_settled", "label": "Payables Settled", "fieldtype": "Check", "insert_after": "column_break_sms_po_1"},
	],
	"Supplier": [
		{"fieldname": "sms_supplier_section", "fieldtype": "Section Break", "label": "Legacy / Purchasing (PH)", "insert_after": "column_break_mglr"},
		{"fieldname": "legacy_supplier_code", "label": "Supplier Code", "fieldtype": "Data", "read_only": 0,
			"description": "The Suppliers Masterfile screen's editable code field — was import-only/read-only before that screen existed",
			"insert_after": "sms_supplier_section"},
		{"fieldname": "branch", "label": "Branch", "fieldtype": "Link", "options": "Branch", "insert_after": "legacy_supplier_code"},
		{"fieldname": "column_break_sms_sup_1", "fieldtype": "Column Break", "insert_after": "branch"},
		{"fieldname": "tax_percent", "label": "Tax %", "fieldtype": "Float", "insert_after": "column_break_sms_sup_1"},
		{"fieldname": "sms_supplier_masterfile_section", "fieldtype": "Section Break", "label": "Supplier Masterfile (PH)", "insert_after": "tax_percent"},
		{"fieldname": "supplier_address", "label": "Supplier Address", "fieldtype": "Small Text", "insert_after": "sms_supplier_masterfile_section"},
		{"fieldname": "contact_person", "label": "Contact Person", "fieldtype": "Data", "insert_after": "supplier_address"},
		{"fieldname": "telephone", "label": "Telephone", "fieldtype": "Data", "insert_after": "contact_person"},
		{"fieldname": "column_break_sms_sup_2", "fieldtype": "Column Break", "insert_after": "telephone"},
		{"fieldname": "fax", "label": "Fax", "fieldtype": "Data", "insert_after": "column_break_sms_sup_2"},
		{"fieldname": "supplier_email", "label": "E-mail", "fieldtype": "Data",
			"description": "Plain editable field for the Suppliers Masterfile screen — native email_id is Read Only, fetched from a linked Contact instead",
			"insert_after": "fax"},
		{"fieldname": "payment_terms_days", "label": "Payment Terms (Days)", "fieldtype": "Int", "insert_after": "supplier_email"},
	],
	"Item": [
		{"fieldname": "sms_item_section", "fieldtype": "Section Break", "label": "Purchasing (PH)", "insert_after": "deferred_accounting_section"},
		{"fieldname": "default_cost", "label": "Default Cost", "fieldtype": "Currency", "insert_after": "sms_item_section"},
		{"fieldname": "column_break_sms_item_1", "fieldtype": "Column Break", "insert_after": "default_cost"},
		{"fieldname": "max_order_qty", "label": "Max Order Qty", "fieldtype": "Float", "insert_after": "column_break_sms_item_1"},
		{"fieldname": "sms_item_masterfile_section", "fieldtype": "Section Break", "label": "Items Masterfile (PH)", "insert_after": "max_order_qty"},
		{"fieldname": "item_quantity", "label": "Item Quantity", "fieldtype": "Float",
			"description": "Simple manually-tracked quantity on hand for the Items Masterfile screen — not linked to the real Stock Ledger/Bin",
			"insert_after": "sms_item_masterfile_section"},
		{"fieldname": "reorder_quantity", "label": "Reorder Quantity", "fieldtype": "Float", "insert_after": "item_quantity"},
		{"fieldname": "column_break_sms_item_2", "fieldtype": "Column Break", "insert_after": "reorder_quantity"},
		{"fieldname": "default_supplier", "label": "Supplier", "fieldtype": "Link", "options": "Supplier", "insert_after": "column_break_sms_item_2"},
	],
	"Account": [
		{"fieldname": "legacy_header", "label": "Header", "fieldtype": "Data",
			"description": "Legacy Chart of Accounts grouping label (e.g. Cash in Bank, Contra Asset, Current) — distinct from ERPNext's account_type, which uses a different fixed taxonomy",
			"insert_after": "account_type"},
	],
	"Item Price": [
		{"fieldname": "branch", "label": "Branch", "fieldtype": "Link", "options": "Branch",
			"description": "Only if per-branch cost ceilings genuinely differ from one Price List per branch", "insert_after": "batch_no"},
	],
	"Buying Settings": [
		{"fieldname": "sms_buying_section", "fieldtype": "Section Break", "label": "Legacy Settings (PH)", "insert_after": "validate_consumed_qty"},
		{"fieldname": "max_pr_amount", "label": "Max PR Amount (no admin sign-off)", "fieldtype": "Currency", "insert_after": "sms_buying_section"},
		{"fieldname": "column_break_sms_buy_1", "fieldtype": "Column Break", "insert_after": "max_pr_amount"},
		{"fieldname": "price_history_active_year", "label": "Price History Active Year", "fieldtype": "Int", "insert_after": "column_break_sms_buy_1"},
	],
}


def sync_finance_property_setters():
	"""Extends Journal Entry Account's reference_type Select so a replenishment
	Journal Entry line can carry a polymorphic back-reference to the Canteen
	PCV batch it settles — mirrors Phase 1's Student Log 'type' extension."""
	frappe.make_property_setter(
		{
			"doctype": "Journal Entry Account",
			"fieldname": "reference_type",
			"property": "options",
			"value": (
				"Sales Invoice\nPurchase Invoice\nJournal Entry\nSales Order\nPurchase Order\n"
				"Expense Claim\nAsset\nLoan\nPayroll Entry\nEmployee Advance\n"
				"Exchange Rate Revaluation\nInvoice Discounting\nFees\nFull and Final Statement\n"
				"Payment Entry\nBank Transaction\nSMS Canteen PCV"
			),
			"property_type": "Text",
		},
		validate_fields_for_doctype=False,
	)


def sync_finance_custom_fields():
	"""Idempotent — safe to call from after_migrate every time (blueprint Phase 2)."""
	create_custom_fields(CUSTOM_FIELDS, update=True)
	sync_finance_property_setters()
	frappe.clear_cache()
