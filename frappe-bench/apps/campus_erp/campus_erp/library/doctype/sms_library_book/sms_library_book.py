import frappe
from frappe import _
from frappe.model.document import Document


class SMSLibraryBook(Document):
	def validate(self):
		if not self.current_status:
			self.current_status = "Available"

	def before_insert(self):
		title = frappe.get_doc("SMS Library Title", self.title)
		if title.qty is not None and title.qty <= 0:
			frappe.throw(_("Title {0} has no remaining allotted quantity to accession a new copy against.").format(self.title))

	def after_insert(self):
		# after_insert (not on_update guarded by is_new()) -- on this Frappe
		# version, autoincrement-named doctypes already have __islocal
		# cleared by the time on_update fires during insert, so is_new()
		# reads False there and this bookkeeping would silently never run.
		# after_insert always means "just inserted," so no such guard is needed.
		frappe.db.set_value(
			"SMS Library Title", self.title,
			{
				"qty": frappe.db.get_value("SMS Library Title", self.title, "qty") - 1,
				"num_copies": frappe.db.count("SMS Library Book", {"title": self.title}),
			},
		)

	def on_trash(self):
		frappe.db.set_value(
			"SMS Library Title", self.title,
			{
				"qty": frappe.db.get_value("SMS Library Title", self.title, "qty") + 1,
				"num_copies": frappe.db.count("SMS Library Book", {"title": self.title}) - 1,
			},
		)
