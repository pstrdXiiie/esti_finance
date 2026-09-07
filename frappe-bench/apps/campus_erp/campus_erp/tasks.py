# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""Scheduled jobs (blueprint Phase 5, Administration's own housekeeping —
jobs proposed for other modules in the blueprint are out of this phase's
scope and are left as a follow-up)."""

import frappe

from campus_erp.api.administration import check_backup_recency


def daily():
	result = check_backup_recency()
	if result["is_stale"]:
		frappe.log_error(
			title="Backup is stale",
			message=f"Most recent backup: {result['most_recent_backup']} (age_hours={result['age_hours']}).",
		)
