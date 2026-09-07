# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Library circulation business rules (blueprint Phase 4). Per the same guiding
principle as registrar.py, personnel.py, and finance_billing.py (blueprint
§4.3): DocTypes own schema and permissions only; every rule lives here once,
as a real Python function, instead of being re-implemented per form.

This module deliberately does NOT use a Frappe Workflow or Administration's
Approval Policy/Request pair for the Borrow Request -> Loan lifecycle — the
mapping analysis explicitly checked and rejected both, because approving a
request creates a second document (a Loan) and returning a loan closes two
documents at once (the Loan and its originating Request), neither of which
either declarative mechanism handles. So approve_borrow_request/reject_
borrow_request/return_loan below are real functions, not workflow actions.

SMS Library Book.current_status is a cache the API alone is trusted to
maintain (never hand-edited, per the field's own read_only + description) —
but search_catalog's "available_copies" is deliberately never read off any
cached counter on SMS Library Title; it is always recomputed fresh from a
live COUNT against SMS Library Book, the same "recompute from source of
truth" pattern already used by registrar.py's compute_grade_points and
personnel.py's loan_balance.

The borrow-request race condition (two borrowers requesting the last
available copy of a title at the same instant) is closed the same way
registrar.py's enroll() closes the class-capacity race: a row-locked
`SELECT ... FOR UPDATE` re-check inside create_borrow_request(), immediately
before the insert, on top of the eligibility pre-check the frontend already
ran.
"""

import frappe
from frappe import _
from frappe.utils import add_days, date_diff, flt, today


@frappe.whitelist()
def search_catalog(query: str | None = None) -> list[dict]:
	"""Read-only catalog search for the self-service student/guest screen.
	available_copies is always computed fresh against SMS Library Book —
	never trusted or cached on the Title itself.
	"""
	filters = {"status": "Active"}
	or_filters = None
	if query:
		like = f"%{query}%"
		or_filters = {
			"title": ["like", like],
			"isbn": ["like", like],
			"category": ["like", like],
		}

	titles = frappe.get_all(
		"SMS Library Title",
		filters=filters,
		or_filters=or_filters,
		fields=["name", "title", "isbn", "category", "publisher"],
		order_by="title asc",
	)

	results = []
	for row in titles:
		available_copies = frappe.db.count(
			"SMS Library Book", {"title": row.name, "current_status": "Available"}
		)
		results.append(
			{
				"name": row.name,
				"title": row.title,
				"isbn": row.isbn,
				"category": row.category,
				"publisher": row.publisher,
				"available_copies": available_copies,
			}
		)
	return results


@frappe.whitelist()
def check_borrow_eligibility(borrower_type: str, borrower: str, book: str) -> dict:
	"""Pure pre-check the frontend can call before submitting a request,
	mirroring registrar.py's check_prerequisites: returns {ok, reason} rather
	than throwing, so the caller can show a message and let the user decide,
	or block the Borrow button. Does not mutate anything.
	"""
	if borrower_type not in ("Student", "Guest"):
		frappe.throw(_("Borrower Type must be Student or Guest."))
	if not frappe.db.exists(borrower_type if borrower_type == "Student" else "SMS Library Guest", borrower):
		frappe.throw(_("{0} {1} does not exist.").format(borrower_type, borrower))

	settings = frappe.get_cached_doc("SMS Library Settings")

	# (a) Book must be currently available — fetch fresh, not cached.
	current_status = frappe.db.get_value("SMS Library Book", book, "current_status")
	if current_status is None:
		frappe.throw(_("Book {0} does not exist.").format(book))
	if current_status != "Available":
		return {"ok": False, "reason": _("Book {0} is not available ({1}).").format(book, current_status)}

	borrower_filters = {"status": "Outstanding"}
	if borrower_type == "Student":
		borrower_filters["student"] = borrower
	else:
		borrower_filters["guest"] = borrower

	# (b) Active-loan cap.
	if settings.max_active_loans_per_borrower and settings.max_active_loans_per_borrower > 0:
		active_count = frappe.db.count("SMS Library Loan", borrower_filters)
		if active_count >= settings.max_active_loans_per_borrower:
			return {
				"ok": False,
				"reason": _("Borrower already has {0} active loan(s), the maximum allowed.").format(
					active_count
				),
			}

	# (c) Overdue block.
	if settings.block_borrowing_if_overdue:
		overdue = frappe.get_all(
			"SMS Library Loan",
			filters={**borrower_filters, "date_due": ["<", today()]},
			limit=1,
		)
		if overdue:
			return {"ok": False, "reason": _("Borrower has an overdue loan and is blocked from borrowing.")}

	return {"ok": True, "reason": None}


@frappe.whitelist()
def create_borrow_request(borrower_type: str, borrower: str, book: str) -> dict:
	"""Creates a Pending SMS Library Borrow Request. Re-verifies availability
	with a row-locked read immediately before insert, closing the race
	condition between the eligibility pre-check above and the actual insert
	(the same pattern registrar.py's enroll() uses against Course Enrollment
	for class-capacity).
	"""
	check = check_borrow_eligibility(borrower_type, borrower, book)
	if not check["ok"]:
		frappe.throw(check["reason"])

	locked_status = frappe.db.sql(
		"""SELECT current_status FROM `tabSMS Library Book`
		WHERE name=%s FOR UPDATE""",
		(book,),
	)[0][0]
	if locked_status != "Available":
		frappe.throw(_("Book {0} was just taken by another borrower. Please try again.").format(book))

	request = frappe.get_doc(
		{
			"doctype": "SMS Library Borrow Request",
			"borrower_type": borrower_type,
			"student": borrower if borrower_type == "Student" else None,
			"guest": borrower if borrower_type == "Guest" else None,
			"book": book,
			"status": "Pending",
		}
	)
	request.insert(ignore_permissions=frappe.has_permission("SMS Library Borrow Request", "create"))
	return {"name": request.name}


@frappe.whitelist()
def approve_borrow_request(request: str) -> dict:
	"""Approves a Pending request: creates the Loan, marks the book On Loan,
	marks the request Approved.
	"""
	req = frappe.get_doc("SMS Library Borrow Request", request)
	if req.status != "Pending":
		frappe.throw(_("Request {0} is not Pending (current status: {1}).").format(request, req.status))

	# Defensive re-check — a Pending request already implies no one else
	# could have been approved against the same book, but this is cheap
	# insurance against manual data edits.
	current_status = frappe.db.get_value("SMS Library Book", req.book, "current_status")
	if current_status != "Available":
		frappe.throw(_("Book {0} is not available ({1}).").format(req.book, current_status))

	settings = frappe.get_cached_doc("SMS Library Settings")
	date_approved = today()
	date_due = add_days(date_approved, settings.default_loan_period_days)

	loan = frappe.get_doc(
		{
			"doctype": "SMS Library Loan",
			"request": req.name,
			"book": req.book,
			"borrower_type": req.borrower_type,
			"student": req.student,
			"guest": req.guest,
			"date_approved": date_approved,
			"date_due": date_due,
			"status": "Outstanding",
		}
	)
	loan.insert(ignore_permissions=frappe.has_permission("SMS Library Loan", "create"))

	frappe.db.set_value("SMS Library Book", req.book, "current_status", "On Loan")
	frappe.db.set_value("SMS Library Borrow Request", request, "status", "Approved")

	return {"loan": loan.name}


@frappe.whitelist()
def reject_borrow_request(request: str, reason: str | None = None) -> dict:
	"""Declines a Pending request. reason is accepted for future audit-trail
	use but is not persisted anywhere on the doctype today.
	"""
	req = frappe.get_doc("SMS Library Borrow Request", request)
	if req.status != "Pending":
		frappe.throw(_("Request {0} is not Pending (current status: {1}).").format(request, req.status))

	frappe.db.set_value("SMS Library Borrow Request", request, "status", "Rejected")
	return {"name": request}


@frappe.whitelist()
def return_loan(loan: str, or_number: str | None = None) -> dict:
	"""Closes an Outstanding loan: computes overdue days/fine, requires an OR
	number only when a fine is actually owed (the one place that condition
	is enforced), frees the book, and marks the originating request Returned.
	"""
	doc = frappe.get_doc("SMS Library Loan", loan)
	if doc.status != "Outstanding":
		frappe.throw(_("Loan {0} is not Outstanding (current status: {1}).").format(loan, doc.status))

	overdue_days = max(0, date_diff(today(), doc.date_due))
	settings = frappe.get_cached_doc("SMS Library Settings")
	fine_amount = overdue_days * flt(settings.fine_per_day)

	if fine_amount > 0 and not or_number:
		frappe.throw(_("An OR number is required to close this loan — a late-return fine of {0} is owed.").format(
			fine_amount
		))

	frappe.db.set_value(
		"SMS Library Loan",
		loan,
		{
			"status": "Returned",
			"date_returned": today(),
			"overdue_days": overdue_days,
			"fine_amount": fine_amount,
			"or_number": or_number,
		},
	)
	frappe.db.set_value("SMS Library Book", doc.book, "current_status", "Available")
	if doc.request:
		frappe.db.set_value("SMS Library Borrow Request", doc.request, "status", "Returned")

	return {"overdue_days": overdue_days, "fine_amount": fine_amount, "status": "Returned"}


@frappe.whitelist()
def kiosk_login(terminal_id: str, borrower_type: str, borrower: str) -> dict:
	"""Get-or-create an SMS Library Kiosk Session for this terminal and log
	the given borrower into it.
	"""
	if borrower_type not in ("Student", "Guest"):
		frappe.throw(_("Borrower Type must be Student or Guest."))

	if borrower_type == "Student":
		label = frappe.db.get_value("Student", borrower, "student_name")
		if label is None:
			frappe.throw(_("Student {0} does not exist.").format(borrower))
	else:
		guest = frappe.db.get_value("SMS Library Guest", borrower, ["last_name", "first_name"], as_dict=True)
		if guest is None:
			frappe.throw(_("Guest {0} does not exist.").format(borrower))
		label = f"{guest.last_name}, {guest.first_name}"

	existing = frappe.db.exists("SMS Library Kiosk Session", {"terminal_id": terminal_id})
	if existing:
		session = frappe.get_doc("SMS Library Kiosk Session", existing)
	else:
		session = frappe.get_doc({"doctype": "SMS Library Kiosk Session", "terminal_id": terminal_id})

	session.session_status = "Active"
	session.current_borrower_type = borrower_type
	session.current_borrower_label = label
	session.force_logout = 0
	session.save(ignore_permissions=True)

	return {"name": session.name, "current_borrower_label": label}


@frappe.whitelist()
def kiosk_logout(terminal_id: str) -> dict:
	"""Logs the current borrower out of this terminal's session."""
	existing = frappe.db.exists("SMS Library Kiosk Session", {"terminal_id": terminal_id})
	if not existing:
		frappe.throw(_("No Kiosk Session found for terminal {0}.").format(terminal_id))

	session = frappe.get_doc("SMS Library Kiosk Session", existing)
	session.session_status = "Idle"
	session.current_borrower_type = None
	session.current_borrower_label = None
	session.force_logout = 0
	session.save(ignore_permissions=True)

	return {"name": session.name}


@frappe.whitelist()
def force_logout_kiosk(terminal_id: str) -> dict:
	"""Same update as kiosk_logout, plus a realtime push so the kiosk's own
	frontend (subscribed to room=f"library_kiosk_{terminal_id}" via the
	Frappe Socket.IO client) can react immediately rather than polling.
	"""
	existing = frappe.db.exists("SMS Library Kiosk Session", {"terminal_id": terminal_id})
	if not existing:
		frappe.throw(_("No Kiosk Session found for terminal {0}.").format(terminal_id))

	session = frappe.get_doc("SMS Library Kiosk Session", existing)
	session.session_status = "Idle"
	session.current_borrower_type = None
	session.current_borrower_label = None
	session.force_logout = 0
	session.save(ignore_permissions=True)

	frappe.publish_realtime(
		event="library_kiosk_force_logout",
		message={"terminal_id": terminal_id},
		room=f"library_kiosk_{terminal_id}",
	)

	return {"name": session.name}
