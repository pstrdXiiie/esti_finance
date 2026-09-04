import frappe
from frappe.model.document import Document
from campus_erp.finance_billing.doctype.sms_campus_gl_entry.sms_campus_gl_entry import (
	post_gl_entries,
	reverse_gl_entries,
)


class SMSJournalVoucher(Document):
	def validate(self):
		total_debit = sum(row.debit or 0 for row in self.accounts)
		total_credit = sum(row.credit or 0 for row in self.accounts)
		if round(total_debit, 2) != round(total_credit, 2):
			frappe.throw(
				f"Total Debit ({total_debit}) must equal Total Credit ({total_credit})."
			)
		self.total_debit = total_debit
		self.total_currcy = total_credit

	def on_submit(self):
		rows = []
		for row in self.accounts:
			account_names = [r.account for r in self.accounts if r.name != row.name]
			rows.append({
				"account": row.account,
				"debit": row.debit,
				"credit": row.credit,
				"party_type": row.party_type,
				"party": row.party,
				"against_account": account_names[0] if len(account_names) == 1 else None,
				"remarks": self.user_remark,
			})
		post_gl_entries(
			voucher_type="SMS Journal Voucher",
			voucher_no=self.name,
			posting_date=self.posting_date,
			rows=rows,
		)

	def on_cancel(self):
		reverse_gl_entries(voucher_type="SMS Journal Voucher", voucher_no=self.name)
