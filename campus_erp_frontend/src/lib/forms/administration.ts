import type { FormSpec } from "@/lib/forms/types"

/**
 * Administration module masters (blueprint Phase 5): plain lookup/reference
 * tables with no submit workflow, same shape as asset.ts's assetModelSpec.
 */

export const smsCodeSpec: FormSpec = {
  doctype: "SMS Code",
  title: "Codes",
  fields: [
    {
      fieldname: "code_type",
      label: "Code Type",
      fieldtype: "Select",
      options: "Nationality\nReligion\nLibrary Category\nOther\nAsset\nExpense\nFees\nLiabilities\nMiscellaneous\nRevenue\nScholarship\nUnit",
      required: true,
      inListView: true,
    },
    { fieldname: "code", label: "Code", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "particular", label: "Particular", fieldtype: "Data", required: true, inListView: true },
  ],
}

export const statutoryBracketSpec: FormSpec = {
  doctype: "SMS Statutory Contribution Bracket",
  title: "Statutory Brackets",
  fields: [
    {
      fieldname: "bracket_type",
      label: "Bracket Type",
      fieldtype: "Select",
      options: "SSS\nPhilHealth\nPag-IBIG",
      required: true,
      inListView: true,
    },
    { fieldname: "company", label: "Company", fieldtype: "Link", options: "Company" },
    { fieldname: "range_from", label: "Salary Range From", fieldtype: "Currency", required: true, inListView: true },
    { fieldname: "range_to", label: "Salary Range To", fieldtype: "Currency", required: true, inListView: true },
    { fieldname: "er_share", label: "Employer Share (ER)", fieldtype: "Currency", inListView: true },
    { fieldname: "ee_share", label: "Employee Share (EE)", fieldtype: "Currency", inListView: true },
    // SSS-only.
    { fieldname: "ec_share", label: "Employee Compensation (EC)", fieldtype: "Currency" },
    // PhilHealth-only.
    { fieldname: "sb", label: "Salary Bracket (SB)", fieldtype: "Currency" },
    { fieldname: "total", label: "Total Contribution", fieldtype: "Currency" },
    { fieldname: "encoder", label: "Encoder", fieldtype: "Link", options: "User", readOnly: true },
    { fieldname: "date_entered", label: "Date Entered", fieldtype: "Datetime", readOnly: true },
    { fieldname: "date_edited", label: "Date Edited", fieldtype: "Datetime", readOnly: true },
  ],
}
