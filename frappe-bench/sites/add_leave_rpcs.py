import frappe

PATH = frappe.get_app_path("campus_erp", "api", "personnel.py")

MARKER = "def add_leave_application("

NEW_CODE = '''

LEAVE_STATUSES_PENDING = ("Pending",)


@frappe.whitelist()
def add_leave_application(
	employee_id: str,
	leave_type: str,
	from_date: str,
	to_date: str,
	half_day: int | str = 0,
	reason: str | None = None,
	other_leave_reason: str | None = None,
) -> dict:
	"""Appends one row to Personnel Info's `leaves` child table and saves the
	parent doc. `employee_id` here is the Personnel Info DOCNAME (matching the
	frontend's leaveApplicationFields comment -- the parameter name is
	historical/misleading, not actually the employee_id data field).
	"""
	if not frappe.db.exists("Personnel Info", employee_id):
		frappe.throw(_("Personnel Info {0} not found.").format(employee_id))

	if to_date < from_date:
		frappe.throw(_("To Date cannot be before From Date."))

	doc = frappe.get_doc("Personnel Info", employee_id)
	doc.append(
		"leaves",
		{
			"date": today(),
			"leave_type": leave_type,
			"from_date": from_date,
			"to_date": to_date,
			"half_day": cint(half_day),
			"reason": reason,
			"other_leave_reason": other_leave_reason,
			"status": "Pending",
		},
	)
	doc.save(ignore_permissions=frappe.has_permission("Personnel Info", "write", doc))
	return {"name": doc.leaves[-1].name}


@frappe.whitelist()
def list_recent_leaves(employee_id: str | None = None, limit: int = 20) -> list[dict]:
	"""Flattened view of `leaves` rows across Personnel Info, newest first --
	joins in the parent's employee_id/name/department the same way
	get_loan_summary does for loans, since the child rows themselves carry
	no employee-identifying fields (matching how `infractions` also stores
	nothing about who it belongs to).

	Unfiltered (all employees) unless `employee_id` (a Personnel Info
	docname) is passed -- the frontend's current "Recent" tables call this
	with no argument, which is the known-unscoped self-service list gap;
	passing employee_id here is what a future scoped-to-self fix would use.
	"""
	parent = frappe.qb.DocType("Personnel Info")
	child = frappe.qb.DocType("SMS Personnel Leave Application")

	query = (
		frappe.qb.from_(child)
		.join(parent)
		.on(child.parent == parent.name)
		.select(
			child.name,
			parent.name.as_("personnel_info"),
			parent.employee_id,
			fn.Concat(parent.first_name, " ", parent.last_name).as_("employee_name"),
			parent.department,
			child.leave_type,
			child.from_date,
			child.to_date,
			child.half_day,
			child.reason,
			child.date,
			child.status,
			child.days_approved,
			child.with_pay,
			child.without_pay,
			child.immediate_superior,
			child.hrd_head,
		)
		.orderby(child.modified, order=frappe.qb.desc)
		.limit(cint(limit) or 20)
	)
	if employee_id:
		query = query.where(parent.name == employee_id)

	return query.run(as_dict=True)


@frappe.whitelist()
def list_pending_leaves(limit: int = 100) -> list[dict]:
	"""Approval queue for Administration > Approvals > Leave Applications
	(PendingLeavesTable.tsx). Also surfaces vacation_leave/sick_leave from
	the parent so the approval dialog's Leave Credits panel has something
	to show without a second round trip.
	"""
	parent = frappe.qb.DocType("Personnel Info")
	child = frappe.qb.DocType("SMS Personnel Leave Application")

	query = (
		frappe.qb.from_(child)
		.join(parent)
		.on(child.parent == parent.name)
		.select(
			child.name,
			parent.name.as_("personnel_info"),
			parent.employee_id,
			fn.Concat(parent.first_name, " ", parent.last_name).as_("employee_name"),
			parent.department,
			parent.vacation_leave,
			parent.sick_leave,
			child.leave_type,
			child.from_date,
			child.to_date,
			child.half_day,
			child.reason,
			child.date,
			child.status,
		)
		.where(child.status.isin(LEAVE_STATUSES_PENDING))
		.orderby(child.modified, order=frappe.qb.desc)
		.limit(cint(limit) or 100)
	)
	return query.run(as_dict=True)


def _get_leave_row(employee_id: str, row_name: str):
	doc = frappe.get_doc("Personnel Info", employee_id)
	row = next((r for r in doc.leaves if r.name == row_name), None)
	if not row:
		frappe.throw(_("Leave row {0} not found on Personnel Info {1}.").format(row_name, employee_id))
	return doc, row


@frappe.whitelist()
def approve_leave_application(
	employee_id: str,
	row_name: str,
	days_approved: float | None = None,
	with_pay: float | None = None,
	without_pay: float | None = None,
	immediate_superior: str | None = None,
	hrd_head: str | None = None,
) -> dict:
	"""Approves one `leaves` row in place and deducts the approved days from
	the parent's vacation_leave/sick_leave balance -- deduction only fires for
	Vacation/Sick leave types (Emergency/Paternal/Maternal/Others don't draw
	against those two specific balance fields), and only for the `with_pay`
	portion, mirroring how `without_pay` leave doesn't consume paid credits.
	"""
	doc, row = _get_leave_row(employee_id, row_name)
	if row.status != "Pending":
		frappe.throw(_("Leave application {0} is not Pending (current status: {1}).").format(
			row_name, row.status
		))

	row.status = "Approved"
	row.days_approved = flt(days_approved) if days_approved is not None else row.days_approved
	row.with_pay = flt(with_pay) if with_pay is not None else row.with_pay
	row.without_pay = flt(without_pay) if without_pay is not None else row.without_pay
	row.immediate_superior = immediate_superior
	row.hrd_head = hrd_head

	paid_days = flt(row.with_pay)
	if paid_days > 0:
		if row.leave_type == "Vacation":
			doc.vacation_leave = flt(flt(doc.vacation_leave) - paid_days)
		elif row.leave_type == "Sick":
			doc.sick_leave = flt(flt(doc.sick_leave) - paid_days)

	doc.save(ignore_permissions=frappe.has_permission("Personnel Info", "write", doc))
	return {"status": row.status, "vacation_leave": doc.vacation_leave, "sick_leave": doc.sick_leave}


@frappe.whitelist()
def reject_leave_application(
	employee_id: str,
	row_name: str,
	immediate_superior: str | None = None,
	hrd_head: str | None = None,
) -> dict:
	"""Rejects one `leaves` row in place. No balance deduction -- rejected
	leave never consumed credits in the first place.
	"""
	doc, row = _get_leave_row(employee_id, row_name)
	if row.status != "Pending":
		frappe.throw(_("Leave application {0} is not Pending (current status: {1}).").format(
			row_name, row.status
		))

	row.status = "Rejected"
	row.immediate_superior = immediate_superior
	row.hrd_head = hrd_head

	doc.save(ignore_permissions=frappe.has_permission("Personnel Info", "write", doc))
	return {"status": row.status}
'''

with open(PATH, "r") as f:
	content = f.read()

if MARKER in content:
	print(f"'{MARKER}' already present in {PATH} -- skipping, nothing written.")
else:
	# Confirm `fn` (query_builder functions) is imported; add it if not,
	# since Concat isn't already imported by the existing loan code (only
	# Sum is).
	if "from frappe.query_builder.functions import" in content and "fn" not in content.split(
		"from frappe.query_builder.functions import", 1
	)[1].split("\n", 1)[0]:
		content = content.replace(
			"from frappe.query_builder.functions import Sum",
			"from frappe.query_builder.functions import Sum\nfrom frappe.query_builder import functions as fn",
		)
	with open(PATH, "w") as f:
		f.write(content + NEW_CODE)
	print(f"Appended 5 leave RPCs to {PATH}")

frappe.clear_cache()
print("Verifying:")
import campus_erp.api.personnel as p
import importlib
importlib.reload(p)
print([name for name in dir(p) if not name.startswith("_")])

