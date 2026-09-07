# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Administration module (blueprint Phase 5) workflows.

SMS Loan Application, SMS Overtime and SMS Travel Order were each built with
a "status" Select field anticipating a maker-checker approval chain
(Draft -> Pending Recommendation -> Recommended -> Approved/Rejected) — a
later step configures the actual Workflow/Workflow Transition records. This
IS that later step.

docstatus submission stays a fully separate, already-built action independent
of these workflow states: only the "Approved" state ties to doc_status "1",
exactly mirroring the proven Leave Application precedent (workflow "SMS Leave
Application Approval") already live on this bench.
"""

import frappe

WORKFLOWS = [
	("SMS Loan Application Approval", "SMS Loan Application", "SMS Loan Recommending Officer", "SMS Loan Approving Officer"),
	("SMS Overtime Approval", "SMS Overtime", "SMS HR Officer", "SMS HR Manager"),
	("SMS Travel Order Approval", "SMS Travel Order", "SMS HR Officer", "SMS HR Manager"),
]


def _grant_role_permission(doctype, role, **ptypes):
	if frappe.db.exists("Custom DocPerm", {"parent": doctype, "role": role, "permlevel": 0}):
		return
	frappe.get_doc({
		"doctype": "Custom DocPerm", "parent": doctype, "parenttype": "DocType",
		"parentfield": "permissions", "role": role, "permlevel": 0, **ptypes,
	}).insert(ignore_permissions=True)


def sync_administration_workflows():
	"""Idempotent — safe to call from after_migrate every time (blueprint Phase 5)."""
	if not frappe.db.exists("Workflow State", "Draft"):
		frappe.get_doc({"doctype": "Workflow State", "workflow_state_name": "Draft"}).insert(ignore_permissions=True)

	# The pre-existing "SMS Leave Application Approval" workflow (built before
	# this phase) was never actually exercised end-to-end -- verifying it here
	# surfaced a real gap: Leave Application.on_submit() creates Leave Ledger
	# Entry/Attendance rows as a side effect, which "SMS Leave Approving
	# Officer" was never granted permission for, so the workflow's own
	# Recommended->Approved transition (which submits the document) throws
	# PermissionError for the one role the workflow itself designates as the
	# approver. HR Manager/HR User already hold read+write+create on both;
	# grant the approving officer the same standing permission.
	for doctype in ("Leave Ledger Entry", "Attendance"):
		_grant_role_permission(doctype, "SMS Leave Approving Officer", read=1, write=1, create=1)

	for workflow_name, document_type, recommend_role, approve_role in WORKFLOWS:
		if frappe.db.exists("Workflow", workflow_name):
			continue

		frappe.get_doc({
			"doctype": "Workflow",
			"workflow_name": workflow_name,
			"document_type": document_type,
			"is_active": 1,
			"send_email_alert": 1,
			"workflow_state_field": "status",
			"states": [
				{"state": "Draft", "doc_status": "0", "allow_edit": "SMS Employee", "send_email": 1},
				{"state": "Pending Recommendation", "doc_status": "0", "allow_edit": recommend_role, "send_email": 1},
				{"state": "Recommended", "doc_status": "0", "allow_edit": approve_role, "send_email": 1},
				{"state": "Approved", "doc_status": "1", "allow_edit": approve_role, "send_email": 1},
				{"state": "Rejected", "doc_status": "0", "allow_edit": recommend_role, "send_email": 1},
			],
			"transitions": [
				{"state": "Draft", "action": "Submit for Recommendation", "next_state": "Pending Recommendation", "allowed": "SMS Employee", "allow_self_approval": 1},
				{"state": "Pending Recommendation", "action": "Recommend", "next_state": "Recommended", "allowed": recommend_role, "allow_self_approval": 1},
				{"state": "Pending Recommendation", "action": "Reject", "next_state": "Rejected", "allowed": recommend_role, "allow_self_approval": 1},
				{"state": "Recommended", "action": "Approve", "next_state": "Approved", "allowed": approve_role, "allow_self_approval": 1},
				{"state": "Recommended", "action": "Reject", "next_state": "Rejected", "allowed": approve_role, "allow_self_approval": 1},
			],
		}).insert(ignore_permissions=True)
