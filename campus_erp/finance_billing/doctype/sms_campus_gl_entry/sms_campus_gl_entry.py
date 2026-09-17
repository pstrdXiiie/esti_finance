import frappe
from frappe.model.document import Document


class SMSCampusGLEntry(Document):
    def validate(self):
        debit = self.debit or 0
        credit = self.credit or 0

        if debit and credit:
            frappe.throw(
                "A GL Entry row cannot have both a Debit and a Credit amount."
            )

        if not debit and not credit:
            frappe.throw(
                "A GL Entry row needs either a Debit or a Credit amount."
            )

        if debit < 0 or credit < 0:
            frappe.throw(
                "A GL Entry row cannot contain negative amounts."
            )


def post_gl_entries(voucher_type: str, voucher_no: str, posting_date, rows: list[dict]):
    for row in rows:
        frappe.get_doc({
            "doctype": "SMS Campus GL Entry",
            "posting_date": posting_date,
            "voucher_type": voucher_type,
            "voucher_no": voucher_no,
            "account": row["account"],
            "debit": row.get("debit", 0),
            "credit": row.get("credit", 0),
            "against_account": row.get("against_account"),
            "party_type": row.get("party_type"),
            "party": row.get("party"),
            "remarks": row.get("remarks"),
        }).insert(ignore_permissions=True)


def reverse_gl_entries(voucher_type: str, voucher_no: str):
    frappe.db.set_value(
        "SMS Campus GL Entry",
        {
            "voucher_type": voucher_type,
            "voucher_no": voucher_no,
        },
        "is_cancelled",
        1,
    )
