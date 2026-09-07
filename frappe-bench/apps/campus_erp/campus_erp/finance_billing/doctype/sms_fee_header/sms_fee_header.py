from frappe.model.document import Document
from frappe.utils import flt


class SMSFeeHeader(Document):
	def validate(self):
		self.amount = sum(flt(row.amount) for row in self.details)
