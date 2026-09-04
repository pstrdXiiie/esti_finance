import frappe
from frappe.model.document import Document


class SMSCampusGLEntry(Document):
	def validate(self):
		if self.debit and self.credit:
			frappe.throw("A GL Entry row cannot have both a Debit and a Credit amount.")
		if not self.debit and not self.credit:
			frappe.throw("A GL Entry row needs either a Debit or a Credit amount.")


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
		{"voucher_type": voucher_type, "voucher_no": voucher_no},
		"is_cancelled",
		1,
	)
