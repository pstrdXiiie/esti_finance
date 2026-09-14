import json

import frappe

PARENT_DOCTYPE = "Personnel Info"
CHILD_DOCTYPE = "SMS Personnel Infractions"
CHILD_TABLE_FIELDNAME = "infractions"

parent_module = frappe.db.get_value("DocType", PARENT_DOCTYPE, "module")
print(f"Personnel Info lives in module: {parent_module!r}")

if not frappe.db.exists("DocType", CHILD_DOCTYPE):
    child = frappe.new_doc("DocType")
    child.name = CHILD_DOCTYPE
    child.module = parent_module
    child.custom = 0
    child.istable = 1
    child.editable_grid = 1
    child.append("fields", {
        "fieldname": "violation_date",
        "label": "Date",
        "fieldtype": "Date",
        "reqd": 1,
        "in_list_view": 1,
    })
    child.append("fields", {
        "fieldname": "violation",
        "label": "Violation",
        "fieldtype": "Data",
        "reqd": 1,
        "in_list_view": 1,
    })
    child.append("fields", {
        "fieldname": "action_taken",
        "label": "Action Taken",
        "fieldtype": "Data",
        "in_list_view": 1,
    })
    child.append("fields", {
        "fieldname": "remarks",
        "label": "Remarks",
        "fieldtype": "Small Text",
    })
    child.insert(ignore_permissions=True)
    print(f"Created child DocType: {CHILD_DOCTYPE}")
else:
    print(f"{CHILD_DOCTYPE} already exists — skipping creation")

parent = frappe.get_doc("DocType", PARENT_DOCTYPE)
if not any(f.fieldname == CHILD_TABLE_FIELDNAME for f in parent.fields):
    parent.append("fields", {
        "fieldname": CHILD_TABLE_FIELDNAME,
        "label": "Infractions",
        "fieldtype": "Table",
        "options": CHILD_DOCTYPE,
    })
    parent.save(ignore_permissions=True)
    print(f"Added '{CHILD_TABLE_FIELDNAME}' Table field to {PARENT_DOCTYPE}")
else:
    print(f"'{CHILD_TABLE_FIELDNAME}' field already exists on {PARENT_DOCTYPE} — skipping")

frappe.db.commit()
frappe.clear_cache(doctype=PARENT_DOCTYPE)
frappe.clear_cache(doctype=CHILD_DOCTYPE)

print(json.dumps([f.as_dict() for f in frappe.get_meta(CHILD_DOCTYPE).fields], indent=2, default=str))
