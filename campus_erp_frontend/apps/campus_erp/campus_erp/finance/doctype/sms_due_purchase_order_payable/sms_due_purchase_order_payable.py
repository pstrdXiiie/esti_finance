# Copyright (c) 2026
import frappe
from frappe.model.document import Document
from frappe import _


class SMSDuePurchaseOrderPayable(Document):
	def validate(self):
		total_debit = sum(flt(row.debit) for row in self.accounts)
		total_credit = sum(flt(row.credit) for row in self.accounts)
		self.total_debit = total_debit
		self.total_credit = total_credit

		if self.accounts and total_debit != total_credit:
			frappe.throw(_("Debits and credits must balance before saving."))

	def on_update(self):
		# TODO: once "Posted", propagate to actual GL Entry records and
		# mark the source SMS Purchase Order as paid. Per the legacy
		# screen's warning, posting should be irreversible.
		pass


from frappe.utils import flt
