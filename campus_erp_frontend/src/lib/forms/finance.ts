import type { ChildTableSpec, EntrySpec, FormSpec, WizardLayout } from "@/lib/forms/types"

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
export const studentAccountSpec: EntrySpec = {
  doctype: "SMS Student Account",
  title: "Student Account",
  quickLinks: [
    {
      label: "View Student",
      hrefFor: (row) =>
        row.stud_num ? `/registrar/students?q=${encodeURIComponent(String(row.stud_num))}` : null,
    },
  ],
  fields: [
    {
      fieldname: "stud_num",
      label: "Student",
      fieldtype: "Link",
      // Real doctype is "Student" (Education/Registrar) — "SMS Student"
      // doesn't exist anywhere in the backend; a Link pointed at it can't
      // resolve or search at all.
      options: "Student",
      dropdown: true,
      linkLabelFields: ["first_name", "middle_name", "last_name"],
      inListView: true,
      section: "Account Details",
    },
    { fieldname: "school_year", label: "School Year", fieldtype: "Data", inListView: true, section: "Account Details" },
    {
      fieldname: "semester",
      label: "Semester",
      fieldtype: "Select",
      options: "1st Semester\n2nd Semester\n3rd Semester\nsummer\n1st Quarter\n2nd Quarter\n3rd Quarter\n4th Quarter",
      inListView: true,
      section: "Account Details",
    },
    { fieldname: "date", label: "Date", fieldtype: "Date", section: "Account Details" },
    { fieldname: "or_number", label: "OR Number", fieldtype: "Data", section: "Account Details" },
    { fieldname: "assessment", label: "Assessment", fieldtype: "Select", options: "Tuition \nLaboratory \n Registration\n Special Courses\n Graduation\n Other", section: "Balances" },
    { fieldname: "amount", label: "Amount", fieldtype: "Currency", section: "Balances" },
    { fieldname: "balance", label: "Balance", fieldtype: "Currency", inListView: true, readOnly: true, section: "Balances" },
    {
      fieldname: "payment",
      label: "Payment",
      fieldtype: "Select",
      options: "Cash\nInstallment",
      section: "Balances",
    },
   { fieldname: "bal_adjustment", label: "Balance Adjustment", fieldtype: "Check", section: "Adjustments" },
{ fieldname: "adj_bal", label: "Adjustment Balance", fieldtype: "Currency", readOnlyDependsOn: "eval:!doc.bal_adjustment", section: "Adjustments" },
  ],
}


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

const assessmentDetailChildTable: ChildTableSpec = {
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
}

/**
 * Groups assessmentSpec's 39 flat fields (a plain 2-column flood otherwise —
 * see the Desk-like screenshot this was built from) into the same
 * dot/connector wizard used by the Add Student form and the Assessment
 * dialog, via WizardFormLayout (EntryScreen renders this instead of the flat
 * grid whenever `wizard` is set — see EntryScreen.tsx). Line Items reuses the
 * same assessmentDetailChildTable object as the spec's own top-level
 * `childTable`, not a duplicate copy of its columns.
 */
const assessmentWizard: WizardLayout = {
  steps: [
    {
      key: "student-term",
      label: "Student & Term",
      fieldnames: [
        "student",
        "student_name",
        "program_enrollment",
        "program",
        "company",
        "currency",
        "school_year",
        "school_term",
        "semester",
        "year_level",
        "student_type",
        "posting_date",
        "due_date",
      ],
    },
    {
      key: "fees",
      label: "Fees & Tuition",
      fieldnames: ["payment_mode", "installment_months", "tuition", "new_tuition", "misc_fee", "other_fee", "assessment"],
    },
    {
      key: "discounts",
      label: "Discounts & Adjustments",
      fieldnames: [
        "discount_type",
        "discount_percent",
        "other_discount",
        "misc_discount",
        "scholarship",
        "subsidy",
        "old_account",
        "old_assessment",
        "old_account_payment",
      ],
    },
    {
      key: "totals-status",
      label: "Totals & Status",
      fieldnames: [
        "total_fee",
        "payment",
        "receivable",
        "refnum",
        "cor_reference",
        "receivable_account",
        "cost_center",
        "status",
        "is_reassessment",
        "branch",
      ],
    },
    {
      key: "line-items",
      label: "Line Items",
      fieldnames: [],
      childTable: assessmentDetailChildTable,
    },
  ],
}

export const assessmentSpec: EntrySpec = {
  doctype: "SMS Student Assessment",
  title: "Student Assessment",
  submittable: true,
  wizard: assessmentWizard,
  fields: [
    {
      fieldname: "student",
      label: "Student",
      fieldtype: "Link",
      options: "Student",
      required: true,
      inListView: true,
      searchable: true,
      searchFields: ["name", "student_name"],
      linkLabelFields: ["student_name"],
      autofill: {
        fields: { student_name: "student_name", branch: "branch" },
        relatedRecord: {
          doctype: "Program Enrollment",
          linkField: "student",
          orderBy: "enrollment_date",
<<<<<<< HEAD
          // "name" is always fetched regardless of this mapping (see
          // DynamicField.tsx's applyAutofill) — mapping it here fills in
          // program_enrollment with the actual record id, instead of
          // leaving that Link field for a human to guess at (nobody can
          // type Program Enrollment's own opaque autoname by hand; typing
          // something recognizable like a Program code there is exactly
          // what threw "Could not find Program Enrollment: BSIS").
          fields: { name: "program_enrollment", program: "program", academic_year: "school_year" },
=======
          fields: { program: "program", academic_year: "school_year" },
>>>>>>> bd92b2d (updated finance maintenance)
        },
      },
    },
    { fieldname: "student_name", label: "Student Name", fieldtype: "Data", readOnly: true, inListView: true },
    {
      fieldname: "program_enrollment",
      label: "Program Enrollment",
      fieldtype: "Link",
      options: "Program Enrollment",
      required: true,
      readOnly: true,
      description: "Auto-filled from the selected Student's latest Program Enrollment",
    },
    { fieldname: "program", label: "Program", fieldtype: "Link", options: "Program", readOnly: true },
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
  childTable: assessmentDetailChildTable,
}


export const pettycash: FormSpec = {
  doctype: "SMS Petty Cash Voucher",
  title: "Petty Cash Voucher",

  fields: [
    {
      fieldname: "pcv_number",
      label: "PCV Number",
      fieldtype: "Data",
      readOnly: true,
      section: "Transaction Details",
      inListView: true,
    },

    {
      fieldname: "transaction_date",
      label: "Date",
      fieldtype: "Date",
      required: true,
      section: "Transaction Details",
    },

    {
      fieldname: "petty_cash_fund",
      label: "Petty Cash Fund",
      fieldtype: "Currency",
      required: true,
      section: "Transaction Details",
    },

    {
      fieldname: "available_fund",
      label: "Available Fund",
      fieldtype: "Currency",
      readOnly: true,
      section: "Transaction Details",
    },

    {
      fieldname: "consumed_fund",
      label: "Consumed Fund",
      fieldtype: "Currency",
      readOnly: true,
      section: "Transaction Details",
    },

    {
      fieldname: "particulars",
      label: "Particulars",
      fieldtype: "Data",
      required: true,
      section: "Transaction Information",
    },

    {
      fieldname: "notes",
      label: "Notes",
      fieldtype: "Small Text",
      section: "Transaction Information",
    },

    {
      fieldname: "account",
      label: "Account",
      fieldtype: "Link",
      options: "Account",
      required: true,
      section: "Account Details",
    },

    {
      fieldname: "amount",
      label: "Amount",
      fieldtype: "Currency",
      required: true,
      section: "Account Details",
    },
  ],
};


export const pettycashEntry: FormSpec = {
  doctype: "SMS Petty Cash Account Entry",
  title: "Petty Cash Account Entry",

  fields: [
    {
      fieldname: "account",
      label: "Account",
      fieldtype: "Link",
      options: "Account",
      required: true,
      inListView: true,
    },

    {
      fieldname: "account_name",
      label: "Account Name",
      fieldtype: "Data",
      readOnly: true,
      inListView: true,
    },

    {
      fieldname: "debit",
      label: "Debit",
      fieldtype: "Currency",
      inListView: true,
    },

    {
      fieldname: "credit",
      label: "Credit",
      fieldtype: "Currency",
      inListView: true,
    },
  ],
};


export const chartOfAccountSpec: EntrySpec = {
  doctype: "Account",
  title: "Chart of Account",
  fields: [
    { fieldname: "account_name", label: "Account Name", fieldtype: "Data", required: true, inListView: true, section: "Account Details" },
    { fieldname: "account_number", label: "Account Number", fieldtype: "Data", inListView: true, section: "Account Details" },
    {
      fieldname: "root_type",
      label: "Type",
      fieldtype: "Select",
      options: "Asset\nLiability\nIncome\nExpense\nEquity",
      required: true,
      inListView: true,
      section: "Account Details",
    },
    { fieldname: "legacy_header", label: "Header", fieldtype: "Data", inListView: true, section: "Account Details" },
    {
      fieldname: "account_type",
      label: "Account Type (ERPNext)",
      fieldtype: "Select",
      options: "\nAccumulated Depreciation\nAsset Received But Not Billed\nBank\nCash\nChargeable\nCapital Work in Progress\nCost of Goods Sold\nCurrent Asset\nCurrent Liability\nDepreciation\nDirect Expense\nDirect Income\nEquity\nExpense Account\nExpenses Included In Asset Valuation\nExpenses Included In Valuation\nFixed Asset\nIncome Account\nIndirect Expense\nIndirect Income\nLiability\nPayable\nReceivable\nRound Off\nRound Off for Opening\nStock\nStock Adjustment\nStock Received But Not Billed\nService ReceivedBut Not Billed\nTax\nTemporary",
      description: "ERPNext's native classification, separate from the legacy Header label above",
      section: "Account Details",
    },
    {
      fieldname: "company",
      label: "Company",
      fieldtype: "Link",
      options: "Company",
      required: true,
      dropdown: true,
      section: "Structure",
    },
    {
      fieldname: "parent_account",
      label: "Parent Account",
      fieldtype: "Link",
      options: "Account",
      required: true,
      dropdown: true,
      linkStaticFilters: { is_group: 1 },
      linkFilterFields: ["company", "root_type"],
      description: "Only group (header) accounts matching the selected Company and Type are shown — pick Company and Type first.",
      section: "Structure",
    },
    { fieldname: "is_group", label: "Is Group (header/parent account)", fieldtype: "Check", section: "Structure" },
  ],
}



export const sundryacc: FormSpec = {
  doctype: "SMS Sundry Account",
  title: "Sundry Account",

  fields: [
    {
      fieldname: "payee",
      label: "Payee",
      fieldtype: "Data",
      required: true,
      section: "Transaction Details",
      inListView: true,
    },

    {
      fieldname: "payment",
      label: "Payment For",
      fieldtype: "Data",
      section: "Transaction Details",
    },

    {
      fieldname: "or_num",
      label: "OR Number",
      fieldtype: "Data",
      section: "Transaction Details",
    },

    {
      fieldname: "date",
      label: "Transaction Date",
      fieldtype: "Date",
      required: true,
      section: "Transaction Details",
    },

    {
      fieldname: "amount",
      label: "Amount",
      fieldtype: "Currency",
      required: true,
      section: "Transaction Details",
    },
  ],
};


export const sundryaccSearch: FormSpec = {
  doctype: "SMS Sundry Account Search",
  title: "Sundry Account Search Filters",

  fields: [
    {
      fieldname: "payee_searchby",
      label: "Filter by Payee",
      fieldtype: "Check",
      section: "Search & Filters",
    },

    {
      fieldname: "payee_searchby_input",
      label: "Payee Name",
      fieldtype: "Data",
      dependsOn: "eval:doc.payee_searchby==1",
      section: "Search & Filters",
    },

    {
      fieldname: "date_searchby",
      label: "Filter Date",
      fieldtype: "Date",
      section: "Search & Filters",
    },
  ],
};

<<<<<<< HEAD
export const cashReceipt: FormSpec = {
  doctype: "SMS Payment and Cash Receipt Entry",
  title: "Cash Receipt Transaction",

  fields: [
    // Payment Type
    {
      fieldname: "payment_type",
      label: "Payment Type",
      fieldtype: "Select",
      options:
        "Student Payment (From Assessment)\nStudent Payment (Other than Assessment)",
      required: true,
      section: "Payment Type",
    },

    {
      fieldname: "semester",
      label: "Semester",
      fieldtype: "Select",
      options: "1st Semester\n2nd Semester\n3rd Semester\nSummer",
      required: true,
      section: "Payment Type",
    },

    {
      fieldname: "school_year",
      label: "School Year",
      fieldtype: "Data",
      required: true,
      section: "Payment Type",
    },

    // Student Information
    {
      fieldname: "student_number",
      label: "Student No.",
      fieldtype: "Link",
      options: "Student",
      required: true,
      section: "Student Information",
      inListView: true,
    },

    {
      fieldname: "payee",
      label: "Payee",
      fieldtype: "Data",
      readOnly: true,
      section: "Student Information",
    },

    {
      fieldname: "course",
      label: "Course",
      fieldtype: "Data",
      readOnly: true,
      section: "Student Information",
    },

    // Assessment
    {
      fieldname: "assessment_fees",
      label: "Assessment of Fees",
      fieldtype: "Currency",
      readOnly: true,
      section: "Assessment & Balance",
      dependsOn: 'eval:doc.payment_type=="Student Payment (From Assessment)"',
    },

    {
      fieldname: "assessment",
      label: "Assessment",
      fieldtype: "Currency",
      readOnly: true,
      section: "Assessment & Balance",
      dependsOn: 'eval:doc.payment_type=="Student Payment (From Assessment)"',
    },

    {
      fieldname: "payment_due",
      label: "Payment Due",
      fieldtype: "Currency",
      readOnly: true,
      section: "Assessment & Balance",
      dependsOn: 'eval:doc.payment_type=="Student Payment (From Assessment)"',
    },

    {
      fieldname: "balance",
      label: "Balance",
      fieldtype: "Currency",
      readOnly: true,
      section: "Assessment & Balance",
      dependsOn: 'eval:doc.payment_type=="Student Payment (From Assessment)"',
    },

    {
      fieldname: "total_payments",
      label: "Total Payments",
      fieldtype: "Currency",
      readOnly: true,
      section: "Assessment & Balance",
      dependsOn: 'eval:doc.payment_type=="Student Payment (From Assessment)"',
    },

    {
      fieldname: "payment_period",
      label: "Payment Period",
      fieldtype: "Select",
      options: "Prelim\nMidterm\nFinal",
      section: "Assessment & Balance",
      dependsOn: 'eval:doc.payment_type=="Student Payment (From Assessment)"',
    },

    // Receipt
    {
      fieldname: "or_number",
      label: "OR Number",
      fieldtype: "Data",
      required: true,
      section: "Receipt Details",
      inListView: true,
    },

    {
      fieldname: "date",
      label: "Date",
      fieldtype: "Date",
      required: true,
      section: "Receipt Details",
    },

    {
      fieldname: "amount",
      label: "Amount",
      fieldtype: "Currency",
      required: true,
      section: "Receipt Details",
    },

    {
      fieldname: "account_charged",
      label: "Account Charged",
      fieldtype: "Link",
      options: "Account",
      required: true,
      section: "Receipt Details",
    },

    // Payment
    {
      fieldname: "mode_of_payment",
      label: "Mode of Payment",
      fieldtype: "Select",
      options: "Cash\nCheck",
      required: true,
      section: "Payment Details",
    },

    {
      fieldname: "check_number",
      label: "Check Number",
      fieldtype: "Data",
      section: "Payment Details",
      dependsOn: 'eval:doc.mode_of_payment=="Check"',
    },
  ],
};

=======
>>>>>>> bd92b2d (updated finance maintenance)
