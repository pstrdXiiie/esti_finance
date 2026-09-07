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
from frappe.utils import flt


def _find_prerequisite(program: str, course: str) -> str | None:
	"""Looks up course's prerequisite (if any) on program's active SMS
	Curriculum. Extracted so check_prerequisites() (student-scoped, resolves
	program from the student's Program Enrollment first) and
	get_or_create_pre_enrollment()/save_pre_enrollment() (already have
	program in hand) share one lookup instead of reimplementing it."""
	curriculum = frappe.get_all("SMS Curriculum", filters={"course": program, "is_active": 1}, limit=1)
	if not curriculum:
		return None
	curriculum_doc = frappe.get_cached_doc("SMS Curriculum", curriculum[0].name)
	for row in curriculum_doc.subjects:
		if row.subject == course:
			return row.prerequisite
	return None


def _find_curriculum_year_semester(program: str, course: str) -> tuple[int | None, int | None]:
	"""Looks up course's (year_level, semester) on program's active SMS
	Curriculum — same lookup shape as _find_prerequisite, just reading a
	different pair of columns off the same SMS Curriculum Subject row.
	Used by enroll() to derive Course Enrollment.year_level/semester
	automatically at enrollment time (no new manual input needed — a
	course's year/semester placement is already fully defined by the
	curriculum it belongs to), and by the Grades tab's per-student dialog
	to scope "every subject for this one semester" precisely. Returns
	(None, None) if the program has no active curriculum or the course
	isn't on it (e.g. an elective, or a program with no curriculum set up
	yet) — callers treat this as "unknown," not an error.
	"""
	curriculum = frappe.get_all("SMS Curriculum", filters={"course": program, "is_active": 1}, limit=1)
	if not curriculum:
		return None, None
	curriculum_doc = frappe.get_cached_doc("SMS Curriculum", curriculum[0].name)
	for row in curriculum_doc.subjects:
		if row.subject == course:
			return row.year_level, row.semester
	return None, None


def _curriculum_subjects_for(program: str, year_level: int | None, semester: int | None) -> list[str]:
	"""Every subject on program's active SMS Curriculum at this exact
	(year_level, semester) - same lookup shape as _find_prerequisite/
	_find_curriculum_year_semester, just returning the whole bucket instead
	of one course's row. Shared by get_or_create_pre_enrollment (to seed a
	fresh Pre Enrollment's prescribed rows) and get_student_schedule (to
	surface every curriculum subject as addable in available_subjects, not
	only ones some Student Group already happens to be offered for)."""
	if year_level is None or semester is None:
		return []
	curriculum = frappe.get_all("SMS Curriculum", filters={"course": program, "is_active": 1}, limit=1)
	if not curriculum:
		return []
	curriculum_doc = frappe.get_cached_doc("SMS Curriculum", curriculum[0].name)
	return [
		row.subject for row in curriculum_doc.subjects
		if row.year_level == year_level and row.semester == semester
	]


def _prerequisite_check_result(student: str, prerequisite: str | None, settings) -> dict:
	"""{ok, reason} given an already-resolved prerequisite (or None). Shared
	by check_prerequisites() (single subject) and get_or_create_pre_enrollment()
	(bulk, per prescribed subject)."""
	if not prerequisite:
		return {"ok": True, "reason": None}
	prior = frappe.get_all(
		"Course Enrollment",
		filters={"student": student, "course": prerequisite},
		fields=["name", "status", "final_rating", "points"],
	)
	passed = [row for row in prior if row.status == "Completed" and row.final_rating not in ("INC", "DRP", "")]
	if not passed:
		return {"ok": False, "reason": _("Prerequisite {0} has not been completed.").format(prerequisite)}
	if settings.check_prerequisite_grade:
		# Stricter than "passed" (status == Completed, already required above):
		# the prerequisite's raw numeric grade must clear the configured
		# passing_grade threshold, not just whatever line the grading scale
		# happened to mark as passing.
		best_grade = max((flt(row.final_rating) for row in passed if _is_number(row.final_rating)), default=None)
		if best_grade is None or best_grade < flt(settings.passing_grade):
			return {
				"ok": False,
				"reason": _("Prerequisite {0} grade does not meet the required standard ({1}).").format(
					prerequisite, settings.passing_grade
				),
			}
	return {"ok": True, "reason": None}


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

	prerequisite = _find_prerequisite(program_enrollment[0].program, course)
	return _prerequisite_check_result(student, prerequisite, settings)


@frappe.whitelist()
def enroll(student: str, student_group: str) -> dict:
	"""Enroll a student into one class (Student Group). Consolidates the
	legacy's duplicate-enlistment, class-capacity, and schedule-conflict
	checks that used to be re-implemented per form.
	"""
	sg = frappe.get_doc("Student Group", student_group)
	if not sg.course:
		frappe.throw(_("Student Group {0} has no Course set.").format(student_group))

	# 1. Duplicate-enrollment guard. Excludes Dropped rows specifically (not
	# just "status == Enrolled") so a Completed row still correctly blocks
	# re-enrolling into the exact same already-finished class instance, while
	# a Dropped row - the explicit "this no longer counts" signal - does not
	# permanently prevent the student from ever re-adding this class again
	# (found via Add/Remove Subjects: drop a class, try to re-add it, got a
	# false "already enrolled" error).
	existing = frappe.get_all(
		"Course Enrollment",
		filters={"student": student, "student_group": student_group, "status": ["!=", "Dropped"]},
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
				# status="Enrolled" only - a Dropped/Completed row is no longer
				# an actual time-slot commitment and must not block a new one
				# (found via Add/Remove Subjects: drop a class, immediately add
				# a different one at the same slot - was throwing a false
				# conflict against the just-dropped row).
				filters={"student": student, "status": "Enrolled"},
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

	year_level, semester = _find_curriculum_year_semester(sg.program, sg.course) if sg.program else (None, None)

	# Education's own Course Enrollment.validate_duplication() blocks a second
	# row for the same (student, course, program_enrollment) regardless of
	# status - so a subject dropped earlier this same program enrollment can
	# never get a fresh row inserted, even into a different Student Group
	# section, despite guard #1 above deliberately letting a Dropped row
	# through (found via live testing: dropping a prescribed subject and
	# trying to re-add it - even the exact same one auto_enroll_prescribed_
	# subjects would retry - failed with a false "already enrolled" error
	# from the base doctype, not this file's own guard). Reactivating the
	# dropped row in place instead of inserting a new one sidesteps that
	# constraint entirely - same "reuse, don't duplicate" shape as
	# credit_transfer's own handling of the identical constraint. Grading
	# fields reset to blank, matching what a genuinely fresh enrollment
	# would look like, so a previous attempt's grades don't linger.
	# enrollment_date is deliberately left untouched - the base doctype marks
	# it reqd + set_only_once, so reassigning it here would throw on save for
	# any reactivation that doesn't happen to fall on the original enrollment
	# date (i.e. nearly always in practice).
	dropped = frappe.db.exists(
		"Course Enrollment",
		{"student": student, "course": sg.course, "program_enrollment": program_enrollment[0], "status": "Dropped"},
	)
	if dropped:
		doc = frappe.get_doc("Course Enrollment", dropped)
		doc.student_group = student_group
		doc.program = sg.program
		doc.status = "Enrolled"
		doc.year_level = year_level
		doc.semester = semester
		doc.prelim = None
		doc.midterm = None
		doc.final = None
		doc.re_exam = None
		doc.final_rating = None
		doc.grade_remarks = None
		doc.points = None
		doc.save(ignore_permissions=frappe.has_permission("Course Enrollment", "write", doc=doc))
		return {"name": doc.name}

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
			"year_level": year_level,
			"semester": semester,
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


def _missing_curriculum_subjects(student: str, program: str) -> list[str]:
	"""Required subjects (from every is_active SMS Curriculum on this program)
	the student has not completed. A soft signal only — see
	compute_graduation_candidates' docstring — so a program with no
	curriculum on file simply reports nothing missing rather than blocking
	anything."""
	curricula = frappe.get_all("SMS Curriculum", filters={"course": program, "is_active": 1}, pluck="name")
	if not curricula:
		return []

	required = set()
	for curriculum in curricula:
		doc = frappe.get_cached_doc("SMS Curriculum", curriculum)
		required.update(row.subject for row in doc.subjects)
	if not required:
		return []

	completed = set(
		frappe.get_all(
			"Course Enrollment",
			filters={"student": student, "course": ["in", list(required)], "status": "Completed"},
			pluck="course",
		)
	)
	return sorted(required - completed)


@frappe.whitelist()
def compute_graduation_candidates(program: str, school_year: str) -> dict:
	"""Read-only signal generator — recomputed and re-savable any time,
	replacing the legacy's blind "no next-year enrollment = graduated"
	auto-inference with an explicit, re-runnable computation that never
	writes Student.graduated itself (blueprint §7 R-17: legacy graduation
	status had no audit trail and may have mis-marked transferred-out or
	dropped-out students as graduates).

	Two independent signals are computed per candidate: did_not_reenroll_next_year
	(persisted on the SMS Graduation Batch's own child row, since re-running
	should not forget a previously-detected candidate) and curriculum
	completion (recomputed live every time, never persisted — a corrected
	grade should show up the next time this is viewed, not stay frozen at
	generation time). Per the Q16 policy decision, curriculum completion is
	a soft signal shown to the registrar, not a hard gate — approve_graduation()
	does not check it.

	Re-running for the same (program, school_year) refreshes the candidate
	list without touching any row a registrar has already approved (same
	"recompute eligibility, never delete history" shape as
	generate_permit_batch).
	"""
	academic_year = frappe.get_doc("Academic Year", school_year)

	later_years = frappe.get_all(
		"Academic Year", filters={"year_start_date": [">", academic_year.year_start_date]}, pluck="name"
	)

	enrolled_this_year = frappe.get_all(
		"Program Enrollment", filters={"program": program, "academic_year": school_year}, pluck="student"
	)

	candidate_students = []
	for student in enrolled_this_year:
		if frappe.db.get_value("Student", student, "sms_status") != "Active":
			continue
		if later_years and frappe.db.exists(
			"Program Enrollment",
			{"student": student, "program": program, "academic_year": ["in", later_years]},
		):
			continue
		candidate_students.append(student)

	batch_name = frappe.db.exists("SMS Graduation Batch", {"course": program, "school_year": school_year})
	if not candidate_students and not batch_name:
		return {"graduation_batch": None, "candidates": []}

	if batch_name:
		batch = frappe.get_doc("SMS Graduation Batch", batch_name)
	else:
		batch = frappe.get_doc(
			{"doctype": "SMS Graduation Batch", "course": program, "school_year": school_year, "candidates": []}
		)

	batch.run_by = frappe.session.user
	batch.run_on = frappe.utils.now()
	existing_students = {row.student for row in batch.candidates}
	for student in candidate_students:
		if student not in existing_students:
			batch.append("candidates", {"student": student, "did_not_reenroll_next_year": 1})

	if batch_name:
		batch.save(ignore_permissions=frappe.has_permission("SMS Graduation Batch", "write", doc=batch))
	else:
		batch.insert(ignore_permissions=frappe.has_permission("SMS Graduation Batch", "create"))

	return {
		"graduation_batch": batch.name,
		"candidates": [
			{
				"student": row.student,
				"did_not_reenroll_next_year": row.did_not_reenroll_next_year,
				"approved": row.approved,
				"missing_subjects": _missing_curriculum_subjects(row.student, program),
			}
			for row in batch.candidates
		],
	}


@frappe.whitelist()
def get_graduation_batch(graduation_batch: str) -> dict:
	"""Read helper backing the graduation-review screen: the batch's own
	persisted candidate rows plus a freshly-recomputed curriculum-completion
	signal per student (never persisted — see compute_graduation_candidates)."""
	batch = frappe.get_doc("SMS Graduation Batch", graduation_batch)
	return {
		"name": batch.name,
		"program": batch.course,
		"school_year": batch.school_year,
		"run_on": batch.run_on,
		"candidates": [
			{
				"student": row.student,
				"student_name": frappe.db.get_value("Student", row.student, "student_name"),
				"did_not_reenroll_next_year": row.did_not_reenroll_next_year,
				"approved": row.approved,
				"approved_by": row.approved_by,
				"approved_on": row.approved_on,
				"missing_subjects": _missing_curriculum_subjects(row.student, batch.course),
			}
			for row in batch.candidates
		],
	}


@frappe.whitelist()
def approve_graduation(graduation_batch: str, student: str) -> dict:
	"""The only path that writes Student.graduated — keeping this the sole
	writer, with approver + timestamp captured on the batch's own child row,
	is what closes the legacy's R-17 audit-trail gap. Does not block on
	curriculum completion (a soft signal only, per the Q16 decision) — the
	frontend shows any missing subjects before this is called, so an
	approval with subjects missing is a conscious registrar override, not a
	hidden one."""
	batch = frappe.get_doc("SMS Graduation Batch", graduation_batch)
	candidate = next((row for row in batch.candidates if row.student == student), None)
	if not candidate:
		frappe.throw(_("{0} is not a candidate in graduation batch {1}.").format(student, graduation_batch))
	if candidate.approved:
		frappe.throw(_("{0} has already been approved for graduation in this batch.").format(student))

	candidate.approved = 1
	candidate.approved_by = frappe.session.user
	candidate.approved_on = frappe.utils.now()
	candidate.year_graduated = batch.school_year
	batch.save(ignore_permissions=frappe.has_permission("SMS Graduation Batch", "write", doc=batch))

	academic_year = frappe.get_doc("Academic Year", batch.school_year)
	frappe.db.set_value(
		"Student",
		student,
		{"graduated": 1, "year_graduated": academic_year.year_end_date.year, "sms_status": "Graduated"},
	)
	return {"student": student, "graduated": 1}


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
def list_grades(
	academic_year: str | None = None,
	program: str | None = None,
	only_inactive_students: bool = False,
	student: str | None = None,
	semester: int | None = None,
	year_level: int | None = None,
) -> list[dict]:
	"""Read-only grade listing backing four reporting screens - All Grades,
	Old Student Grades, the "view this student's full grade history"
	dialog opened by clicking a name in either of those tables (student
	alone, deliberately no other filter, so it's genuinely their FULL
	history across every term), and that same dialog's "just this one
	semester" scope (student + semester + year_level together, once the
	registrar has picked a specific row to drill into) - that differ only
	in which filters they apply. One function, four call sites, per this
	file's own compose-don't-duplicate convention (see check_prerequisites/
	_find_prerequisite for the same shape elsewhere in this file). Pure
	reporting - grade entry/computation stays the sole responsibility of
	enroll()/drop_enrollment()/compute_grade_points(); nothing here writes.
	"""
	ce_filters: dict = {}

	if academic_year or program:
		pe_filters = {}
		if academic_year:
			pe_filters["academic_year"] = academic_year
		if program:
			pe_filters["program"] = program
		program_enrollments = frappe.get_all("Program Enrollment", filters=pe_filters, pluck="name")
		if not program_enrollments:
			return []
		ce_filters["program_enrollment"] = ["in", program_enrollments]

	if only_inactive_students:
		inactive_students = frappe.get_all("Student", filters={"sms_status": ["!=", "Active"]}, pluck="name")
		if not inactive_students:
			return []
		ce_filters["student"] = ["in", inactive_students]

	if student:
		ce_filters["student"] = student

	if semester is not None:
		ce_filters["semester"] = semester

	if year_level is not None:
		ce_filters["year_level"] = year_level

	rows = frappe.get_all(
		"Course Enrollment",
		filters=ce_filters,
		fields=[
			"name", "student", "student_name", "course", "program", "program_enrollment",
			"student_group", "prelim", "midterm", "final", "final_rating", "grade_remarks",
			"points", "status", "year_level", "semester",
		],
		order_by="student_name asc",
	)
	if not rows:
		return []

	# Batch-enrich rather than a frappe.db.get_value per row - Old Student
	# Grades in particular can return a large result set.
	course_names = list({r.course for r in rows if r.course})
	course_map = {
		c.name: c
		for c in frappe.get_all(
			"Course", filters={"name": ["in", course_names]}, fields=["name", "course_name", "subject_code"]
		)
	} if course_names else {}

	pe_names = list({r.program_enrollment for r in rows if r.program_enrollment})
	pe_map = {
		p.name: p
		for p in frappe.get_all(
			"Program Enrollment", filters={"name": ["in", pe_names]}, fields=["name", "academic_year", "academic_term"]
		)
	} if pe_names else {}

	student_names = list({r.student for r in rows if r.student})
	student_map = {
		s.name: s
		for s in frappe.get_all(
			"Student", filters={"name": ["in", student_names]}, fields=["name", "sms_status", "stdnt_cno"]
		)
	} if student_names else {}

	result = []
	for r in rows:
		course = course_map.get(r.course)
		pe = pe_map.get(r.program_enrollment)
		student = student_map.get(r.student)
		result.append({
			**r,
			"course_name": course.course_name if course else None,
			"subject_code": course.subject_code if course else None,
			"academic_year": pe.academic_year if pe else None,
			"academic_term": pe.academic_term if pe else None,
			"student_status": student.sms_status if student else None,
			"stdnt_cno": student.stdnt_cno if student else None,
		})
	return result


def _pre_enrollment_response(doc) -> dict:
	"""Read shape shared by get_or_create_pre_enrollment/save_pre_enrollment/
	get_pre_enrollment. student_name/subject_name/subject_code are computed
	live here, never stored on the doctype - same posture as
	get_graduation_batch's student_name."""
	return {
		"name": doc.name,
		"student": doc.student,
		"student_name": frappe.db.get_value("Student", doc.student, "student_name"),
		"program": doc.program,
		"academic_year": doc.academic_year,
		"semester": doc.semester,
		"year_level": doc.year_level,
		"status": doc.status,
		"total_units": doc.total_units,
		"subjects": [
			{
				"subject": row.subject,
				"subject_name": frappe.db.get_value("Course", row.subject, "course_name"),
				"subject_code": frappe.db.get_value("Course", row.subject, "subject_code"),
				"unit": row.unit,
				"prerequisite_met": row.prerequisite_met,
			}
			for row in doc.subjects
		],
	}


@frappe.whitelist()
def get_pre_enrollment(name: str) -> dict:
	return _pre_enrollment_response(frappe.get_doc("SMS Pre Enrollment", name))


@frappe.whitelist()
def get_or_create_pre_enrollment(
	student: str, program: str, academic_year: str, semester: int, year_level: int
) -> dict:
	"""Find-or-create, same shape as compute_graduation_candidates: one
	SMS Pre Enrollment per (student, academic_year, semester), enforced by
	lookup-then-reuse rather than a doctype-level uniqueness validate().
	Re-running never resets a draft already being edited; it only seeds
	prescribed-subject rows the first time this is called for the term."""
	existing = frappe.db.exists(
		"SMS Pre Enrollment",
		{"student": student, "academic_year": academic_year, "semester": semester},
	)
	if existing:
		return get_pre_enrollment(existing)

	settings = frappe.get_cached_doc("Education Settings")
	prescribed = _curriculum_subjects_for(program, year_level, semester)

	completed = set(
		frappe.get_all(
			"Course Enrollment",
			filters={"student": student, "course": ["in", prescribed or [""]], "status": "Completed"},
			pluck="course",
		)
	)

	doc = frappe.get_doc({
		"doctype": "SMS Pre Enrollment",
		"student": student,
		"program": program,
		"academic_year": academic_year,
		"semester": semester,
		"year_level": year_level,
		"status": "Subject Listing",
	})
	total_units = 0.0
	for subject in prescribed:
		if subject in completed:
			continue
		prerequisite = _find_prerequisite(program, subject)
		check = _prerequisite_check_result(student, prerequisite, settings)
		unit = flt(frappe.db.get_value("Course", subject, "unit"))
		total_units += unit
		doc.append("subjects", {"subject": subject, "unit": unit, "prerequisite_met": 1 if check["ok"] else 0})
	doc.total_units = total_units
	doc.insert()
	return _pre_enrollment_response(doc)


@frappe.whitelist()
def save_pre_enrollment(name: str, subjects: list) -> dict:
	"""Overwrites the child table with the registrar's edited subject list.
	Never trusts client-sent unit/prerequisite_met - both are recomputed
	server-side from Course and the student's Course Enrollment history.

	This is the point the registrar has actually reviewed and finalized the
	prescribed listing (Subject Listing's checkboxes/Add Subject/remove-row
	controls all write to local state until this Save) - not the earlier
	get_or_create_pre_enrollment call that just seeds the curriculum-derived
	default, before any of that review happens. So this is also the point
	the student's schedule should populate itself: auto_enroll_prescribed_
	subjects() enrolls them into every listed subject's offered Student
	Group, same as it does again (idempotently - already-enrolled subjects
	are just skipped) once save_assessment() reaches Registration, so a
	subject added or a class newly offered between the two still gets
	picked up.
	"""
	doc = frappe.get_doc("SMS Pre Enrollment", name)
	settings = frappe.get_cached_doc("Education Settings")
	doc.subjects = []
	total_units = 0.0
	for row in subjects:
		subject = row["subject"]
		unit = flt(frappe.db.get_value("Course", subject, "unit"))
		prerequisite = _find_prerequisite(doc.program, subject)
		check = _prerequisite_check_result(doc.student, prerequisite, settings)
		total_units += unit
		doc.append("subjects", {"subject": subject, "unit": unit, "prerequisite_met": 1 if check["ok"] else 0})
	doc.total_units = total_units
	doc.save()
	auto_enrollment = auto_enroll_prescribed_subjects(doc.name)
	return {**_pre_enrollment_response(doc), "auto_enrollment": auto_enrollment}


@frappe.whitelist()
def sync_curriculum_subject_to_pre_enrollments(program: str, subject: str, year_level: int, semester: int) -> dict:
	"""Propagates a curriculum change forward: when a subject is added to a
	program's curriculum at a given (year_level, semester) - see Curriculum
	Offered's Save Subject - every student already pre-enrolled for that
	same program/year_level/semester gets the new subject added to their own
	prescribed listing too, if it isn't there already, rather than staying
	stuck with whatever the curriculum looked like at the moment their
	listing was first generated (get_or_create_pre_enrollment's own
	find-or-create shape means a later curriculum edit never revisits an
	already-created record on its own).

	Reaches every status, not only Subject Listing - a student already past
	Assessment/Registration has an Assessment that computed tuition off the
	old (lower) total_units, so this also runs finance_billing.
	reassess_for_updated_units() per synced record: cancel + amend the
	submitted Assessment, recomputing tuition off the now-larger
	total_units and re-posting GL entries, re-pointing any already-recorded
	Payment Entry to the amended document (see that function's own
	docstring for the full mechanism and why it's not a simple field edit).
	A lazy import, not a top-of-file one - finance_billing already imports
	from this module (auto_enroll_prescribed_subjects), so importing it
	back at module load time would be circular.

	Excludes a student who's already Completed this exact subject (matching
	get_or_create_pre_enrollment's own completed-subject exclusion) - an
	unlikely case for a genuinely new subject, but keeps this consistent
	with that seeding logic for a re-added-then-removed-then-re-added one.
	"""
	from campus_erp.api.finance_billing import reassess_for_updated_units

	settings = frappe.get_cached_doc("Education Settings")
	prerequisite = _find_prerequisite(program, subject)
	unit = flt(frappe.db.get_value("Course", subject, "unit"))

	completed_students = set(
		frappe.get_all("Course Enrollment", filters={"course": subject, "status": "Completed"}, pluck="student")
	)

	pre_enrollments = frappe.get_all(
		"SMS Pre Enrollment",
		filters={"program": program, "year_level": year_level, "semester": semester},
		pluck="name",
	)

	synced = []
	reassessed = []
	for name in pre_enrollments:
		doc = frappe.get_doc("SMS Pre Enrollment", name)
		if doc.student in completed_students:
			continue
		if any(row.subject == subject for row in doc.subjects):
			continue
		check = _prerequisite_check_result(doc.student, prerequisite, settings)
		doc.append("subjects", {"subject": subject, "unit": unit, "prerequisite_met": 1 if check["ok"] else 0})
		doc.total_units = flt(doc.total_units) + unit
		doc.save(ignore_permissions=frappe.has_permission("SMS Pre Enrollment", "write", doc=doc))
		synced.append(name)

		if doc.status != "Subject Listing":
			result = reassess_for_updated_units(doc.name)
			if result:
				reassessed.append(result)

	return {"synced": synced, "reassessed": reassessed}


def _offered_student_group_filters(
	program: str, academic_year: str, academic_term: str | None,
	year_level: int | None, semester: int | None, course: str | None = None,
) -> dict:
	"""Shared Student Group filter shape for 'what's offered this term for
	this student' - used both to pick the single section
	auto_enroll_prescribed_subjects() enrolls into and to list every
	offered subject (prescribed or not) get_student_schedule surfaces as
	addable. Same one-section-per-subject-per-term assumption the
	Add/Remove Subjects screen already relies on; course narrows to one
	subject when picking a section, omitted when listing everything on
	offer."""
	filters: dict = {"program": program, "academic_year": academic_year, "disabled": 0}
	if academic_term:
		filters["academic_term"] = academic_term
	if year_level is not None:
		filters["year_level"] = year_level
	if semester is not None:
		filters["semester"] = semester
	if course:
		filters["course"] = course
	return filters


def _find_offered_student_group(
	program: str, academic_year: str, academic_term: str | None,
	year_level: int | None, semester: int | None, course: str,
) -> str | None:
	matches = frappe.get_all(
		"Student Group",
		filters=_offered_student_group_filters(program, academic_year, academic_term, year_level, semester, course),
		order_by="name asc",
		limit=1,
		pluck="name",
	)
	return matches[0] if matches else None


@frappe.whitelist()
def get_student_schedule(student: str) -> dict:
	"""Current-term schedule for the Add/Remove Subjects screen: the
	student's active (status=Enrolled) Course Enrollment rows, scoped to
	the academic year/term of their most recent Program Enrollment (Course
	Enrollment itself carries no term field of its own), joined with each
	row's Student Group for display (section name, days, time, room).
	Also returns the resolved academic_year/academic_term/program/year_level/
	semester and the student's prescribed_subjects (the subject rows listed
	on their most recent SMS Pre Enrollment for this academic_year, with the
	same prerequisite_met flag computed there - Program Enrollment carries
	no semester field of its own, so Pre Enrollment is the source for it)
	so the frontend can render one row per prescribed subject - each showing
	whether it's already on the schedule or still needs to be added - scoped
	to the same term, without a second round trip to figure any of that out
	itself.

	Also returns available_subjects: every subject on this program's active
	curriculum for the student's own year_level/semester, plus any Student
	Group actually offered this term outside the curriculum entirely (a true
	ad-hoc elective/extra section) - excluding anything the student is
	already enrolled in - each flagged is_prescribed. This is what backs
	Add/Remove Subjects' "Add Subjects" table: a subject already added to
	the curriculum shows up here (student_group None, "not yet offered")
	even before a class section exists for it, same as any prescribed
	subject auto_enroll_prescribed_subjects itself skipped (not yet
	offered, over capacity, prerequisite) - it isn't a dead end just because
	no Student Group happens to exist for it yet.

	Course Enrollment rows with no student_group set (an optional field)
	are skipped - there is no schedule to show for them, and they play no
	part in this screen's add/drop/conflict logic either.
	"""
	program_enrollment = frappe.get_all(
		"Program Enrollment",
		filters={"student": student},
		fields=["academic_year", "academic_term", "program"],
		order_by="creation desc",
		limit=1,
	)
	if not program_enrollment:
		return {
			"academic_year": None, "academic_term": None, "program": None,
			"year_level": None, "semester": None, "prescribed_subjects": [],
			"enrollments": [],
		}

	academic_year = program_enrollment[0].academic_year
	academic_term = program_enrollment[0].academic_term
	program = program_enrollment[0].program

	pre_enrollment = frappe.get_all(
		"SMS Pre Enrollment",
		filters={"student": student, "academic_year": academic_year},
		fields=["name", "year_level", "semester"],
		order_by="creation desc",
		limit=1,
	)
	year_level = pre_enrollment[0].year_level if pre_enrollment else None
	semester = pre_enrollment[0].semester if pre_enrollment else None
	prescribed_subjects = []
	if pre_enrollment:
		for row in frappe.get_all(
			"SMS Pre Enrollment Subject",
			filters={"parent": pre_enrollment[0].name},
			fields=["subject", "unit", "prerequisite_met"],
		):
			prescribed_subjects.append({
				"subject": row.subject,
				"subject_name": frappe.db.get_value("Course", row.subject, "course_name"),
				"subject_code": frappe.db.get_value("Course", row.subject, "subject_code"),
				"unit": flt(row.unit),
				"prerequisite_met": row.prerequisite_met,
			})

	rows = frappe.get_all(
		"Course Enrollment",
		filters={"student": student, "status": "Enrolled"},
		fields=["name", "course", "student_group"],
	)

	day_fields = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
	enrollments = []
	for row in rows:
		if not row.student_group:
			continue
		sg = frappe.get_cached_doc("Student Group", row.student_group)
		if sg.academic_year != academic_year:
			continue
		if academic_term and sg.academic_term != academic_term:
			continue
		enrollments.append({
			"name": row.name,
			"course": row.course,
			"course_name": frappe.db.get_value("Course", row.course, "course_name"),
			"student_group": row.student_group,
			"student_group_name": sg.student_group_name,
			"days": [d.capitalize() for d in day_fields if sg.get(d)],
			"start_time": str(sg.start_time) if sg.start_time else None,
			"end_time": str(sg.end_time) if sg.end_time else None,
			"room": sg.room,
		})

	enrolled_courses = {row.course for row in rows}
	prescribed_courses = {row["subject"] for row in prescribed_subjects}

	available_subjects = []
	if program:
		settings = frappe.get_cached_doc("Education Settings")
		offered = frappe.get_all(
			"Student Group",
			filters=_offered_student_group_filters(program, academic_year, academic_term, year_level, semester),
			fields=["name", "student_group_name", "course", "room", "start_time", "end_time", *day_fields],
			order_by="name asc",
		)
		# First offered section per course - same one-section-per-subject-
		# per-term assumption _find_offered_student_group's own picker uses.
		offered_by_course = {}
		for sg in offered:
			if sg.course and sg.course not in offered_by_course:
				offered_by_course[sg.course] = sg

		# Candidates are every subject on this program's curriculum for the
		# student's own year_level/semester - so a subject just added to the
		# curriculum shows up here (as "not yet offered") even before a
		# Student Group/class section exists for it, the same way the
		# Prescribed Subjects table's own fallback Add already handles a
		# prescribed subject auto-enroll couldn't place - plus any Student
		# Group actually offered this term for a course outside the
		# curriculum entirely (a true ad-hoc elective/extra section).
		curriculum_courses = _curriculum_subjects_for(program, year_level, semester)
		candidate_courses = list(dict.fromkeys([*curriculum_courses, *offered_by_course.keys()]))
		candidate_courses = [c for c in candidate_courses if c not in enrolled_courses]

		# Batch-fetch Course fields rather than a get_value per row - same
		# reasoning as list_grades' own course_map (a term with many
		# candidate subjects would otherwise turn this into an N+1).
		course_map = {
			c.name: c
			for c in frappe.get_all(
				"Course", filters={"name": ["in", candidate_courses]}, fields=["name", "course_name", "subject_code", "unit"]
			)
		} if candidate_courses else {}

		for course_name in candidate_courses:
			is_prescribed = course_name in prescribed_courses
			if is_prescribed:
				prerequisite_met = next(
					(s["prerequisite_met"] for s in prescribed_subjects if s["subject"] == course_name), True
				)
			else:
				prerequisite = _find_prerequisite(program, course_name)
				prerequisite_met = _prerequisite_check_result(student, prerequisite, settings)["ok"]
			course = course_map.get(course_name)
			sg = offered_by_course.get(course_name)
			available_subjects.append({
				"course": course_name,
				"course_name": course.course_name if course else None,
				"subject_code": course.subject_code if course else None,
				"unit": flt(course.unit) if course else 0.0,
				"student_group": sg.name if sg else None,
				"student_group_name": sg.student_group_name if sg else None,
				"days": [d.capitalize() for d in day_fields if sg.get(d)] if sg else [],
				"start_time": str(sg.start_time) if sg and sg.start_time else None,
				"end_time": str(sg.end_time) if sg and sg.end_time else None,
				"room": sg.room if sg else None,
				"is_prescribed": is_prescribed,
				"prerequisite_met": prerequisite_met,
			})

	return {
		"academic_year": academic_year,
		"academic_term": academic_term,
		"program": program,
		"year_level": year_level,
		"semester": semester,
		"prescribed_subjects": prescribed_subjects,
		"enrollments": enrollments,
		"available_subjects": available_subjects,
	}


@frappe.whitelist()
def auto_enroll_prescribed_subjects(pre_enrollment: str) -> dict:
	"""Enrolls a student into the offered Student Group for every subject on
	their SMS Pre Enrollment - run automatically once Registration is
	confirmed (see finance_billing.save_assessment) so a registered
	student's schedule is populated without a separate manual trip through
	Add/Remove Subjects for every prescribed subject. A subject the student
	is already enrolled in, one with no offered Student Group yet, or one
	that fails enroll()'s own prerequisite/capacity/schedule-conflict checks
	is skipped rather than aborting the batch - same per-row try/except
	shape as prescribe_classes, since one bad subject must not block the
	rest of the student's schedule. Add/Remove Subjects remains the way to
	handle anything this skips, plus anything outside the prescribed list
	entirely (electives, retakes).
	"""
	doc = frappe.get_doc("SMS Pre Enrollment", pre_enrollment)

	# Scoped to this Pre Enrollment's own program/academic_year - not just
	# "whichever Program Enrollment is most recent" - so a student with more
	# than one Program Enrollment on file (re-enrolled in a later term, a
	# program shift) can't have this pick a mismatched academic_term for a
	# program/year this Pre Enrollment doesn't actually belong to.
	program_enrollment = frappe.get_all(
		"Program Enrollment",
		filters={"student": doc.student, "program": doc.program, "academic_year": doc.academic_year},
		fields=["academic_term"],
		order_by="creation desc",
		limit=1,
	)
	academic_term = program_enrollment[0].academic_term if program_enrollment else None

	enrolled = []
	skipped = []
	failed = []
	for row in doc.subjects:
		if frappe.db.exists(
			"Course Enrollment",
			{"student": doc.student, "course": row.subject, "status": ["!=", "Dropped"]},
		):
			skipped.append({"subject": row.subject, "reason": "Already enrolled"})
			continue

		student_group = _find_offered_student_group(
			doc.program, doc.academic_year, academic_term, doc.year_level, doc.semester, row.subject
		)
		if not student_group:
			skipped.append({"subject": row.subject, "reason": "Not yet offered"})
			continue

		try:
			enroll(doc.student, student_group)
			enrolled.append({"subject": row.subject, "student_group": student_group})
		except Exception as e:
			frappe.log_error(title="auto_enroll_prescribed_subjects: row failed", message=frappe.get_traceback())
			failed.append({"subject": row.subject, "reason": str(e)})

	return {"enrolled": enrolled, "skipped": skipped, "failed": failed}


@frappe.whitelist()
def withdraw_enrollment(student: str) -> dict:
	"""Bulk-drop every one of the student's active (status=Enrolled) Course
	Enrollment rows for the CURRENT TERM ONLY (same term-scoping as
	get_student_schedule, derived from the student's most recent Program
	Enrollment) - a per-term action, not a permanent record change, per an
	explicit product decision: Student.sms_status is deliberately left
	untouched (the student can still re-enroll in a future term), and
	Program Enrollment itself is not marked in any way (it has no status
	field in this schema). No reason/date is captured - also an explicit
	decision to keep this simple, matching drop_enrollment's own existing
	scope elsewhere in this file.

	Reuses get_student_schedule (to find what's currently active) and
	drop_enrollment (to actually drop each row) rather than reimplementing
	either - this function's only job is the bulk/loop wrapping.
	"""
	schedule = get_student_schedule(student)
	dropped = []
	for row in schedule["enrollments"]:
		result = drop_enrollment(row["name"])
		dropped.append({**result, "course": row["course"], "course_name": row["course_name"]})
	return {"withdrawn_count": len(dropped), "dropped": dropped}


@frappe.whitelist()
def list_pre_enrollments(student: str) -> list[dict]:
	"""Read-only history for the Pre-Registration Record screen: every
	SMS Pre Enrollment on file for this student, most recent first, each
	returned via the same _pre_enrollment_response shape Pre-Enrollment
	itself uses (subjects/total_units/status included). Pure read, no
	writes - this screen never edits or advances a record, only displays
	what Pre-Enrollment already produced. No printing/PDF either, per the
	project's Q15 policy decision (2026-08-19: no Print Format work for
	any module until a real need surfaces).
	"""
	names = frappe.get_all(
		"SMS Pre Enrollment", filters={"student": student}, order_by="creation desc", pluck="name"
	)
	return [_pre_enrollment_response(frappe.get_doc("SMS Pre Enrollment", name)) for name in names]


@frappe.whitelist()
def get_transfer_evaluation(student: str) -> dict:
	"""Everything the Transferee Evaluation screen needs in one call: the
	student's prior-school records (SMS Transferee Grade), and every subject
	in their program's active curriculum (across ALL year levels/semesters,
	not just one term - this is a full-curriculum checklist, unlike
	Pre-Enrollment's single-term view), each flagged with whether it's
	already completed (a real Course Enrollment with status=Completed) or
	already credited (an SMS Credit row exists) or neither.
	"""
	program_enrollment = frappe.get_all(
		"Program Enrollment", filters={"student": student}, fields=["name", "program"],
		order_by="creation desc", limit=1,
	)
	if not program_enrollment:
		return {"program": None, "prior_grades": [], "curriculum_subjects": []}

	program = program_enrollment[0].program

	prior_grades = frappe.get_all(
		"SMS Transferee Grade",
		filters={"student": student},
		fields=["name", "subject_code", "description", "unit", "grade", "completion", "remarks", "school_year", "semester", "school"],
		order_by="creation asc",
	)

	curricula = frappe.get_all("SMS Curriculum", filters={"course": program, "is_active": 1}, pluck="name")
	seen = set()
	curriculum_subjects = []
	for curriculum in curricula:
		curriculum_doc = frappe.get_cached_doc("SMS Curriculum", curriculum)
		for row in curriculum_doc.subjects:
			key = (row.year_level, row.semester, row.subject)
			if key in seen:
				continue
			seen.add(key)
			curriculum_subjects.append({
				"year_level": row.year_level,
				"semester": row.semester,
				"subject": row.subject,
				"subject_name": frappe.db.get_value("Course", row.subject, "course_name"),
				"subject_code": frappe.db.get_value("Course", row.subject, "subject_code"),
				"unit": flt(frappe.db.get_value("Course", row.subject, "unit")),
			})

	completed = set(
		frappe.get_all("Course Enrollment", filters={"student": student, "status": "Completed"}, pluck="course")
	)
	credited = set(frappe.get_all("SMS Credit", filters={"student": student}, pluck="subject"))

	for cs in curriculum_subjects:
		cs["completed"] = cs["subject"] in completed
		cs["credited"] = cs["subject"] in credited

	curriculum_subjects.sort(key=lambda cs: (cs["year_level"], cs["semester"]))

	return {"program": program, "prior_grades": prior_grades, "curriculum_subjects": curriculum_subjects}


@frappe.whitelist()
def credit_transfer(student: str, subject: str, year_level: int, semester: int, credited_via: str = "Transfer Evaluation") -> dict:
	"""Credits one curriculum subject for a transferee: creates an SMS
	Credit record (the reference/audit entry), and - per explicit product
	decision - a matching Course Enrollment marked Completed so the credit
	has real effect on prerequisite checks and Pre-Enrollment's
	already-done filtering elsewhere in the system. Idempotent: re-crediting
	an already-credited subject is a safe no-op on both writes.

	If a Course Enrollment already exists for this (student, course) - the
	core education app's Course Enrollment.validate_duplication() blocks a
	second one for the same (student, course, program_enrollment) regardless
	of status, so a new row can never be inserted here - its status is
	force-set to Completed instead when it isn't already (found via live
	testing: a subject the student happened to already be Enrolled-but-not-
	yet-Completed in stayed Enrolled after crediting, silently failing the
	"make it count" requirement above - only a row already Completed truly
	has nothing left to do).
	Returns the refreshed get_transfer_evaluation(student) so the frontend
	can just replace its state with the response.
	"""
	if not frappe.db.exists("SMS Credit", {"student": student, "subject": subject}):
		frappe.get_doc({
			"doctype": "SMS Credit",
			"student": student,
			"subject": subject,
			"year_level": year_level,
			"semester": semester,
			"credited_via": credited_via,
		}).insert()

	existing_enrollment = frappe.db.get_value("Course Enrollment", {"student": student, "course": subject}, "name")
	if existing_enrollment:
		frappe.db.set_value(
			"Course Enrollment", existing_enrollment,
			{"status": "Completed", "year_level": year_level, "semester": semester},
		)
	else:
		program_enrollment = frappe.get_all(
			"Program Enrollment", filters={"student": student}, fields=["name"],
			order_by="creation desc", limit=1,
		)
		if program_enrollment:
			frappe.get_doc({
				"doctype": "Course Enrollment",
				"student": student,
				"course": subject,
				"program_enrollment": program_enrollment[0].name,
				"enrollment_date": frappe.utils.today(),
				"status": "Completed",
				"year_level": year_level,
				"semester": semester,
			}).insert()

	return get_transfer_evaluation(student)


@frappe.whitelist()
def get_instructor_schedule(instructor: str) -> dict:
	"""An instructor's teaching schedule: every non-disabled Student Group
	they're assigned to (via the Student Group Instructor child table),
	with the same schedule display fields get_student_schedule already
	surfaces for students (days/time/room), plus the course and academic
	year per row. Unlike get_student_schedule, there's no "current term"
	concept to derive for an instructor (no Program Enrollment analog) -
	this simply shows every active assignment, across whatever academic
	years they happen to span; the academic_year column lets the viewer
	tell terms apart at a glance instead of the screen guessing which one
	is "current".
	"""
	student_group_names = frappe.get_all(
		"Student Group Instructor", filters={"instructor": instructor}, pluck="parent"
	)
	if not student_group_names:
		return {"classes": []}

	day_fields = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
	classes = []
	for sg_name in student_group_names:
		sg = frappe.get_cached_doc("Student Group", sg_name)
		if sg.disabled:
			continue
		classes.append({
			"student_group": sg.name,
			"student_group_name": sg.student_group_name,
			"course": sg.course,
			"course_name": frappe.db.get_value("Course", sg.course, "course_name") if sg.course else None,
			"academic_year": sg.academic_year,
			"days": [d.capitalize() for d in day_fields if sg.get(d)],
			"start_time": str(sg.start_time) if sg.start_time else None,
			"end_time": str(sg.end_time) if sg.end_time else None,
			"room": sg.room,
		})

	classes.sort(key=lambda c: (c["academic_year"] or "", c["course_name"] or ""))
	return {"classes": classes}


@frappe.whitelist()
def get_instructor_grades(instructor: str) -> dict:
	"""Backs the By Teacher reporting view: every class the instructor
	teaches (reuses get_instructor_schedule, unchanged, for that list) with
	each class's roster attached. Rosters come from one grouped Course
	Enrollment query keyed by student_group rather than looping
	get_class_roster per class - an instructor teaching many sections would
	otherwise turn this into an N+1.
	"""
	schedule = get_instructor_schedule(instructor)
	classes = schedule["classes"]
	if not classes:
		return {"classes": []}

	student_groups = [c["student_group"] for c in classes]
	roster_rows = frappe.get_all(
		"Course Enrollment",
		filters={"student_group": ["in", student_groups]},
		fields=[
			"name", "student", "student_name", "student_group", "prelim", "midterm",
			"final", "final_rating", "grade_remarks", "points", "status",
		],
		order_by="student_name asc",
	)
	rosters_by_group: dict = {}
	for row in roster_rows:
		rosters_by_group.setdefault(row.student_group, []).append(row)

	for c in classes:
		c["roster"] = rosters_by_group.get(c["student_group"], [])

	return {"classes": classes}


_DAY_FIELDS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


@frappe.whitelist()
def list_classes_offered(
	program: str, section: str, academic_year: str, year_level: int, semester: int
) -> list[dict]:
	"""Read side of the Classes Offered screen: every Student Group already
	created for this exact program/section/academic_year/year_level/semester
	combination, enriched with the Course (subject) fields the table needs to
	display, plus the same days-derivation get_instructor_schedule already
	uses. Has no meaning until all five filters are chosen - mirrors
	list_grades' early-return-on-empty-filter shape, just with reqd filters
	instead of optional ones (there is no "show everything" mode here).
	"""
	rows = frappe.get_all(
		"Student Group",
		filters={
			"program": program,
			"section": section,
			"academic_year": academic_year,
			"year_level": year_level,
			"semester": semester,
			"group_based_on": "Course",
		},
		fields=["name", "student_group_name", "course", "max_strength", "room", "start_time", "end_time"],
		order_by="student_group_name asc",
	)
	if not rows:
		return []

	course_names = list({r.course for r in rows if r.course})
	course_map = {
		c.name: c
		for c in frappe.get_all(
			"Course",
			filters={"name": ["in", course_names]},
			fields=["name", "course_name", "subject_code", "unit", "is_nstp_or_ms"],
		)
	} if course_names else {}

	instructor_rows = frappe.get_all(
		"Student Group Instructor",
		filters={"parent": ["in", [r.name for r in rows]]},
		fields=["parent", "instructor", "instructor_name"],
	)
	instructor_map = {row.parent: row for row in instructor_rows}

	result = []
	for r in rows:
		course = course_map.get(r.course)
		instructor = instructor_map.get(r.name)
		sg = frappe.get_cached_doc("Student Group", r.name)
		result.append({
			**r,
			"course_name": course.course_name if course else None,
			"subject_code": course.subject_code if course else None,
			"unit": course.unit if course else None,
			"is_nstp_or_ms": bool(course.is_nstp_or_ms) if course else False,
			"days": [d.capitalize() for d in _DAY_FIELDS if sg.get(d)],
			"instructor": instructor.instructor if instructor else None,
			"instructor_name": instructor.instructor_name if instructor else None,
		})
	return result


def _create_offered_class(
	program: str, subject: str, section: str, academic_year: str,
	year_level: int, semester: int, max_students: int,
) -> str:
	"""Shared single-row creation used by both prescribe_classes (looping
	over a curriculum) and add_class (one arbitrary subject) - the only two
	things that ever create a Student Group in this app. student_group_name
	(and therefore the doc's name, per Student Group's `autoname:
	"field:student_group_name"`) is built from the subject's own code and the
	program's own code where each exists, falling back to their own doctype
	name otherwise, so it reads close to the legacy ClassCode ("CAAT 115-A")
	while staying globally unique across academic years (a bare
	subject+section could otherwise collide if the same subject/section
	repeats next year).
	"""
	subject_code = frappe.db.get_value("Course", subject, "subject_code") or subject
	program_code = frappe.db.get_value("Program", program, "course_code") or program
	# Must match the full (program, course, section, academic_year,
	# year_level, semester) uniqueness the callers' existence pre-checks use
	# - omitting any of those from the name lets two rows that the existence
	# check treats as distinct (e.g. the same subject/section offered by two
	# different programs in the same term) collide on the same primary key.
	student_group_name = f"{subject_code}-{program_code}-{section}-Y{year_level}S{semester}-{academic_year}"
	doc = frappe.get_doc({
		"doctype": "Student Group",
		"student_group_name": student_group_name,
		"group_based_on": "Course",
		"program": program,
		"course": subject,
		"academic_year": academic_year,
		"section": section,
		"year_level": year_level,
		"semester": semester,
		"max_strength": max_students,
	})
	doc.insert()
	return doc.name


@frappe.whitelist()
def prescribe_classes(
	program: str, curriculum: str, section: str, academic_year: str,
	year_level: int, semester: int, max_students: int,
) -> dict:
	"""'Prescribe Classes' - bulk-creates one Student Group per SMS
	Curriculum Subject row at this year_level/semester, for the given
	program/section/academic_year. Idempotent: a subject that already has a
	matching Student Group for this exact combination is skipped, not
	errored, so re-running after adding a subject to the curriculum only
	creates what's missing. Each row is created independently (own
	try/except) so one bad row - e.g. a name collision - doesn't roll back
	the whole batch, the same "don't let a cleanup-step crash abort
	everything already-succeeded" lesson as this session's other bulk
	operations. `skipped` (expected, pre-checked as already-offered) and
	`failed` (a real, unexpected per-row error) are reported separately so a
	genuine failure never reads to the registrar as an unremarkable
	already-offered skip.
	"""
	curriculum_doc = frappe.get_cached_doc("SMS Curriculum", curriculum)
	subjects = [
		row.subject for row in curriculum_doc.subjects
		if row.year_level == year_level and row.semester == semester
	]

	created = []
	skipped = []
	failed = []
	for subject in subjects:
		if frappe.db.exists("Student Group", {
			"program": program, "course": subject, "section": section,
			"academic_year": academic_year, "year_level": year_level, "semester": semester,
		}):
			skipped.append(subject)
			continue
		try:
			name = _create_offered_class(
				program, subject, section, academic_year, year_level, semester, max_students
			)
			created.append(name)
		except Exception as e:
			frappe.log_error(title="prescribe_classes: row failed", message=str(e))
			failed.append(subject)

	return {"created": created, "skipped": skipped, "failed": failed}


@frappe.whitelist()
def add_class(
	program: str, course: str, section: str, academic_year: str,
	year_level: int, semester: int, max_students: int,
) -> dict:
	"""'Add New Class' - one arbitrary subject, not curriculum-driven
	(electives, extra sections). Same underlying creation as
	prescribe_classes, just for a single caller-chosen Course instead of
	looping a curriculum's subject rows."""
	if frappe.db.exists("Student Group", {
		"program": program, "course": course, "section": section,
		"academic_year": academic_year, "year_level": year_level, "semester": semester,
	}):
		frappe.throw(_("{0} is already offered for this section/year/semester.").format(course))
	name = _create_offered_class(program, course, section, academic_year, year_level, semester, max_students)
	return {"name": name}


@frappe.whitelist()
def update_class(name: str, course: str, max_strength: int) -> dict:
	"""'Edit Class' - correcting which subject a row represents, or its
	per-class capacity. Unit/subject-name/code are never stored on Student
	Group itself (always read live from Course), so there's nothing else on
	this screen that needs editing here."""
	doc = frappe.get_doc("Student Group", name)
	doc.course = course
	doc.max_strength = max_strength
	doc.save()
	return {"name": doc.name}


@frappe.whitelist()
def remove_class(name: str) -> dict:
	"""'Remove Class'. Student Group has no app-level delete guard of its
	own - only Frappe's generic LinkExistsError if a Course Enrollment still
	references it - re-thrown here as a registrar-facing message instead of
	a raw framework error, matching enroll()'s capacity-error style."""
	try:
		frappe.delete_doc("Student Group", name)
	except frappe.LinkExistsError:
		frappe.throw(_("Cannot remove {0} — students are already enrolled in this class.").format(name))
	return {"name": name}


@frappe.whitelist()
def schedule_class(
	name: str,
	room: str | None,
	start_time: str | None,
	end_time: str | None,
	days: dict,
	instructor: str | None,
) -> dict:
	"""'Schedule' - assigns room/time/days/professor to an already-created
	class. Replaces (not appends to) the Student Group Instructor child
	table, since this screen's single "Professor" column means exactly one
	instructor per class, matching the legacy grid."""
	doc = frappe.get_doc("Student Group", name)
	doc.room = room
	doc.start_time = start_time
	doc.end_time = end_time
	for day in _DAY_FIELDS:
		doc.set(day, 1 if days.get(day) else 0)

	doc.instructors = []
	if instructor:
		doc.append("instructors", {"instructor": instructor})

	doc.save()
	return {"name": doc.name}


@frappe.whitelist()
def create_student(payload: dict) -> dict:
	"""Creates a new Student from the Add Student wizard in one call: an
	optional Father and/or Mother Guardian record (only created for
	whichever side has a name), the Student itself with its guardians and
	credentials child rows built inline, and an optional SMS Student RFID
	Tag. One request = one DB transaction, so a failure partway (e.g. a
	duplicate RFID) rolls back everything automatically - no special
	handling needed beyond letting exceptions propagate.

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
