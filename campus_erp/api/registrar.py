# Copyright (c) 2026, School Administration and contributors
# For license information, please see license.txt
"""
Registrar business rules (blueprint Phase 1). Per the migration's guiding
principle (blueprint §4.3): DocTypes own schema and permissions only; every
rule that used to live inline in a VB button-click handler lives here once,
instead of duplicated across forms — the legacy prerequisite check alone was
found re-implemented 5 times with subtle inconsistencies.
"""

import frappe
from frappe import _
from frappe.utils import flt, get_time


@frappe.whitelist()
def check_prerequisites(student: str, course: str) -> dict:
	"""Single canonical prerequisite check, replacing the legacy's 5 duplicated
	(and inconsistent) implementations. Returns {ok, reason} rather than
	throwing, so callers (enroll(), and the frontend pre-flight check) can
	decide what to do with a failure.
	"""
	settings = frappe.get_cached_doc("Education Settings")
	if not settings.check_prerequisite:
		return {"ok": True, "reason": None}

	# Find this course's prerequisite via the student's active curriculum.
	student_doc = frappe.get_doc("Student", student)
	program_enrollment = frappe.get_all(
		"Program Enrollment",
		filters={"student": student},
		fields=["name", "program"],
		order_by="creation desc",
		limit=1,
	)
	if not program_enrollment:
		return {"ok": False, "reason": _("Student has no Program Enrollment on record.")}

	curriculum = frappe.get_all(
		"SMS Curriculum",
		filters={"course": program_enrollment[0].program, "is_active": 1},
		limit=1,
	)
	if not curriculum:
		# No curriculum on file for this program — nothing to check against.
		return {"ok": True, "reason": None}

	curriculum_doc = frappe.get_doc("SMS Curriculum", curriculum[0].name)
	prerequisite = None
	for row in curriculum_doc.subjects:
		if row.subject == course:
			prerequisite = row.prerequisite
			break

	if not prerequisite:
		return {"ok": True, "reason": None}

	prior = frappe.get_all(
		"Course Enrollment",
		filters={"student": student, "course": prerequisite},
		fields=["name", "status", "final_rating", "points"],
	)
	passed = [row for row in prior if row.status == "Completed" and row.final_rating not in ("INC", "DRP", "")]
	if not passed:
		return {
			"ok": False,
			"reason": _("Prerequisite {0} has not been completed.").format(prerequisite),
		}

	if settings.check_prerequisite_grade:
		# Stricter than "passed" (status == Completed, already required above):
		# the prerequisite's raw numeric grade must clear the configured
		# passing_grade threshold, not just whatever line the grading scale
		# happened to mark as passing.
		best_grade = max(
			(flt(row.final_rating) for row in passed if _is_number(row.final_rating)),
			default=None,
		)
		if best_grade is None or best_grade < flt(settings.passing_grade):
			return {
				"ok": False,
				"reason": _("Prerequisite {0} grade does not meet the required standard ({1}).").format(
					prerequisite, settings.passing_grade
				),
			}

	return {"ok": True, "reason": None}


@frappe.whitelist()
def enroll(student: str, student_group: str) -> dict:
	"""Enroll a student into one class (Student Group). Consolidates the
	legacy's duplicate-enlistment, class-capacity, and schedule-conflict
	checks that used to be re-implemented per form.
	"""
	sg = frappe.get_doc("Student Group", student_group)
	if not sg.course:
		frappe.throw(_("Student Group {0} has no Course set.").format(student_group))

	# 1. Duplicate-enrollment guard
	existing = frappe.get_all(
		"Course Enrollment",
		filters={"student": student, "student_group": student_group},
	)
	if existing:
		frappe.throw(_("{0} is already enrolled in {1}.").format(student, student_group))

	# 2. Prerequisite check
	check = check_prerequisites(student, sg.course)
	if not check["ok"]:
		frappe.throw(check["reason"])

	# 3. Class capacity — locked read to avoid the legacy's read-modify-write
	# race condition (blueprint §7 R-9: regClasses.enrolled was double-
	# incremented via 4+ independent legacy code paths).
	if sg.max_strength:
		current = frappe.db.sql(
			"""SELECT COUNT(*) FROM `tabCourse Enrollment`
			WHERE student_group=%s FOR UPDATE""",
			(student_group,),
		)[0][0]
		if current >= sg.max_strength:
			frappe.throw(_("Class {0} is at capacity ({1}/{1}).").format(student_group, sg.max_strength))

	# 4. Schedule-conflict guard — the legacy's FacultyInUse/RoomInUse/
	# DataInUse checks never actually worked (blueprint §8 Q1); this is a
	# real implementation, not a port.
	if sg.start_time and sg.end_time:
		day_fields = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
		my_days = {d for d in day_fields if sg.get(d)}
		if my_days:
			others = frappe.get_all(
				"Course Enrollment",
				filters={"student": student},
				fields=["student_group"],
			)
			for row in others:
				if not row.student_group:
					continue
				other_sg = frappe.get_cached_doc("Student Group", row.student_group)
				other_days = {d for d in day_fields if other_sg.get(d)}
				if not (my_days & other_days):
					continue
				if other_sg.start_time and other_sg.end_time and _times_overlap(
					sg.start_time, sg.end_time, other_sg.start_time, other_sg.end_time
				):
					frappe.throw(
						_("Schedule conflict with {0} on a shared day/time.").format(row.student_group)
					)

	program_enrollment = frappe.get_all(
		"Program Enrollment",
		filters={"student": student, **({"program": sg.program} if sg.program else {})},
		order_by="creation desc",
		limit=1,
		pluck="name",
	)
	if not program_enrollment:
		frappe.throw(
			_("{0} has no Program Enrollment{1} — enroll in the program before enrolling in a class.").format(
				student, _(" for {0}").format(sg.program) if sg.program else ""
			)
		)

	enrollment = frappe.get_doc(
		{
			"doctype": "Course Enrollment",
			"student": student,
			"course": sg.course,
			"student_group": student_group,
			"program": sg.program,
			"program_enrollment": program_enrollment[0],
			"enrollment_date": frappe.utils.today(),
			"status": "Enrolled",
		}
	)
	enrollment.insert(ignore_permissions=frappe.has_permission("Course Enrollment", "create"))
	return {"name": enrollment.name}


def _times_overlap(a_start, a_end, b_start, b_end) -> bool:
	return a_start < b_end and b_start < a_end


@frappe.whitelist()
def drop_enrollment(course_enrollment: str, reason: str | None = None) -> dict:
	doc = frappe.get_doc("Course Enrollment", course_enrollment)
	doc.status = "Dropped"
	if reason:
		doc.grade_remarks = "Dropped"
	doc.save(ignore_permissions=frappe.has_permission("Course Enrollment", "write", doc=doc))
	return {"name": doc.name, "status": doc.status}


@frappe.whitelist()
def compute_grade_points(course_enrollment: str) -> dict:
	"""Single canonical grade-to-points conversion, replacing the legacy's
	3-4 independently re-implemented versions — one of which (frmRegPrintRanking)
	had a confirmed bug (a `FinalRating = 0` vs `> 0` condition that silently
	broke conversion for ordinary 1.00-3.00 grades). Uses the school's Grading
	Scale (education app) rather than a hardcoded table.
	"""
	doc = frappe.get_doc("Course Enrollment", course_enrollment)
	if doc.final_rating in (None, "", "INC", "DRP"):
		return {"points": None, "is_passing": None}

	try:
		numeric_grade = flt(doc.final_rating)
	except (TypeError, ValueError):
		frappe.throw(_("Final Rating {0} is not a numeric grade.").format(doc.final_rating))

	course = frappe.get_cached_doc("Course", doc.course)
	scale_name = course.default_grading_scale
	if not scale_name:
		frappe.throw(
			_("Course {0} has no default_grading_scale configured — cannot compute points.").format(doc.course)
		)

	scale = frappe.get_doc("Grading Scale", scale_name)
	best_match = None
	for interval in sorted(scale.intervals, key=lambda r: flt(r.threshold)):
		if numeric_grade >= flt(interval.threshold):
			best_match = interval

	if not best_match:
		frappe.throw(_("No grading interval matches {0} on scale {1}.").format(numeric_grade, scale_name))

	points = flt(best_match.grade_code) if best_match.grade_code and _is_number(best_match.grade_code) else None
	is_passing = bool(best_match.is_passing)

	doc.db_set("points", points, notify=False)
	if is_passing and doc.status != "Completed":
		doc.db_set("status", "Completed", notify=False)
	elif not is_passing:
		doc.db_set("grade_remarks", "Failed", notify=False)

	return {"points": points, "is_passing": is_passing, "grade_code": best_match.grade_code}


def _is_number(value) -> bool:
	try:
		float(value)
		return True
	except (TypeError, ValueError):
		return False


@frappe.whitelist()
def get_class_roster(student_group: str) -> list[dict]:
	"""Backing call for the frontend's class-roster/gradebook screen."""
	return frappe.get_all(
		"Course Enrollment",
		filters={"student_group": student_group},
		fields=[
			"name",
			"student",
			"student_name",
			"prelim",
			"midterm",
			"final",
			"final_rating",
			"grade_remarks",
			"points",
			"status",
		],
		order_by="student_name asc",
	)


@frappe.whitelist()
def create_student(payload: dict) -> dict:
    """Creates a new Student from the Add Student wizard in one call: an
    optional Father and/or Mother Guardian record (only created for
    whichever side has a name), the Student itself with its guardians and
    credentials child rows built inline, and an optional SMS Student RFID
    Tag. One request = one DB transaction, so a failure partway (e.g. a
    duplicate RFID) rolls back everything automatically - no special
    handling needed beyond letting exceptions propagate.

    Targets the real, native "Student" doctype — its Student Control No.
    (stdnt_cno) is auto-assigned by the before_insert hook
    (campus_erp.utils.student.set_student_control_number), not set here.

    Expected payload shape (all keys optional except student.first_name
    and student.student_email_id, which Student itself already requires):
    {
        "student": {<any flat Student fieldname>: value, ...},
        "father_name": str | None,
        "father_mobile": str | None,
        "father_occupation": str | None,
        "father_address": str | None,
        "mother_name": str | None,
        "mother_mobile": str | None,
        "mother_occupation": str | None,
        "mother_address": str | None,
        "credentials": [{"credential": <SMS Credential name>, "date_submitted": str | None}, ...],
        "rfid": str | None,
    }
    """
    guardians = []

    if payload.get("father_name"):
        father = frappe.get_doc({
            "doctype": "Guardian",
            "guardian_name": payload["father_name"],
            "mobile_number": payload.get("father_mobile"),
            "occupation": payload.get("father_occupation"),
            "work_address": payload.get("father_address"),
        })
        father.insert()
        guardians.append({"guardian": father.name, "relation": "Father"})

    if payload.get("mother_name"):
        mother = frappe.get_doc({
            "doctype": "Guardian",
            "guardian_name": payload["mother_name"],
            "mobile_number": payload.get("mother_mobile"),
            "occupation": payload.get("mother_occupation"),
            "work_address": payload.get("mother_address"),
        })
        mother.insert()
        guardians.append({"guardian": mother.name, "relation": "Mother"})

    student_fields = dict(payload.get("student") or {})
    student_fields["doctype"] = "Student"
    student_fields["guardians"] = guardians
    student_fields["credentials"] = [
        {"credential": row["credential"], "date_submitted": row.get("date_submitted")}
        for row in (payload.get("credentials") or [])
    ]

    student = frappe.get_doc(student_fields)
    student.insert()

    if payload.get("rfid"):
        frappe.get_doc({
            "doctype": "SMS Student RFID Tag",
            "student": student.name,
            "rfid": payload["rfid"],
        }).insert()

    return {"name": student.name}


def _subject_row(course: str, student: str) -> dict:
	course_doc = frappe.get_cached_doc("Course", course)
	check = check_prerequisites(student, course)
	return {
		"subject": course,
		"subject_name": course_doc.course_name,
		"subject_code": course_doc.subject_code,
		"unit": course_doc.unit,
		"prerequisite_met": 1 if check["ok"] else 0,
	}


def _pre_enrollment_response(doc, auto_enrollment: dict | None = None) -> dict:
	return {
		"name": doc.name,
		"student": doc.student,
		"student_name": doc.student_name,
		"program": doc.program,
		"academic_year": doc.academic_year,
		"semester": doc.semester,
		"year_level": doc.year_level,
		"status": doc.status,
		"total_units": doc.total_units,
		"subjects": [
			{
				"subject": r.subject,
				"subject_name": r.subject_name,
				"subject_code": r.subject_code,
				"unit": r.unit,
				"prerequisite_met": bool(r.prerequisite_met),
			}
			for r in doc.subjects
		],
		"auto_enrollment": auto_enrollment,
	}


@frappe.whitelist()
def get_or_create_pre_enrollment(
	student: str, program: str, academic_year: str, semester: int, year_level: int
) -> dict:
	"""Get-or-create a student's Pre-Enrollment (Subject Listing) for one term.

	Lookup key is (student, academic_year, semester) only — year_level is
	stored on the record but deliberately excluded from the lookup, since a
	returning student's Program Enrollment year_level can drift after a Pre
	Enrollment was already saved for that term; keying on it too would just
	spawn a second, competing record instead of resuming the first one.

	Only ever derives a fresh curriculum-based subject listing on first
	creation. An already-existing record's subjects (as last edited via
	save_pre_enrollment) are returned as-is and never silently regenerated —
	otherwise a registrar's manual add/remove edits would be discarded every
	time this same term is reopened.
	"""
	existing = frappe.get_all(
		"SMS Pre Enrollment",
		filters={"student": student, "academic_year": academic_year, "semester": semester},
		limit=1,
	)
	if existing:
		return _pre_enrollment_response(frappe.get_doc("SMS Pre Enrollment", existing[0].name))

	curriculum = frappe.get_all(
		"SMS Curriculum",
		filters={"course": program, "is_active": 1},
		limit=1,
	)
	if not curriculum:
		frappe.throw(_("No active curriculum found for program {0}.").format(program))

	curriculum_doc = frappe.get_doc("SMS Curriculum", curriculum[0].name)
	subject_rows = [
		row for row in curriculum_doc.subjects
		if row.year_level == year_level and row.semester == semester
	]

	student_doc = frappe.get_doc("Student", student)
	# Built as plain dicts first, rather than reading them back off doc.subjects
	# after construction — frappe.get_doc() doesn't reliably convert a table
	# field's list-of-dicts into child Documents until after insert/save, so
	# total_units is summed from this list directly instead of relying on
	# attribute access against not-yet-converted rows.
	subject_dicts = [_subject_row(row.subject, student) for row in subject_rows]

	doc = frappe.get_doc({
		"doctype": "SMS Pre Enrollment",
		"student": student,
		"student_name": student_doc.student_name,
		"program": program,
		"academic_year": academic_year,
		"semester": semester,
		"year_level": year_level,
		"status": "Subject Listing",
		"total_units": sum(flt(r["unit"]) for r in subject_dicts),
		"subjects": subject_dicts,
	})
	doc.insert(ignore_permissions=frappe.has_permission("SMS Pre Enrollment", "create"))
	return _pre_enrollment_response(doc)


@frappe.whitelist()
def save_pre_enrollment(name: str, subjects: list[dict]) -> dict:
	"""Persist the registrar's edited/checked subject list for an existing
	Pre-Enrollment, then best-effort auto-enroll into whichever already-
	offered class (Student Group) matches each subject — so a registrar who
	already knows the offered sections doesn't have to separately repeat the
	same picks in Add/Remove Subjects. A subject with zero or more than one
	matching offered class is left for that screen instead of guessing;
	already-enrolled subjects (from a prior save) are reported as enrolled
	without re-attempting enroll(), since enroll() itself rejects duplicates.
	"""
	doc = frappe.get_doc("SMS Pre Enrollment", name)
	subject_dicts = [_subject_row(row.get("subject"), doc.student) for row in subjects]
	doc.set("subjects", subject_dicts)
	doc.total_units = sum(flt(r["unit"]) for r in subject_dicts)
	doc.save(ignore_permissions=frappe.has_permission("SMS Pre Enrollment", "write", doc=doc))

	enrolled, skipped, failed = [], [], []
	for row in doc.subjects:
		offered = frappe.get_all(
			"Student Group",
			filters={
				"program": doc.program,
				"academic_year": doc.academic_year,
				"course": row.subject,
				"group_based_on": "Course",
			},
			pluck="name",
		)
		if not offered:
			skipped.append({"subject": row.subject, "reason": _("No offered class found for this subject.")})
			continue
		if len(offered) > 1:
			skipped.append({
				"subject": row.subject,
				"reason": _("Multiple classes offered — choose one in Add/Remove Subjects."),
			})
			continue

		already_enrolled = frappe.get_all(
			"Course Enrollment",
			filters={"student": doc.student, "student_group": offered[0]},
			limit=1,
		)
		if already_enrolled:
			enrolled.append({"subject": row.subject, "student_group": offered[0]})
			continue

		try:
			enroll(doc.student, offered[0])
			enrolled.append({"subject": row.subject, "student_group": offered[0]})
		except Exception as e:
			failed.append({"subject": row.subject, "reason": str(e)})

	return _pre_enrollment_response(doc, {"enrolled": enrolled, "skipped": skipped, "failed": failed})


@frappe.whitelist()
def sync_curriculum_subject_to_pre_enrollments(
	program: str, subject: str, year_level: int, semester: int
) -> dict:
	"""When a new subject is added to a curriculum via Curriculum Offered,
	push it into every student's Pre-Enrollment for this same program/year/
	semester that's still at the Subject Listing stage — not yet assessed,
	so nothing already assessed/registered gets silently reopened. A student
	who prescribed before this subject existed would otherwise never see it
	unless they happened to reopen an unrelated Pre-Enrollment fresh.
	"""
	pre_enrollments = frappe.get_all(
		"SMS Pre Enrollment",
		filters={
			"program": program,
			"year_level": year_level,
			"semester": semester,
			"status": "Subject Listing",
		},
		fields=["name", "student"],
	)

	synced = []
	for row in pre_enrollments:
		doc = frappe.get_doc("SMS Pre Enrollment", row.name)
		existing = [
			{
				"subject": r.subject,
				"subject_name": r.subject_name,
				"subject_code": r.subject_code,
				"unit": r.unit,
				"prerequisite_met": r.prerequisite_met,
			}
			for r in doc.subjects
		]
		if any(r["subject"] == subject for r in existing):
			continue  # already has it — e.g. this ran twice

		subject_dicts = existing + [_subject_row(subject, row.student)]
		doc.set("subjects", subject_dicts)
		doc.total_units = sum(flt(r["unit"]) for r in subject_dicts)
		doc.save(ignore_permissions=frappe.has_permission("SMS Pre Enrollment", "write", doc=doc))
		synced.append(row.student)

	return {"synced": synced}


_DAY_FIELDS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _get_or_create_batch(program: str, section: str, year_level: int) -> str:
	"""Section, on this data model, is represented as a Student Batch Name
	scoped to (program, year_level) — that doctype already carries exactly
	those two fields, so section cohorts reuse it rather than needing a new
	custom field added to Student Group.
	"""
	batch_name = f"{program}-{section}-Y{year_level}"
	if not frappe.db.exists("Student Batch Name", batch_name):
		frappe.get_doc({
			"doctype": "Student Batch Name",
			"batch_name": batch_name,
			"course": program,
			"year_level": year_level,
		}).insert(ignore_permissions=True)
	return batch_name


def _academic_term_name(academic_year: str, semester: int) -> str:
	# Academic Term's own autoname() (education app's academic_term.py)
	# builds the real primary key as "{academic_year} ({term_name})"
	# regardless of what `title` is set to — matching that exact format
	# here is required, not cosmetic: a mismatched guess here previously
	# meant the existence check never found the term that really got
	# created, and every subsequent subject collided trying to recreate it.
	return f"{academic_year} (Semester {semester})"


def _get_or_create_academic_term(academic_year: str, semester: int) -> str:
	"""Semester, similarly, is represented as an Academic Term scoped to
	(academic_year, semester) — Student Group has no semester field of its
	own, but does have academic_term. Term dates are copied from the parent
	Academic Year wholesale since no finer-grained semester date range
	exists anywhere in this data model yet.
	"""
	name = _academic_term_name(academic_year, semester)
	if not frappe.db.exists("Academic Term", name):
		year = frappe.get_doc("Academic Year", academic_year)
		frappe.get_doc({
			"doctype": "Academic Term",
			"academic_year": academic_year,
			"term_name": f"Semester {semester}",
			"term_start_date": year.year_start_date,
			"term_end_date": year.year_end_date,
		}).insert(ignore_permissions=True)
	return name


def _class_row(sg) -> dict:
	course_doc = frappe.get_cached_doc("Course", sg.course) if sg.course else None
	instructor_row = sg.instructors[0] if sg.instructors else None
	return {
		"name": sg.name,
		"student_group_name": sg.student_group_name,
		"course": sg.course,
		"course_name": course_doc.course_name if course_doc else None,
		"subject_code": course_doc.subject_code if course_doc else None,
		"unit": course_doc.unit if course_doc else None,
		"is_nstp_or_ms": bool(course_doc.is_nstp_or_ms) if course_doc else False,
		"max_strength": sg.max_strength,
		"room": sg.room,
		"start_time": str(sg.start_time) if sg.start_time else None,
		"end_time": str(sg.end_time) if sg.end_time else None,
		"days": [d.capitalize() for d in _DAY_FIELDS if sg.get(d)],
		"instructor": instructor_row.instructor if instructor_row else None,
		"instructor_name": instructor_row.instructor_name if instructor_row else None,
	}


@frappe.whitelist()
def list_classes_offered(
	program: str, section: str, academic_year: str, year_level: int, semester: int
) -> list[dict]:
	"""Classes Offered's own list query. Section/year_level resolve to a
	Student Batch Name and semester to an Academic Term (see the two
	_get_or_create_* helpers below) — if neither has been created yet for
	this combination, nothing has been offered here yet, so this returns
	empty rather than creating anything: unlike add_class/prescribe_classes,
	a plain list query must never have side effects.
	"""
	batch_name = f"{program}-{section}-Y{year_level}"
	term_title = _academic_term_name(academic_year, semester)
	if not frappe.db.exists("Student Batch Name", batch_name) or not frappe.db.exists("Academic Term", term_title):
		return []

	groups = frappe.get_all(
		"Student Group",
		filters={
			"program": program,
			"academic_year": academic_year,
			"batch": batch_name,
			"academic_term": term_title,
			"group_based_on": "Course",
		},
		pluck="name",
	)
	return [_class_row(frappe.get_doc("Student Group", name)) for name in groups]


def _create_class(
	program: str, course: str, section: str, academic_year: str, year_level: int, semester: int, max_students: int
) -> str:
	"""Shared by add_class and prescribe_classes. Throws (ValidationError,
	via frappe.throw) if this exact course is already offered for this
	program/section/year/semester — callers decide whether that's a hard
	error (add_class) or just a skip (prescribe_classes, re-run against an
	already-partly-set-up section).
	"""
	batch_name = _get_or_create_batch(program, section, year_level)
	term_title = _get_or_create_academic_term(academic_year, semester)

	existing = frappe.get_all(
		"Student Group",
		filters={
			"program": program,
			"academic_year": academic_year,
			"batch": batch_name,
			"academic_term": term_title,
			"course": course,
			"group_based_on": "Course",
		},
		limit=1,
	)
	if existing:
		frappe.throw(_("{0} is already offered for this section/term.").format(course))

	course_doc = frappe.get_cached_doc("Course", course)
	student_group_name = f"{course_doc.course_name} ({section}) - {academic_year}"
	doc = frappe.get_doc({
		"doctype": "Student Group",
		"student_group_name": student_group_name,
		"program": program,
		"academic_year": academic_year,
		"batch": batch_name,
		"academic_term": term_title,
		"course": course,
		"group_based_on": "Course",
		"max_strength": max_students,
	})
	doc.insert(ignore_permissions=frappe.has_permission("Student Group", "create"))
	return doc.name


@frappe.whitelist()
def add_class(
	program: str,
	course: str,
	section: str,
	academic_year: str,
	year_level: int,
	semester: int,
	max_students: int,
) -> dict:
	"""Add a single class to a section — for electives or extra sections not
	on the curriculum (bulk-prescribing the curriculum itself is
	prescribe_classes).
	"""
	name = _create_class(program, course, section, academic_year, year_level, semester, max_students)
	return {"name": name}


@frappe.whitelist()
def update_class(name: str, course: str, max_strength: int) -> dict:
	doc = frappe.get_doc("Student Group", name)
	if course != doc.course:
		duplicate = frappe.get_all(
			"Student Group",
			filters={
				"program": doc.program,
				"academic_year": doc.academic_year,
				"batch": doc.batch,
				"academic_term": doc.academic_term,
				"course": course,
				"group_based_on": "Course",
				"name": ["!=", name],
			},
			limit=1,
		)
		if duplicate:
			frappe.throw(_("{0} is already offered for this section/term.").format(course))
		doc.course = course
	doc.max_strength = max_strength
	doc.save(ignore_permissions=frappe.has_permission("Student Group", "write", doc=doc))
	return {"name": doc.name}


@frappe.whitelist()
def schedule_class(
	name: str,
	room: str | None,
	start_time: str | None,
	end_time: str | None,
	days: dict,
	instructor: str | None,
) -> dict:
	"""Set a class's room/time/days/instructor in one call, replacing all of
	them wholesale — mirrors enroll()'s own schedule-conflict guard (room and
	instructor double-booking against other classes in the same term), since
	neither Student Group nor the legacy system it replaces ever actually
	enforced this.
	"""
	doc = frappe.get_doc("Student Group", name)
	my_days = {d for d in _DAY_FIELDS if days.get(d)}

	if room and start_time and end_time and my_days:
		others = frappe.get_all(
			"Student Group",
			filters={"academic_term": doc.academic_term, "room": room, "name": ["!=", name]},
			fields=["name", "start_time", "end_time", *_DAY_FIELDS],
		)
		for other in others:
			other_days = {d for d in _DAY_FIELDS if other.get(d)}
			if not (my_days & other_days):
				continue
			if other.start_time and other.end_time and _times_overlap(
				get_time(start_time), get_time(end_time), get_time(other.start_time), get_time(other.end_time)
			):
				frappe.throw(_("Room {0} is already booked at that time on a shared day.").format(room))

	if instructor and start_time and end_time and my_days:
		others = frappe.get_all("Student Group Instructor", filters={"instructor": instructor}, fields=["parent"])
		for other in others:
			if other.parent == name:
				continue
			other_sg = frappe.get_cached_doc("Student Group", other.parent)
			if other_sg.academic_term != doc.academic_term:
				continue
			other_days = {d for d in _DAY_FIELDS if other_sg.get(d)}
			if not (my_days & other_days):
				continue
			if other_sg.start_time and other_sg.end_time and _times_overlap(
				get_time(start_time), get_time(end_time), get_time(other_sg.start_time), get_time(other_sg.end_time)
			):
				frappe.throw(
					_("Instructor is already scheduled at that time on a shared day, in {0}.").format(other.parent)
				)

	doc.room = room
	doc.start_time = start_time
	doc.end_time = end_time
	for d in _DAY_FIELDS:
		doc.set(d, 1 if d in my_days else 0)
	doc.set("instructors", [{"instructor": instructor}] if instructor else [])

	doc.save(ignore_permissions=frappe.has_permission("Student Group", "write", doc=doc))
	return {"name": doc.name}


@frappe.whitelist()
def remove_class(name: str) -> dict:
	if frappe.get_all("Course Enrollment", filters={"student_group": name}, limit=1):
		frappe.throw(_("Cannot remove {0} — students are already enrolled in it.").format(name))
	frappe.delete_doc("Student Group", name, ignore_permissions=frappe.has_permission("Student Group", "delete"))
	return {"name": name}


@frappe.whitelist()
def prescribe_classes(
	program: str,
	curriculum: str,
	section: str,
	academic_year: str,
	year_level: int,
	semester: int,
	max_students: int,
) -> dict:
	"""Bulk-create one class per curriculum subject at this year_level/
	semester, for one section/term — the fast path for setting up a fresh
	section instead of clicking Add New Class once per subject.
	Already-offered subjects are skipped rather than erroring, since
	re-running this against a section that's already partly set up (to pick
	up subjects added to the curriculum afterward) is the whole point of the
	button staying clickable.
	"""
	curriculum_doc = frappe.get_doc("SMS Curriculum", curriculum)
	subject_rows = [
		row for row in curriculum_doc.subjects
		if row.year_level == year_level and row.semester == semester
	]

	created, skipped, failed = [], [], []
	for row in subject_rows:
		try:
			_create_class(program, row.subject, section, academic_year, year_level, semester, max_students)
			created.append(row.subject)
		except frappe.ValidationError:
			skipped.append(row.subject)
		except Exception:
			frappe.db.rollback()
			frappe.log_error(
				title=f"prescribe_classes: {row.subject} failed",
				message=frappe.get_traceback(),
			)
			failed.append(row.subject)

	return {"created": created, "skipped": skipped, "failed": failed}
