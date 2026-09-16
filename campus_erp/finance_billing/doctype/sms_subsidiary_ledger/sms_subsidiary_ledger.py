# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt

from frappe.model.document import Document
from frappe.utils import flt


class SMSSubsidiaryLedger(Document):
	def validate(self):
		self.total = sum(flt(row.amount) for row in self.entries)
