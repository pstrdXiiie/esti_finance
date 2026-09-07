# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Seeds SMS Library Settings (a Single doctype) with the default values its
own field JSON already declares (fine_per_day=5, default_loan_period_days=7,
block_borrowing_if_overdue=1).

Single-doctype `default`s are a Desk new-form prefill only -- Frappe never
writes them into the Singles table on its own, since a Single has no
"insert" moment to apply them at. Left alone, a fresh install/migrate keeps
these fields genuinely NULL until a human opens the settings page and saves
once, which would break approve_borrow_request's add_days() call (adding
None days to a date) the first time anyone approves a request. Runs
idempotently after every migrate, same as the custom_fields_*.py syncs.
"""

import frappe

DEFAULTS = {
	"fine_per_day": 5,
	"default_loan_period_days": 7,
	"block_borrowing_if_overdue": 1,
}


def sync_library_settings_defaults():
	# Checking doc.get(field) is None doesn't work here: Check-type fields
	# (block_borrowing_if_overdue) always coerce to int 0 in memory even when
	# no row for them exists in the Singles table at all, indistinguishable
	# from "explicitly set to 0". Query the Singles table directly instead.
	doc = frappe.get_single("SMS Library Settings")
	changed = False
	for field, value in DEFAULTS.items():
		if not frappe.db.exists("Singles", {"doctype": "SMS Library Settings", "field": field}):
			doc.set(field, value)
			changed = True
	if changed:
		doc.save(ignore_permissions=True)
