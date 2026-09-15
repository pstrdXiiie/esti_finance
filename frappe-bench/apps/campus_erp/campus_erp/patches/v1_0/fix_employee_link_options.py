import frappe


def execute():
	"""Nine doctypes shipped with their `employee` Link field pointing at
	ERPNext's stock Employee doctype instead of this app's real Personnel
	Info doctype: SMS Employee Loan, SMS Loan Application, SMS Employee
	Benefit, SMS Overtime, SMS Travel Order, SMS Loan Payment, SMS SSS
	Report Line, SMS PhilHealth Report Line, and SMS Tax Report Line.
	Employee has zero records on any site running this app, so every one
	of these fields was guaranteed to fail Link validation on save (or, for
	the doctypes populated programmatically rather than via form save,
	silently store a value typed against the wrong doctype). Confirmed via
	bench console/mariadb directly; see 05-PERSONNEL-IMPLEMENTATION-PLAN.md.

	SMS Statutory SSS Line, SMS Statutory PhilHealth Line, and SMS
	Statutory Tax Line have the same `employee` field but were authored
	with the correct "Personnel Info" options from the start and are not
	yet migrated into any site's database — deliberately excluded here.
	"""
	fixes = [
		("SMS Employee Loan", "employee"),
		("SMS Loan Application", "employee"),
		("SMS Employee Benefit", "employee"),
		("SMS Overtime", "employee"),
		("SMS Travel Order", "employee"),
		("SMS Loan Payment", "employee"),
		("SMS SSS Report Line", "employee"),
		("SMS PhilHealth Report Line", "employee"),
		("SMS Tax Report Line", "employee"),
	]
	for doctype, fieldname in fixes:
		docfield_name = frappe.db.get_value(
			"DocField", {"parent": doctype, "fieldname": fieldname}, "name"
		)
		if not docfield_name:
			continue
		field = frappe.get_doc("DocField", docfield_name)
		if field.options != "Personnel Info":
			field.options = "Personnel Info"
			field.save()
	frappe.clear_cache()
