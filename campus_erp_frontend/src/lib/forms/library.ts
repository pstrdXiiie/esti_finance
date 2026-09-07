import type { EntrySpec, FormSpec } from "@/lib/forms/types"

/**
 * Library module specs. Field lists mirror the installed DocTypes under
 * campus_erp/library/doctype/.
 */

export const authorSpec: FormSpec = {
  doctype: "SMS Library Author",
  title: "Authors",
  fields: [
    { fieldname: "last_name", label: "Last Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "first_name", label: "First Name", fieldtype: "Data", required: true, inListView: true },
  ],
}

export const publisherSpec: FormSpec = {
  doctype: "SMS Library Publisher",
  title: "Publishers",
  fields: [
    { fieldname: "publisher_name", label: "Publisher Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "address", label: "Address", fieldtype: "Small Text" },
    { fieldname: "contact_no", label: "Contact No", fieldtype: "Data" },
  ],
}

export const titleSpec: EntrySpec = {
  doctype: "SMS Library Title",
  title: "Title",
  fields: [
    { fieldname: "title", label: "Title", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "isbn", label: "ISBN", fieldtype: "Data", inListView: true },
    { fieldname: "publisher", label: "Publisher", fieldtype: "Link", options: "SMS Library Publisher" },
    { fieldname: "category", label: "Category", fieldtype: "Link", options: "SMS Code", required: true, inListView: true },
    { fieldname: "cost", label: "Cost", fieldtype: "Currency" },
    { fieldname: "qty", label: "Qty", fieldtype: "Int", required: true },
    { fieldname: "num_copies", label: "Num Copies", fieldtype: "Int", readOnly: true },
    {
      fieldname: "status",
      label: "Status",
      fieldtype: "Select",
      options: "Active\nWithdrawn",
      inListView: true,
    },
  ],
  childTable: {
    fieldname: "authors",
    doctype: "SMS Library Title Author",
    columns: [
      { fieldname: "author", label: "Author", fieldtype: "Link", options: "SMS Library Author", required: true },
    ],
  },
}

export const bookSpec: EntrySpec = {
  doctype: "SMS Library Book",
  title: "Book",
  fields: [
    { fieldname: "title", label: "Title", fieldtype: "Link", options: "SMS Library Title", required: true, inListView: true },
    { fieldname: "accession_no", label: "Accession No", fieldtype: "Int", required: true, inListView: true },
    { fieldname: "call_no", label: "Call No", fieldtype: "Data" },
    { fieldname: "shelf_no", label: "Shelf No", fieldtype: "Data" },
    {
      fieldname: "current_status",
      label: "Current Status",
      fieldtype: "Select",
      options: "Available\nOn Loan\nLost\nWithdrawn",
      readOnly: true,
      inListView: true,
    },
  ],
}

/**
 * naming_series is left off, same convention as personnel.ts's
 * employeeBenefitSpec etc: it has a single fixed default
 * ("LIBG-.YY.-.#####") so there's nothing for the user to choose.
 */
export const guestSpec: EntrySpec = {
  doctype: "SMS Library Guest",
  title: "Guest",
  fields: [
    { fieldname: "last_name", label: "Last Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "first_name", label: "First Name", fieldtype: "Data", required: true, inListView: true },
    { fieldname: "middle_name", label: "Middle Name", fieldtype: "Data", required: true },
    { fieldname: "contact_no", label: "Contact No", fieldtype: "Data", required: true },
    { fieldname: "company_school", label: "Company/School", fieldtype: "Data", required: true },
    { fieldname: "address", label: "Address", fieldtype: "Small Text", required: true },
  ],
}

/**
 * SMS Library Settings is a Single doctype (issingle: 1) — there is no list
 * of records and no create concept, so it doesn't fit the FormSpec/EntrySpec
 * model (which both assume frappe.list/createDoc against a doctype). It's
 * handled by a bespoke page instead: src/app/(app)/library/settings/page.tsx,
 * which loads/saves the one record directly via frappe.getDoc/updateDoc.
 */
