import type { EntrySpec, FormSpec } from "@/lib/forms/types"

/**
 * Finance Billing module specs (blueprint Phase 2). Field lists mirror the
 * real installed DocTypes under campus_erp/finance_billing/doctype/ — see
 * IMPLEMENTATION-MAPPING.md's Finance Billing section. `naming_series` and
 * `amended_from` are left out of these forms the same way registrar's
 * permitSpec omits them: the series has a single fixed default and the
 * amended-from link only matters after a cancel/amend, not for data entry.
 * `payment_schedule` (erpnext's native Payment Schedule child table on SMS
 * Student Assessment) is out of scope for this pass per the migration plan.
 */

export const discountSpec: FormSpec = {
  doctype: "SMS Discount",
  title: "Discounts",
  fields: [
    { fieldname: "discount_code", label: "Discount Code", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "description", label: "Description", fieldtype: "Data", required: true, inListView: true },
    {
      fieldname: "tf_discount_mode",
      label: "Tuition Fee Discount Mode",
      fieldtype: "Select",
      options: "Fixed Amount\nPercentage",
      required: true,
    },
    { fieldname: "tf_discount_value", label: "Tuition Fee Discount Value", fieldtype: "Float" },
    {
      fieldname: "misc_discount_mode",
      label: "Misc Fee Discount Mode",
      fieldtype: "Select",
      options: "Fixed Amount\nPercentage",
      required: true,
    },
    { fieldname: "misc_discount_value", label: "Misc Fee Discount Value", fieldtype: "Float" },
    { fieldname: "on_tf", label: "Base Includes Tuition Fee", fieldtype: "Check" },
    {
      fieldname: "tf_base",
      label: "Tuition Fee Base",
      fieldtype: "Select",
      options: "Tuition Only\nTuition + Misc",
    },
    { fieldname: "is_disabled", label: "Disabled", fieldtype: "Check", inListView: true },
  ],
}

export const assessmentSpec: EntrySpec = {
  doctype: "SMS Student Assessment",
  title: "Student Assessment",
  submittable: true,
  fields: [
    { fieldname: "student", label: "Student", fieldtype: "Link", options: "Student", required: true, inListView: true },
    { fieldname: "student_name", label: "Student Name", fieldtype: "Data", readOnly: true, inListView: true },
    {
      fieldname: "program_enrollment",
      label: "Program Enrollment",
      fieldtype: "Link",
      options: "Program Enrollment",
      required: true,
    },
    { fieldname: "program", label: "Program", fieldtype: "Link", options: "Program" },
    { fieldname: "company", label: "Company", fieldtype: "Link", options: "Company", required: true },
    { fieldname: "currency", label: "Currency", fieldtype: "Link", options: "Currency" },
    { fieldname: "school_year", label: "School Year", fieldtype: "Data", required: true },
    { fieldname: "school_term", label: "School Term", fieldtype: "Data", required: true },
    { fieldname: "semester", label: "Semester", fieldtype: "Int", required: true },
    { fieldname: "year_level", label: "Year Level", fieldtype: "Data" },
    {
      fieldname: "student_type",
      label: "Student Type",
      fieldtype: "Select",
      options: "New\nOld\nTransferee\nReturnee",
    },
    { fieldname: "posting_date", label: "Posting Date", fieldtype: "Date", required: true },
    { fieldname: "due_date", label: "Due Date", fieldtype: "Date" },
    { fieldname: "payment_mode", label: "Payment Mode", fieldtype: "Select", options: "Cash\nInstallment" },
    { fieldname: "installment_months", label: "Installment Months", fieldtype: "Int" },
    { fieldname: "tuition", label: "Tuition", fieldtype: "Currency" },
    { fieldname: "new_tuition", label: "New Tuition", fieldtype: "Currency", readOnly: true },
    { fieldname: "misc_fee", label: "Misc Fee", fieldtype: "Currency" },
    { fieldname: "other_fee", label: "Other Fee", fieldtype: "Currency" },
    { fieldname: "assessment", label: "Assessment", fieldtype: "Currency", readOnly: true },
    { fieldname: "discount_type", label: "Discount Type", fieldtype: "Link", options: "SMS Discount" },
    { fieldname: "discount_percent", label: "Discount Percent", fieldtype: "Float" },
    { fieldname: "other_discount", label: "Other Discount", fieldtype: "Currency" },
    { fieldname: "misc_discount", label: "Misc Discount", fieldtype: "Currency" },
    { fieldname: "scholarship", label: "Scholarship", fieldtype: "Link", options: "Fee Category" },
    { fieldname: "subsidy", label: "Subsidy", fieldtype: "Currency" },
    { fieldname: "old_account", label: "Old Account", fieldtype: "Currency" },
    { fieldname: "old_assessment", label: "Old Assessment", fieldtype: "Currency" },
    { fieldname: "old_account_payment", label: "Old Account Payment", fieldtype: "Currency" },
    { fieldname: "total_fee", label: "Total Fee", fieldtype: "Currency", readOnly: true, inListView: true },
    { fieldname: "payment", label: "Payment", fieldtype: "Currency", readOnly: true },
    { fieldname: "receivable", label: "Receivable", fieldtype: "Currency", readOnly: true, inListView: true },
    { fieldname: "refnum", label: "Ref No", fieldtype: "Data" },
    { fieldname: "cor_reference", label: "COR Reference", fieldtype: "Data" },
    { fieldname: "receivable_account", label: "Receivable Account", fieldtype: "Link", options: "Account", readOnly: true },
    { fieldname: "cost_center", label: "Cost Center", fieldtype: "Link", options: "Cost Center", readOnly: true },
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: "Draft\nAssessed\nReassessed\nWithdrawn\nCancelled",
      inListView: true,
    },
    { fieldname: "is_reassessment", label: "Is Reassessment", fieldtype: "Check" },
    { fieldname: "branch", label: "Branch", fieldtype: "Link", options: "Branch" },
  ],
  childTable: {
    fieldname: "assessment_detail",
    doctype: "SMS Student Assessment Detail",
    columns: [
      { fieldname: "particular", label: "Particular", fieldtype: "Data", required: true },
      {
        fieldname: "item_type",
        label: "Item Type",
        fieldtype: "Select",
        options: "Tuition\nMisc Fee\nDiscount\nSurcharge\nPrevious Balance\nScholarship\nTotal",
        required: true,
      },
      { fieldname: "fee_code", label: "Fee Code", fieldtype: "Link", options: "Fee Category" },
      { fieldname: "header_code", label: "Header Code", fieldtype: "Link", options: "Fee Category" },
      { fieldname: "amount", label: "Amount", fieldtype: "Currency", required: true },
      { fieldname: "true_amount", label: "True Amount", fieldtype: "Currency" },
      { fieldname: "amount_paid", label: "Amount Paid", fieldtype: "Currency" },
    ],
  },
}
