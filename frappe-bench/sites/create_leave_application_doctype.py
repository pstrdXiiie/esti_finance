import json

import frappe

PARENT_DOCTYPE = "Personnel Info"
CHILD_DOCTYPE = "SMS Personnel Leave Application"
CHILD_TABLE_FIELDNAME = "leaves"

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
        "fieldname": "date",
        "label": "Date Applied",
        "fieldtype": "Date",
        "reqd": 1,
        "in_list_view": 1,
        "default": "Today",
    })
    child.append("fields", {
        "fieldname": "leave_type",
        "label": "Leave Type",
        "fieldtype": "Select",
        "options": "Vacation\nSick\nEmergency\nPaternal\nMaternal\nOthers",
        "reqd": 1,
        "in_list_view": 1,
    })
    child.append("fields", {
        "fieldname": "from_date",
        "label": "From",
        "fieldtype": "Date",
        "reqd": 1,
        "in_list_view": 1,
    })
    child.append("fields", {
        "fieldname": "to_date",
        "label": "To",
        "fieldtype": "Date",
        "reqd": 1,
        "in_list_view": 1,
    })
    child.append("fields", {
        "fieldname": "half_day",
        "label": "Half Day",
        "fieldtype": "Check",
    })
    child.append("fields", {
        "fieldname": "reason",
        "label": "Reason",
        "fieldtype": "Small Text",
    })
    child.append("fields", {
        "fieldname": "other_leave_reason",
        "label": "Other Leave Reason",
        "fieldtype": "Data",
    })
    child.append("fields", {
        "fieldname": "status",
        "label": "Status",
        "fieldtype": "Select",
        "options": "Pending\nApproved\nRejected",
        "default": "Pending",
        "in_list_view": 1,
    })
    child.append("fields", {
        "fieldname": "days_approved",
        "label": "Days Approved",
        "fieldtype": "Float",
    })
    child.append("fields", {
        "fieldname": "with_pay",
        "label": "With Pay",
        "fieldtype": "Float",
    })
    child.append("fields", {
        "fieldname": "without_pay",
        "label": "Without Pay",
        "fieldtype": "Float",
    })
    child.append("fields", {
        "fieldname": "immediate_superior",
        "label": "Immediate Superior",
        "fieldtype": "Data",
    })
    child.append("fields", {
        "fieldname": "hrd_head",
        "label": "HRD Head",
        "fieldtype": "Data",
    })
    child.insert(ignore_permissions=True)
    print(f"Created child DocType: {CHILD_DOCTYPE}")
else:
    print(f"{CHILD_DOCTYPE} already exists — skipping creation")

parent = frappe.get_doc("DocType", PARENT_DOCTYPE)
if not any(f.fieldname == CHILD_TABLE_FIELDNAME for f in parent.fields):
    parent.append("fields", {
        "fieldname": CHILD_TABLE_FIELDNAME,
        "label": "Leave Applications",
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

