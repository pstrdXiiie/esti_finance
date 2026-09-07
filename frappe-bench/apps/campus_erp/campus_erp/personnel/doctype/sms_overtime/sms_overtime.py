import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import time_diff_in_hours, flt


class SMSOvertime(Document):
	def validate(self):
		if self.time_to <= self.time_from:
			frappe.throw(_("Time To must be later than Time From."))
		self.num_hours = flt(time_diff_in_hours(str(self.time_to), str(self.time_from)), 2)

		if self.docstatus == 1 and self.status != "Approved":
			# The "SMS Overtime Approval" Workflow's own "Approved" state submits
			# the document as a side effect (its doc_status is "1", the only
			# state with that value) -- Frappe's set_workflow_state_on_action
			# force-corrects `status` to "Approved" on ANY direct submit action
			# regardless of how it got there, so without this guard a plain
			# docstatus PUT silently skips the Recommend/Approve chain entirely.
			frappe.throw(
				_(
					"This overtime filing can only be submitted by completing the "
					"approval workflow (Submit for Recommendation, then Recommend, "
					"then Approve) — not by submitting it directly."
				)
			)
