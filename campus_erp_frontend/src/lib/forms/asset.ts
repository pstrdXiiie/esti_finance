import type { EntrySpec, FormSpec } from "@/lib/forms/types"

/**
 * Asset & Property module specs (blueprint Phase 4). `assetSpec` targets the
 * real erpnext "Asset" doctype (submittable — submitting locks the record
 * and is a prerequisite for depreciation/GL posting) extended with a
 * handful of PH-specific custom fields. `custodian`/`status` are read-only
 * here: both are system-derived — custodian by Asset Movement's own
 * on_submit hook, status by ERPNext's own submit/depreciation/movement
 * lifecycle — not meant for free manual editing. Dispatch/return/transfer/
 * consumable-issue/sticker-batch flows are bespoke pages (see
 * app/(app)/asset/dispatch, /transfers, /consumables, /stickers) calling
 * campus_erp.api.asset.* directly rather than raw Asset Movement/Stock
 * Entry CRUD, since those native doctypes carry far more fields than this
 * module needs to expose.
 */

export const assetSpec: EntrySpec = {
  doctype: "Asset",
  title: "Asset Register",
  submittable: true,
  fields: [
    { fieldname: "asset_name", label: "Asset Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "item_code", label: "Item", fieldtype: "Link", options: "Item", required: true, inListView: true },
    { fieldname: "asset_category", label: "Asset Category", fieldtype: "Link", options: "Asset Category" },
    { fieldname: "company", label: "Company", fieldtype: "Link", options: "Company", required: true },
    { fieldname: "location", label: "Location", fieldtype: "Link", options: "Location", required: true, inListView: true },
    { fieldname: "custodian", label: "Custodian", fieldtype: "Link", options: "Employee", readOnly: true },
    { fieldname: "department", label: "Department", fieldtype: "Link", options: "Department" },
    { fieldname: "purchase_date", label: "Purchase Date", fieldtype: "Date", required: true, inListView: true },
    // ERPNext requires this before an Asset can be submitted, even though it
    // isn't flagged reqd at the schema level (FieldSpec has no description
    // property to attach that note to in the UI itself).
    { fieldname: "available_for_use_date", label: "Available For Use Date", fieldtype: "Date", required: true },
    { fieldname: "gross_purchase_amount", label: "Purchase Cost", fieldtype: "Currency" },
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options:
        "Draft\nSubmitted\nCancelled\nPartially Depreciated\nFully Depreciated\nSold\nScrapped\nIn Maintenance\nOut of Order\nIssue\nReceipt\nCapitalized\nWork In Progress",
      readOnly: true,
      inListView: true,
    },
    { fieldname: "serial_number", label: "Serial Number", fieldtype: "Data" },
    { fieldname: "brand", label: "Brand", fieldtype: "Link", options: "Brand" },
    { fieldname: "model", label: "Model", fieldtype: "Link", options: "SMS Asset Model" },
    { fieldname: "warranty_date", label: "Warranty Expiry", fieldtype: "Date" },
    { fieldname: "branch", label: "Branch", fieldtype: "Link", options: "Branch" },
    { fieldname: "remarks", label: "Remarks", fieldtype: "Small Text" },
  ],
}

export const assetModelSpec: FormSpec = {
  doctype: "SMS Asset Model",
  title: "Asset Models",
  fields: [
    { fieldname: "model_name", label: "Model Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "brand", label: "Brand", fieldtype: "Link", options: "Brand", inListView: true },
  ],
}
