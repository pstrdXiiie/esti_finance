"""
Runtime patch for a genuine bug in Frappe core, not anything in campus_erp's own
schema/logic.

`frappe.model.create_new.set_dynamic_default_values` (the function that seeds a
brand-new document's field values before the caller ever touches it) has this
loop:

    for df in frappe.get_meta(doc["doctype"]).get("fields"):
        if df.get("default"):
            ...
            elif df.fieldtype == "Datetime" and df.default.lower() == "now":
                doc[df.fieldname] = now_datetime()

        if df.fieldtype == "Time":
            doc[df.fieldname] = nowtime()

The last `if` is a sibling of the `if df.get("default"):` block above it, not
nested inside it - unlike the Datetime branch one line up, which correctly
requires `default == "now"` before stamping the current time. As written, EVERY
Time-type field on EVERY new document (any doctype, not just this app's own)
gets silently set to the current wall-clock time, even when the field declares
no default at all. Confirmed via direct reproduction: `frappe.new_doc(...)` on
any doctype with an undefaulted Time field already carries a bogus near-"now"
value before any application code runs. Found via `Student Group.start_time`/
`end_time` (campus_erp custom fields) coming back as microsecond-precision
near-current timestamps instead of null when left unset - see
`campus_erp/setup/custom_fields.py`'s "Student Group" block for those fields.

Patched here (function replaced wholesale at app-import time) rather than
edited in the vendor file directly, so this survives `bench update` instead of
being silently reverted or conflicting with a future patch to the same file -
and so it self-corrects for free if a later Frappe release fixes the same bug
upstream (this override is only ever wrong-in-a-new-way if Frappe changes this
function's *other* behavior, which `apply()`'s docstring-adjacent duplication
below has to be kept in sync with by hand).
"""

import frappe
import frappe.model.create_new as _create_new


def _fixed_set_dynamic_default_values(doc, parent_doc, parentfield):
    from frappe.core.doctype.user_permission.user_permission import get_user_permissions
    from frappe.utils import cstr, now_datetime, nowtime

    user_permissions = get_user_permissions()

    for df in frappe.get_meta(doc["doctype"]).get("fields"):
        if df.get("default"):
            if cstr(df.default).startswith(":"):
                default_value = _create_new.get_default_based_on_another_field(
                    df, user_permissions, parent_doc
                )
                if default_value is not None and not doc.get(df.fieldname):
                    doc[df.fieldname] = default_value

            elif df.fieldtype == "Datetime" and df.default.lower() == "now":
                doc[df.fieldname] = now_datetime()

            elif df.fieldtype == "Time" and df.default.lower() == "now":
                doc[df.fieldname] = nowtime()

    if parent_doc:
        doc["parent"] = parent_doc.name
        doc["parenttype"] = parent_doc.doctype

    if parentfield:
        doc["parentfield"] = parentfield


def apply():
    _create_new.set_dynamic_default_values = _fixed_set_dynamic_default_values
