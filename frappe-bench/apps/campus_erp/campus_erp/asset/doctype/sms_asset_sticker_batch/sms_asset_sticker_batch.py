import frappe
from frappe.model.document import Document


class SMSAssetStickerBatch(Document):
	def validate(self):
		if not self.printed_by:
			self.printed_by = frappe.session.user
