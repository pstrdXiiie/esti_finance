import type { EntrySpec, FormSpec } from "@/lib/forms/types"

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

export const employeeBenefitSpec: EntrySpec = {
  doctype: "SMS Employee Benefit",
  title: "Employee Benefit",
  submittable: true,
  fields: [
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Employee", required: true, inListView: true },
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
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Employee", required: true, inListView: true },
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
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Employee", required: true, inListView: true },
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
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Employee", required: true, inListView: true },
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

export const overtimeSpec: EntrySpec = {
  doctype: "SMS Overtime",
  title: "Overtime",
  submittable: true,
  fields: [
    { fieldname: "employee", label: "Employee", fieldtype: "Link", options: "Employee", required: true, inListView: true },
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
