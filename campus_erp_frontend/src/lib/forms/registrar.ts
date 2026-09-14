import type { EntrySpec, FormSpec } from "@/lib/forms/types"

/**
 * Registrar module specs (blueprint Phase 1). Field lists mirror the real
 * installed DocTypes plus the PH-specific custom fields added in
 * campus_erp/setup/custom_fields.py — see IMPLEMENTATION-MAPPING.md's
 * Registrar section for the terminology swap: blueprint "Course" (degree
 * program) == Education "Program"; blueprint "Subject" == Education "Course".
 * Link fields are entered as the exact document name (Program/Course/Student
 * Group all autoname off their own name field, so this is human-typable).
 */

export const studentSpec: FormSpec = {
  doctype: "Student",
  title: "Students",
  addPath: "/registrar/students/new",
  statusField: { fieldname: "sms_status", droppedValue: "Dropped", label: "Drop" },
  cascadeDeleteDoctypes: [
    "SMS Graduation Batch",
    "SMS Pre Enrollment",
    "Program Enrollment",
    "Course Enrollment",
    "Payment Ledger Entry",
    "GL Entry",
    "SMS Credit",
    "SMS Transferee Grade",
  ],
  cancelAndDeleteDoctypes: ["SMS Student Assessment", "Payment Entry"],
  fields: [
    { fieldname: "student_name", label: "Student Name", fieldtype: "Data", readOnly: true, inListView: true, section: "Personal Information" },
    { fieldname: "first_name", label: "First Name", fieldtype: "Data", required: true, inListView: true, section: "Personal Information" },
    { fieldname: "middle_name", label: "Middle Name", fieldtype: "Data", section: "Personal Information" },
    { fieldname: "last_name", label: "Last Name", fieldtype: "Data", inListView: true, section: "Personal Information" },
    { fieldname: "student_email_id", label: "Email Address", fieldtype: "Data", required: true, inListView: true, section: "Personal Information" },
    { fieldname: "student_mobile_number", label: "Mobile Number", fieldtype: "Data", section: "Personal Information" },
    { fieldname: "date_of_birth", label: "Date of Birth", fieldtype: "Date", section: "Personal Information" },
    { fieldname: "gender", label: "Gender", fieldtype: "Link", options: "Gender", section: "Personal Information" },
    { fieldname: "birth_place", label: "Birth Place", fieldtype: "Data", section: "Address" },
    { fieldname: "town", label: "Town", fieldtype: "Data", section: "Address" },
    { fieldname: "province", label: "Province", fieldtype: "Data", section: "Address" },
    { fieldname: "address_line_1", label: "Address", fieldtype: "Data", section: "Address" },
    { fieldname: "city", label: "City", fieldtype: "Data", section: "Address" },
    { fieldname: "country", label: "Country", fieldtype: "Link", options: "Country", section: "Address" },
    { fieldname: "lrn", label: "LRN (DepEd Learner Reference No.)", fieldtype: "Data", section: "Registrar (PH)" },
    { fieldname: "sms_status", label: "Status", fieldtype: "Select", options: "Active\nInactive\nGraduated\nDropped", inListView: true, section: "Registrar (PH)" },
    { fieldname: "branch", label: "Branch", fieldtype: "Link", options: "Branch", section: "Registrar (PH)" },
    { fieldname: "stdnt_cno", label: "Student Control No.", fieldtype: "Data", readOnly: true, section: "Registrar (PH)" },
    { fieldname: "scholarship", label: "Scholarship", fieldtype: "Link", options: "SMS Code", section: "Academic Standing" },
    { fieldname: "discount_type", label: "Discount Type", fieldtype: "Link", options: "SMS Code", section: "Academic Standing" },
    { fieldname: "transferee", label: "Transferee", fieldtype: "Check", section: "Transfer & Graduation History" },
    { fieldname: "prev_course", label: "Previous Course", fieldtype: "Data", section: "Transfer & Graduation History" },
    { fieldname: "last_course_attended", label: "Last Course Attended", fieldtype: "Data", section: "Transfer & Graduation History" },
    { fieldname: "year_last_attended", label: "Year Last Attended", fieldtype: "Int", section: "Transfer & Graduation History" },
  ],
  relatedRecord: {
    doctype: "Program Enrollment",
    linkField: "student",
    orderBy: "enrollment_date",
    section: "Course Enrollment",
    missingRecordHint: "No Program Enrollment on file yet — enroll this student in a course first before shifting it here.",
    fields: [
      { fieldname: "program", label: "Course", fieldtype: "Link", options: "Program", dropdown: true },
      { fieldname: "year_level", label: "Year Level", fieldtype: "Int" },
    ],
  },
}

export const graduationBatchSpec: FormSpec = {
  doctype: "SMS Graduation Batch",
  title: "Graduation Batches",
  fields: [
    { fieldname: "course", label: "Program", fieldtype: "Link", options: "Program", required: true, inListView: true },
    { fieldname: "school_year", label: "School Year", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "run_by", label: "Run By", fieldtype: "Link", options: "User", readOnly: true, inListView: true },
    { fieldname: "run_on", label: "Run On", fieldtype: "Datetime", readOnly: true, inListView: true },
  ],
}

export const permitSpec: EntrySpec = {
  doctype: "SMS Permit",
  title: "Permit to Take Exam",
  fields: [
    { fieldname: "student", label: "Student", fieldtype: "Link", options: "Student", required: true },
    { fieldname: "student_name", label: "Student Name", fieldtype: "Data", readOnly: true, inListView: true },
    { fieldname: "course", label: "Program", fieldtype: "Link", options: "Program", inListView: true },
    { fieldname: "year_level", label: "Year Level", fieldtype: "Int", inListView: true },
    { fieldname: "semester", label: "Semester", fieldtype: "Int", inListView: true },
    { fieldname: "school_year", label: "School Year", fieldtype: "Data" },
    { fieldname: "term", label: "Exam Period", fieldtype: "Data" },
    { fieldname: "assessment", label: "Assessment", fieldtype: "Link", options: "SMS Student Assessment" },
    { fieldname: "total_fee", label: "Total Fee", fieldtype: "Currency", readOnly: true },
    { fieldname: "payment", label: "Payment", fieldtype: "Currency", readOnly: true },
    { fieldname: "due_payment", label: "Due Payment", fieldtype: "Currency", readOnly: true },
    { fieldname: "status", label: "Status", fieldtype: "Select", options: "Pending\nEligible\nIssued" },
    { fieldname: "permit_no", label: "Permit No.", fieldtype: "Data", readOnly: true },
  ],
  childTable: {
    fieldname: "subjects",
    doctype: "SMS Permit Subject",
    columns: [
      { fieldname: "subject", label: "Subject", fieldtype: "Link", options: "Course", required: true },
      { fieldname: "class", label: "Class (Student Group)", fieldtype: "Link", options: "Student Group" },
    ],
  },
}
