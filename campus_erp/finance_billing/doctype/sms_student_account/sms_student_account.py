# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class SMSStudentAccount(Document):
	def validate(self):
		"""Keeps `balance` a running total per student per school_year/semester,
		since the frontend's Student Accounts screen renders it read-only and
		never sends a value itself. `bal_adjustment` lets a user override the
		running total directly via `adj_bal` (e.g. a manual correction) instead
		of accumulating from the previous row.
		"""
		if self.bal_adjustment:
			self.balance = flt(self.adj_bal)
			return

		previous_balance = frappe.db.get_value(
			"SMS Student Account",
			{
				"stud_num": self.stud_num,
				"school_year": self.school_year,
				"semester": self.semester,
				"name": ["!=", self.name or ""],
			},
			"balance",
			order_by="date desc, creation desc",
		)
		self.balance = flt(previous_balance) + flt(self.amount)
