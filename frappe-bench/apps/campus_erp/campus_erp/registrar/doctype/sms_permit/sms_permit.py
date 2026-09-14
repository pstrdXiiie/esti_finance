import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class SMSPermit(Document):
	def validate(self):
		self.sync_fee_details_from_assessment()

	def sync_fee_details_from_assessment(self):
		if not self.assessment:
			self.total_fee = 0
			self.payment = 0
			self.due_payment = 0
			return

		assessment_student, total_fee, payment, receivable = frappe.db.get_value(
			"SMS Student Assessment",
			self.assessment,
			["student", "total_fee", "payment", "receivable"],
		)

		if assessment_student != self.student:
			frappe.throw(
				_("Assessment {0} belongs to a different student, not {1}.").format(
					self.assessment, self.student
				)
			)

		self.total_fee = flt(total_fee)
		self.payment = flt(payment)
		self.due_payment = flt(receivable)
