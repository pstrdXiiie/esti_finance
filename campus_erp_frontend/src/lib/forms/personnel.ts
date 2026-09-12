import type { EntrySpec, FieldSpec, FormSpec, WizardLayout } from "@/lib/forms/types"

/**
 * Personnel module specs (blueprint Phase 3). Field lists mirror the real
 * installed DocTypes under campus_erp/personnel/doctype/. `naming_series`
 * and `amended_from` are left off employeeBenefitSpec the same way
 * finance.ts's assessmentSpec and purchasing.ts's canteenPcvSpec do: the
 * series has a single fixed default and the amended-from link only matters
 * after a cancel/amend, not for data entry.
 */

export const policySpec: FormSpec = {
  doctype: "SMS Policy",
  title: "Policies",
  fields: [
    { fieldname: "policy_name", label: "Policy Name", fieldtype: "Data", required: true, inListView: true },
  ],
}

export const groupPolicySpec: FormSpec = {
  doctype: "SMS Group Policy",
  title: "Group Policies",
  fields: [
    {
      fieldname: "employment_status",
      label: "Employment Status",
      fieldtype: "Select",
      options: "Regular\nContractual\nPart Timer",
      required: true,
      inListView: true,
    },
    { fieldname: "policy", label: "Policy", fieldtype: "Link", options: "SMS Policy", required: true, inListView: true },
  ],
}

export const departmentSpec: FormSpec = {
  doctype: "SMS Personnel Departments",
  title: "Departments",
  fields: [
    { fieldname: "deptcode", label: "Department Code", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "department", label: "Department Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "head", label: "Head", fieldtype: "Data", inListView: true },
  ],
}

export const employeeBenefitSpec: EntrySpec = {
  doctype: "SMS Employee Benefit",
  title: "Employee Benefit",
  submittable: true,
  fields: [
    // FIX: was `options: "Employee"` — that ERPNext doctype has zero
    // records in this system (confirmed via `frappe.db.count("Employee")`
    // returning 0). Every real HR record here lives on the custom
    // `Personnel Info` doctype instead (see employeeSpec below).
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Personnel Info", required: true, inListView: true },
    {
      fieldname: "petty_cash_voucher",
      label: "Petty Cash Voucher",
      fieldtype: "Link",
      options: "SMS Canteen PCV",
    },
    { fieldname: "available_fund", label: "Available Fund", fieldtype: "Currency" },
    { fieldname: "consumed_fund", label: "Consumed Fund", fieldtype: "Currency", readOnly: true },
    { fieldname: "amount", label: "Amount", fieldtype: "Currency", required: true, inListView: true },
    { fieldname: "benefit_date", label: "Benefit Date", fieldtype: "Date", required: true, inListView: true },
    { fieldname: "description", label: "Description", fieldtype: "Small Text" },
    { fieldname: "batch_no", label: "Batch No", fieldtype: "Data" },
  ],
}

/**
 * Employee-loan subsystem (campus_erp/personnel/doctype/sms_loan_*, backed by
 * campus_erp/api/personnel.py). `attachment` (fieldtype Attach) is left off
 * loanApplicationSpec/employeeLoanSpec — FieldType (types.ts) has no "Attach"
 * variant and DynamicField doesn't render one, the same reason no other spec
 * in this codebase surfaces an Attach field. `naming_series` and
 * `amended_from` are left off for the usual reason. The loan-application
 * detail page is a bespoke screen (not this generic EntryScreen route) since
 * it needs a "Compute Terms" button wired into the same form state — see
 * personnel/loan-applications/[name]/page.tsx.
 */
export const loanTypeSpec: FormSpec = {
  doctype: "SMS Loan Type",
  title: "Loan Types",
  fields: [
    { fieldname: "loan_code", label: "Loan Code", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "loan_name", label: "Loan Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "interest_rate", label: "Interest Rate", fieldtype: "Float" },
    { fieldname: "is_government_loan", label: "Is Government Loan", fieldtype: "Check" },
  ],
}

export const loanApplicationSpec: EntrySpec = {
  doctype: "SMS Loan Application",
  title: "Loan Application",
  submittable: true,
  fields: [
    // FIX: was `options: "Employee"` — see employeeBenefitSpec's comment above.
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Personnel Info", required: true, inListView: true },
    { fieldname: "loan_type", label: "Loan Type", fieldtype: "Link", options: "SMS Loan Type", required: true, inListView: true },
    { fieldname: "amount", label: "Amount", fieldtype: "Currency", required: true, inListView: true },
    { fieldname: "reason", label: "Reason", fieldtype: "Small Text", required: true },
    { fieldname: "date_applied", label: "Date Applied", fieldtype: "Date" },
    { fieldname: "computed_interest", label: "Computed Interest", fieldtype: "Currency", readOnly: true },
    { fieldname: "loan_balance", label: "Loan Balance", fieldtype: "Currency", readOnly: true },
    { fieldname: "term_months", label: "Term (Months)", fieldtype: "Int" },
    { fieldname: "amortization", label: "Amortization", fieldtype: "Currency", readOnly: true },
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: "Draft\nPending Recommendation\nRecommended\nApproved\nRejected",
      inListView: true,
    },
    { fieldname: "recommended_by", label: "Recommended By", fieldtype: "Link", options: "User" },
    { fieldname: "recommended_on", label: "Recommended On", fieldtype: "Datetime" },
    { fieldname: "approved_by", label: "Approved By", fieldtype: "Link", options: "User" },
    { fieldname: "approved_on", label: "Approved On", fieldtype: "Datetime" },
  ],
}

export const employeeLoanSpec: EntrySpec = {
  doctype: "SMS Employee Loan",
  title: "Employee Loan",
  fields: [
    // FIX: was `options: "Employee"` — see employeeBenefitSpec's comment above.
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Personnel Info", required: true, inListView: true },
    { fieldname: "loan_type", label: "Loan Type", fieldtype: "Link", options: "SMS Loan Type", required: true },
    { fieldname: "loan_application", label: "Loan Application", fieldtype: "Link", options: "SMS Loan Application" },
    { fieldname: "gross_amount", label: "Gross Amount", fieldtype: "Currency", required: true, inListView: true },
    { fieldname: "loan_amount", label: "Loan Amount", fieldtype: "Currency" },
    { fieldname: "amortization_amount", label: "Amortization Amount", fieldtype: "Currency" },
    { fieldname: "loan_balance", label: "Loan Balance", fieldtype: "Currency", readOnly: true, inListView: true },
    { fieldname: "interest_rate", label: "Interest Rate", fieldtype: "Float" },
    {
      fieldname: "pay_period",
      label: "Pay Period",
      fieldtype: "Select",
      options: "First Half\nSecond Half\nBoth",
    },
    { fieldname: "term_months", label: "Term (Months)", fieldtype: "Int" },
    { fieldname: "first_payment_date", label: "First Payment Date", fieldtype: "Date" },
    { fieldname: "closed", label: "Closed", fieldtype: "Check", readOnly: true },
    { fieldname: "reference_number", label: "Reference Number", fieldtype: "Data" },
  ],
}

export const travelOrderSpec: EntrySpec = {
  doctype: "SMS Travel Order",
  title: "Travel Order",
  submittable: true,
  fields: [
    // FIX: was `options: "Employee"` — see employeeBenefitSpec's comment above.
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Personnel Info", required: true, inListView: true },
    { fieldname: "start_date", label: "Start Date", fieldtype: "Date", required: true, inListView: true },
    { fieldname: "end_date", label: "End Date", fieldtype: "Date", required: true },
    { fieldname: "purpose", label: "Purpose", fieldtype: "Small Text", required: true },
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: "Draft\nPending Recommendation\nRecommended\nApproved\nRejected",
      inListView: true,
    },
  ],
}

export const employeeSpec: FormSpec = {
  doctype: "Personnel Info",
  title: "Employees",
  // Phase 3 (05-PERSONNEL-IMPLEMENTATION-PLAN.md): payroll fields live on a
  // bespoke detail page rather than this quick-edit dialog, so MasterDetailScreen
  // renders a per-row Eye-icon link (additive to the existing edit dialog,
  // not a replacement — see detailPath's doc-comment in types.ts) to
  // /personnel/employees/<name>.
  detailPath: "/personnel/employees",
  fields: [
    { fieldname: "employee_id", label: "Employee ID", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "first_name", label: "First Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "last_name", label: "Last Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "middle_name", label: "Middle Name", fieldtype: "Data" },
    { fieldname: "title", label: "Title", fieldtype: "Data" },
    { fieldname: "department", label: "Department", fieldtype: "Link", options: "SMS Personnel Departments", inListView: true, dropdown: true },
    { fieldname: "employee_status", label: "Employee Status", fieldtype: "Select", options: "Contractual\nPart Timer\nProbationary\nRegular", inListView: true },
    { fieldname: "work_status", label: "Work Status", fieldtype: "Select", options: "In Active\nActive\nExecutive\nConsultant", inListView: true },
    { fieldname: "date_hired", label: "Date Hired", fieldtype: "Date", inListView: true },
    { fieldname: "birthdate", label: "Birthdate", fieldtype: "Date" },
    { fieldname: "gender", label: "Gender", fieldtype: "Select", options: "Male\nFemale\nOthers" },
    { fieldname: "marital_status", label: "Marital Status", fieldtype: "Select", options: "Single\nMarried\nDivorced\nWidowed\nSeparated" },
    { fieldname: "nationality", label: "Nationality", fieldtype: "Select", options: "Filipino\nAmerican" },
    { fieldname: "religion", label: "Religion", fieldtype: "Data" },
    { fieldname: "contact_number", label: "Contact Number", fieldtype: "Data" },
    { fieldname: "mailing_address", label: "Mailing Address", fieldtype: "Data" },
    { fieldname: "birthplace", label: "Birthplace", fieldtype: "Data" },
    { fieldname: "rfid", label: "RFID", fieldtype: "Data" },
    { fieldname: "number_of_dependents", label: "Number of Dependents", fieldtype: "Int" },
    { fieldname: "tin_number", label: "TIN Number", fieldtype: "Data" },
    { fieldname: "sss_number", label: "SSS Number", fieldtype: "Data" },
    { fieldname: "philhealth", label: "PhilHealth", fieldtype: "Data" },
    { fieldname: "pag_ibig", label: "Pag-IBIG", fieldtype: "Data" },
    // Added — confirmed present on the real Personnel Info DocType via
    // `bench --site education.localhost console` but previously missing
    // from this spec (see 03-BUGS-AND-FIXES.md entry 11). `profile`
    // (Attach Image) is deliberately NOT included here — FieldSpec's
    // fieldtype union has no Attach/Attach Image variant yet, same reason
    // loan attachments are left off every other spec in this file.
    { fieldname: "emergency_contacts", label: "Emergency Contacts", fieldtype: "Small Text" },
    { fieldname: "family_dependents", label: "Family/Dependents", fieldtype: "Small Text" },
    { fieldname: "skills", label: "Skills", fieldtype: "Small Text" },
    { fieldname: "paid_holiday", label: "Paid Holiday", fieldtype: "Check" },
    { fieldname: "leave_credits", label: "Leave Credits", fieldtype: "Check" },
    { fieldname: "official_business", label: "Official Business", fieldtype: "Check" },
    { fieldname: "late_immunity", label: "Late Immunity", fieldtype: "Check" },
    { fieldname: "absent_immunity", label: "Absent Immunity", fieldtype: "Check" },
    { fieldname: "vacation_leave", label: "Vacation Leave", fieldtype: "Float" },
    { fieldname: "sick_leave", label: "Sick Leave", fieldtype: "Float" },
  ],
  // Payroll rate fields moved out to employeePayrollFields (below) as of
  // Phase 3 — they're rendered on the new detail page at
  // /personnel/employees/[name]/page.tsx instead of this quick-edit dialog.
  // The Table fields (education, seminars_attended, infractions, leaves,
  // loan_ledgers) are still intentionally left out of both this spec and the
  // detail page: no DynamicField renderer exists for Table fieldtype yet,
  // and per 05-PERSONNEL-IMPLEMENTATION-PLAN.md Phase 2, leaves/loan_ledgers
  // need ChildTableGrid.tsx wired in first (infractions/seminars/education
  // are additionally blocked on backend RPCs that don't exist yet).
}

/**
 * Payroll rate fields for Personnel Info, rendered on the Employee detail
 * page (src/app/(app)/personnel/employees/[name]/page.tsx) rather than the
 * Employees list's quick-edit dialog — per employeeSpec's own comment above,
 * these were deliberately deferred to "a dedicated Employee detail page."
 *
 * Full field list confirmed against the target employeeWizardLayout's
 * "payroll_info" step. gross_pay, allowance, and with_atm_card are editable;
 * every rate/deduction field is computed server-side and marked readOnly,
 * matching that spec (note: reg_rate_pre_hour was previously listed here as
 * editable — corrected to readOnly to match the confirmed source).
 *
 * NOT moved here (left where they already are, since that's a bigger
 * restructuring than adding a missing field — confirm before doing this):
 * tin_number/sss_number/philhealth/pag_ibig stay under Government IDs, and
 * work_status stays under Employment — the target doc groups all of these
 * under payroll_info instead, but that's a separate change from "add the
 * missing fields."
 */
export const employeePayrollFields: FieldSpec[] = [
  { fieldname: "gross_pay", label: "Gross Pay", fieldtype: "Currency", required: true },
  { fieldname: "allowance", label: "Allowance", fieldtype: "Currency" },
  { fieldname: "reg_rate_pre_hour", label: "Reg. Rate per Hour", fieldtype: "Currency", readOnly: true },
  { fieldname: "reg_ot_per_hour", label: "Reg. OT per Hour", fieldtype: "Currency", readOnly: true },
  { fieldname: "sunday_rate_per_hour", label: "Sunday Rate per Hour", fieldtype: "Currency", readOnly: true },
  { fieldname: "sunday_ot_per_hour", label: "Sunday OT per Hour", fieldtype: "Currency", readOnly: true },
  { fieldname: "holiday_rate_per_hour", label: "Holiday Rate per Hour", fieldtype: "Currency", readOnly: true },
  { fieldname: "holiday_ot_per_hour", label: "Holiday OT per Hour", fieldtype: "Currency", readOnly: true },
  { fieldname: "late_rate_per_hour", label: "Late Rate per Hour", fieldtype: "Currency", readOnly: true },
  { fieldname: "undertime_rate_per_hour", label: "Undertime Rate per Hour", fieldtype: "Currency", readOnly: true },
  { fieldname: "with_holding_tax", label: "Withholding Tax", fieldtype: "Currency", readOnly: true },
  { fieldname: "sss_deduction", label: "SSS Deduction", fieldtype: "Currency", readOnly: true },
  { fieldname: "philhealth_deduction", label: "PhilHealth Deduction", fieldtype: "Currency", readOnly: true },
  { fieldname: "pagibig_deduction", label: "Pag-IBIG Deduction", fieldtype: "Currency", readOnly: true },
  { fieldname: "with_atm_card", label: "With ATM Card", fieldtype: "Check" },
]

export const overtimeSpec: EntrySpec = {
  doctype: "SMS Overtime",
  title: "Overtime",
  submittable: true,
  fields: [
    // FIX: was `options: "Employee"` — see employeeBenefitSpec's comment above.
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Personnel Info", required: true, inListView: true },
    { fieldname: "overtime_date", label: "Overtime Date", fieldtype: "Date", required: true, inListView: true },
    { fieldname: "time_from", label: "Time From", fieldtype: "Time", required: true },
    { fieldname: "time_to", label: "Time To", fieldtype: "Time", required: true },
    { fieldname: "num_hours", label: "No. of Hours", fieldtype: "Float", readOnly: true, inListView: true },
    { fieldname: "reason", label: "Reason", fieldtype: "Small Text", required: true },
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: "Draft\nPending Recommendation\nRecommended\nApproved\nRejected",
      inListView: true,
    },
    { fieldname: "branch", label: "Branch", fieldtype: "Link", options: "Branch" },
  ],
}

export const employeeWizardLayout: WizardLayout = {
  steps: [
    {
      key: "basic",
      label: "Basic Info",
      fieldnames: ["employee_id", "first_name", "last_name", "middle_name", "title"],
    },
    {
      key: "employment",
      label: "Employment",
      fieldnames: ["department", "employee_status", "work_status", "date_hired", "rfid"],
    },
    {
      key: "personal",
      label: "Personal Details",
      fieldnames: [
        "birthdate",
        "gender",
        "marital_status",
        "nationality",
        "religion",
        "birthplace",
        "number_of_dependents",
      ],
    },
    {
      key: "contact",
      label: "Contact",
      fieldnames: ["contact_number", "mailing_address"],
    },
    {
      key: "government_ids",
      label: "Government IDs",
      fieldnames: ["tin_number", "sss_number", "philhealth", "pag_ibig"],
    },
  ],
}

/**
 * Fields for the "Add Leave Application" dialog. NOT a FormSpec/EntrySpec —
 * there is no standalone Leave Application doctype. add_leave_application
 * (campus_erp/api/personnel.py) appends directly to Personnel Info's
 * `leaves` child table and saves the parent doc. "employee_id" here is
 * misleadingly named on the backend — the RPC actually expects the
 * Personnel Info DOCNAME, not the employee_id data field on that doctype.
 */
export const leaveApplicationFields: FieldSpec[] = [
  { fieldname: "employee_id", label: "Employee", fieldtype: "Link", options: "Personnel Info", required: true },
  { fieldname: "leave_type", label: "Leave Type", fieldtype: "Select", options: "Vacation\nSick\nEmergency\nPaternal\nMaternal\nOthers", required: true },
  { fieldname: "from_date", label: "From", fieldtype: "Date", required: true },
  { fieldname: "to_date", label: "To", fieldtype: "Date", required: true },
  { fieldname: "half_day", label: "Half Day", fieldtype: "Check" },
  { fieldname: "reason", label: "Reason", fieldtype: "Small Text" },
  { fieldname: "other_leave_reason", label: "Other Leave Reason", fieldtype: "Data" },
]