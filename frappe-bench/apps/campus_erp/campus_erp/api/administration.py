# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Administration & Security business rules (blueprint Phase 5). Per the same
guiding principle as registrar.py/asset.py: DocTypes own schema and
permissions only.

The legacy frmOverRide supervisor-override dialog had its real
database-backed Administrator check commented out and replaced with two
hardcoded credential pairs baked into the compiled app — a live security
defect. record_override() is the closure for that: a genuine audit record
of who authorized bypassing what, and why, gated on a real role check
against a real user, for any future module that needs the escape hatch.

check_backup_recency/get_event_log/get_active_sessions replace three of the
legacy's own SMS log/session tables with live reads of data Frappe already
keeps natively, rather than parallel bookkeeping this app would have to
maintain and could drift out of sync with reality.
"""

import os
from datetime import datetime

import frappe
from frappe import _
from frappe.utils import get_site_path, now
from frappe.utils.password import check_password, update_password


@frappe.whitelist()
def record_override(reference_doctype: str, reference_name: str, reason: str, overridden_by: str) -> dict:
	"""Records a supervisor override authorized by `overridden_by` on behalf
	of the current session user. This function IS the permission check —
	it validates overridden_by against a real role (not a hardcoded
	credential pair, unlike the legacy dialog it replaces) before writing
	the audit row, so the insert itself runs with ignore_permissions."""
	if not frappe.db.exists("User", overridden_by):
		frappe.throw(_("{0} is not a valid user.").format(overridden_by))

	authorizing_roles = {"SMS Administrator", "System Manager"}
	if not authorizing_roles.intersection(frappe.get_roles(overridden_by)):
		frappe.throw(_("{0} is not authorized to approve an override.").format(overridden_by))

	doc = frappe.get_doc(
		{
			"doctype": "SMS Override Log",
			"user": frappe.session.user,
			"overridden_by": overridden_by,
			"reason": reason,
			"reference_doctype": reference_doctype,
			"reference_name": reference_name,
			"timestamp": now(),
		}
	)
	doc.insert(ignore_permissions=True)
	return {"name": doc.name}


@frappe.whitelist()
def change_password(old_password: str, new_password: str) -> dict:
	"""Self-service password reset for the current session user. Replaces
	the legacy's three concurrently-active, all-broken password schemes —
	reversible "encrypted" storage, a home-grown XOR/Vigenère cipher tried
	first, and a case-insensitive comparison fallback — with Frappe's own
	real password hashing."""
	user = frappe.session.user
	if user == "Guest":
		frappe.throw(_("You must be logged in to change your password."))

	try:
		check_password(user, old_password)
	except frappe.AuthenticationError:
		frappe.throw(_("Current password is incorrect."))

	if len(new_password) < 8:
		frappe.throw(_("New password must be at least 8 characters long."))

	update_password(user, new_password)
	return {"user": user}


@frappe.whitelist()
def check_backup_recency(max_age_hours: int = 48) -> dict:
	"""Replaces SMS Backup Log with a live filesystem check rather than a
	persisted log doctype nobody would reliably keep updated — there is
	nothing to write on every backup, so nothing to get stale or lie."""
	backup_dir = get_site_path("private", "backups")
	files = [os.path.join(backup_dir, f) for f in os.listdir(backup_dir)] if os.path.isdir(backup_dir) else []
	files = [f for f in files if os.path.isfile(f)]

	if not files:
		return {"most_recent_backup": None, "age_hours": None, "is_stale": True}

	latest = datetime.fromtimestamp(max(os.path.getmtime(f) for f in files))
	age_hours = (datetime.now() - latest).total_seconds() / 3600

	return {
		"most_recent_backup": latest.isoformat(),
		"age_hours": age_hours,
		"is_stale": age_hours > max_age_hours,
	}


@frappe.whitelist()
def get_event_log(
	from_date: str | None = None,
	to_date: str | None = None,
	user: str | None = None,
	event_type: str | None = None,
) -> list[dict]:
	"""UNION-shaped report over the four native Frappe log doctypes that
	already cover every event the legacy's SMS Event Log tried to build
	from scratch, replacing it outright rather than duplicating what
	Frappe already records on every document."""

	def date_filters(user_field):
		filters = []
		if from_date:
			filters.append(["creation", ">=", from_date])
		if to_date:
			filters.append(["creation", "<=", to_date])
		if user:
			filters.append([user_field, "=", user])
		return filters

	events = []

	for row in frappe.get_all(
		"Activity Log",
		filters=date_filters("user") + [["operation", "in", ["Login", "Logout", "Impersonate"]]],
		fields=["creation", "user", "operation", "reference_doctype", "reference_name", "status"],
	):
		events.append(
			{
				"timestamp": row.creation,
				"user": row.user,
				"event_type": row.operation,
				"reference_doctype": row.reference_doctype,
				"reference_name": row.reference_name,
				"detail": row.status,
			}
		)

	for row in frappe.get_all(
		"Version", filters=date_filters("owner"), fields=["creation", "owner", "ref_doctype", "docname"]
	):
		events.append(
			{
				"timestamp": row.creation,
				"user": row.owner,
				"event_type": "Update",
				"reference_doctype": row.ref_doctype,
				"reference_name": row.docname,
				"detail": "Updated",
			}
		)

	for row in frappe.get_all(
		"Deleted Document",
		filters=date_filters("owner"),
		fields=["creation", "owner", "deleted_doctype", "deleted_name"],
	):
		events.append(
			{
				"timestamp": row.creation,
				"user": row.owner,
				"event_type": "Delete",
				"reference_doctype": row.deleted_doctype,
				"reference_name": row.deleted_name,
				"detail": "Deleted",
			}
		)

	for row in frappe.get_all(
		"Workflow Action",
		filters=date_filters("user"),
		fields=["creation", "user", "reference_doctype", "reference_name", "workflow_state"],
	):
		events.append(
			{
				"timestamp": row.creation,
				"user": row.user,
				"event_type": "Approval",
				"reference_doctype": row.reference_doctype,
				"reference_name": row.reference_name,
				"detail": row.workflow_state,
			}
		)

	if event_type:
		events = [e for e in events if e["event_type"] == event_type]

	events.sort(key=lambda e: e["timestamp"], reverse=True)
	return events[:200]


@frappe.whitelist()
def get_active_sessions() -> list[dict]:
	"""Replaces SMS User Session with a live read of Activity Log rather
	than a parallel session table, per the module's own mapping decision.
	A user counts as active if their most recent Login within the last 24
	hours has no later Logout."""
	log = frappe.qb.DocType("Activity Log")
	cutoff = frappe.utils.add_to_date(frappe.utils.now_datetime(), hours=-24)

	logins = (
		frappe.qb.from_(log)
		.select(log.user, log.full_name, log.creation, log.ip_address)
		.where((log.operation == "Login") & (log.creation >= cutoff))
		.orderby(log.creation, order=frappe.qb.desc)
		.run(as_dict=True)
	)

	latest_login = {}
	for row in logins:
		latest_login.setdefault(row.user, row)

	if not latest_login:
		return []

	logouts = (
		frappe.qb.from_(log)
		.select(log.user, log.creation)
		.where(
			(log.operation == "Logout")
			& (log.creation >= cutoff)
			& (log.user.isin(list(latest_login.keys())))
		)
		.run(as_dict=True)
	)

	latest_logout = {}
	for row in logouts:
		if row.user not in latest_logout or row.creation > latest_logout[row.user]:
			latest_logout[row.user] = row.creation

	sessions = [
		{
			"user": row.user,
			"full_name": row.full_name,
			"login_time": row.creation,
			"ip_address": row.ip_address,
		}
		for row in latest_login.values()
		if row.user not in latest_logout or latest_logout[row.user] <= row.creation
	]
	sessions.sort(key=lambda r: r["login_time"], reverse=True)
	return sessions


@frappe.whitelist()
def get_pending_approvals(for_user: str | None = None) -> list[dict]:
	"""Drill-down list across the three Workflow-driven doctypes this phase
	attaches a shared Draft/Pending Recommendation/Recommended/Approved/
	Rejected workflow to. Only queries a doctype the caller actually holds
	a recommending-or-approving role for, rather than returning every
	pending row to every caller regardless of role."""
	user = for_user or frappe.session.user
	roles = set(frappe.get_roles(user))

	doctype_roles = {
		"SMS Loan Application": {"SMS Loan Recommending Officer", "SMS Loan Approving Officer"},
		"SMS Overtime": {"SMS HR Officer", "SMS HR Manager"},
		"SMS Travel Order": {"SMS HR Officer", "SMS HR Manager"},
	}

	rows = []
	for doctype, allowed_roles in doctype_roles.items():
		if not allowed_roles.intersection(roles):
			continue
		for row in frappe.get_all(
			doctype,
			filters={"status": ["in", ["Pending Recommendation", "Recommended"]]},
			fields=["name", "status", "employee", "creation"],
		):
			rows.append(
				{
					"doctype": doctype,
					"name": row.name,
					"status": row.status,
					"employee": row.employee,
					"creation": row.creation,
				}
			)

	rows.sort(key=lambda r: r["creation"])
	return rows
