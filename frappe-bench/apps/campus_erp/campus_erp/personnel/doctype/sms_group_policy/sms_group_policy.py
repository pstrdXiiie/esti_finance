import frappe
from frappe import _
from frappe.model.document import Document


class SMSGroupPolicy(Document):
	def validate(self):
		duplicate = frappe.get_all(
			"SMS Group Policy",
			filters={
				"employment_status": self.employment_status,
				"policy": self.policy,
				"name": ["!=", self.name or "New SMS Group Policy"],
			},
		)
		if duplicate:
			frappe.throw(
				_("A policy assignment for {0} / {1} already exists.").format(
					self.employment_status, self.policy
				)
			)
