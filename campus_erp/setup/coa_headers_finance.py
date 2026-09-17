# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Finance module Chart of Accounts sub-group headers. Companion to
custom_fields_finance.py / print_formats_finance.py: idempotent, safe to
call every after_migrate.

The legacy VB "New Account" screen's Account Header dropdown is filtered by
the selected Account Type, and shows that type's immediate is_group
children if any exist, falling back to the type's root account itself if
it has none yet (confirmed against reference screenshots: Asset shows
4 children, Liability shows 2 children, Income/Expense — which have no
children — each fall back to showing their own root, "Revenues"/
"Expenses"). Equity has no root or children in the reference at all, so
none is seeded here.

Two of these ("Current", "Non Current") need to exist once under Assets
and once under Liabilities. Account's own autoname
(<account_name> - <company abbr>) would collide on the exact same ID for
both, so the Liabilities-side pair gets an explicit disambiguated `name`
via insert()'s set_name= (autoname() ignores a pre-set doc.name, so that
alone isn't enough) while `account_name` stays identical for display —
the frontend renders account_name, not name, so this is invisible to
the user.
"""

import frappe

DEFAULT_COMPANY = "Educational Systems Technological Institute"

# (name override or None -> autoname, account_name, parent_account, root_type)
HEADER_ACCOUNTS = [
    (None, "Cash in Bank", "Assets - ESTI", "Asset"),
    (None, "Contra Asset Account", "Assets - ESTI", "Asset"),
    (None, "Non Current", "Assets - ESTI", "Asset"),
    (None, "Current", "Assets - ESTI", "Asset"),
    ("Non Current (Liabilities) - ESTI", "Non Current", "Liabilities - ESTI", "Liability"),
    ("Current (Liabilities) - ESTI", "Current", "Liabilities - ESTI", "Liability"),
    (None, "Revenues", None, "Income"),
    (None, "Expenses", None, "Expense"),
]


def sync_finance_coa_headers():
    """Idempotent — safe to call from after_migrate every time, matching
    sync_finance_print_formats()'s pattern. Skips any account whose name
    (explicit override, or the standard autoname) already exists."""
    for name_override, account_name, parent_account, root_type in HEADER_ACCOUNTS:
        probable_name = name_override or f"{account_name} - ESTI"
        if frappe.db.exists("Account", probable_name):
            continue
        doc_dict = {
            "doctype": "Account",
            "account_name": account_name,
            "company": DEFAULT_COMPANY,
            "root_type": root_type,
            "is_group": 1,
            "parent_account": parent_account,
        }
        doc = frappe.get_doc(doc_dict)
        if name_override:
            doc.insert(ignore_permissions=True, set_name=name_override)
        else:
            doc.insert(ignore_permissions=True)
    frappe.clear_cache()
