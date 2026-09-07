# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Seeds SMS Credential (a standalone doctype, autoname field:description) with
the standard admission-requirements checklist every student is expected to
submit: Certificate of Good Moral Character, Form 137, Form 138, Honorable
Dismissal, NCAE, and Transcript of Records.

Each row is created with is_initial=1 so it shows up pre-checked-as-relevant
on a fresh student's SMS Student Credential checklist (Student.credentials),
per is_initial's own stated purpose ("Is Initial (Default-Checked)").

There is no other seeding path for these -- unlike a Single doctype's field
`default`s, a plain doctype's rows simply don't exist until something inserts
them, so without this a fresh install/migrate leaves SMS Credential empty and
registrars would have to create all six by hand before the checklist is
usable. Runs idempotently after every migrate, same as library_defaults.py:
only ever inserts a missing row, never updates/resets one that already
exists, so a registrar's later edits to these records survive future
migrates.
"""

import frappe

DEFAULT_CREDENTIALS = [
	"Certificate of Good Moral Character",
	"Form 137",
	"Form 138",
	"Honorable Dismissal",
	"NCAE",
	"Transcript of Records",
]


def sync_credential_defaults():
	for description in DEFAULT_CREDENTIALS:
		if not frappe.db.exists("SMS Credential", {"description": description}):
			frappe.get_doc(
				{
					"doctype": "SMS Credential",
					"description": description,
					"is_initial": 1,
				}
			).insert(ignore_permissions=True)
