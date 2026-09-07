/**
 * Shared types for the four screen archetypes (blueprint §5.1). Each legacy
 * form maps onto one of these; a route file resolves a FormSpec and hands it
 * to the matching template component, rather than every screen being
 * hand-built bespoke React.
 */

export type FieldType =
  | "Data"
  | "Text"
  | "Small Text"
  | "Int"
  | "Float"
  | "Currency"
  | "Date"
  | "Datetime"
  | "Time"
  | "Check"
  | "Link"
  | "Select"

export interface FieldSpec {
  fieldname: string
  label: string
  fieldtype: FieldType
  /** For Link: target DocType. For Select: newline-joined options. */
  options?: string
  required?: boolean
  readOnly?: boolean
  inListView?: boolean
  /** Groups this field under a bordered, labeled section in MasterDetailScreen's edit dialog (e.g. "Personal Information"). Fields with no section render ungrouped, as before. */
  section?: string
  /** For a Link field only: render as a Select populated by fetching `options` (the target doctype)'s records, instead of the usual type-the-exact-name Data input. */
  dropdown?: boolean
}

export interface FormSpec {
  /** Legacy form name, kept for traceability back to the blueprint/VB source. */
  legacyForm?: string
  doctype: string
  title: string
  fields: FieldSpec[]
  /** Whitelisted campus_erp.api.* method backing this screen's primary action, if any. */
  primaryApi?: string
  /** Base route for a bespoke per-row detail page, e.g. "/registrar/students". When set, MasterDetailScreen renders a per-row link to `${detailPath}/${row.name}` alongside the existing edit-dialog row click. */
  detailPath?: string
  /** Base route for a bespoke "create new" page, e.g. "/registrar/students/new". When set, MasterDetailScreen's "Add {title}" button navigates there instead of opening the built-in dialog. */
  addPath?: string
  /** A status-like Select field plus the value representing a soft-retirement state (e.g. Student's sms_status="Dropped"). When set, MasterDetailScreen's row action menu gets a quick "Drop" item that patches just this field, instead of requiring the full edit dialog. */
  statusField?: { fieldname: string; droppedValue: string; label?: string }
  /** Doctypes that are safe to auto-delete, on request, when they're the reason a delete fails with Frappe's LinkExistsError — e.g. a Student blocked by its SMS Graduation Batch, a derived/computed artifact from the graduation run rather than source-of-truth data. When a delete fails because of one of these, MasterDetailScreen offers to delete the blocker and retry instead of just showing the error. Financial/ledger doctypes (Payment Ledger Entry, GL Entry) are listed here for Student specifically, and only because this project's actual data at the time was confirmed-disposable test/dev seed data with no real transactions behind it — that confirmation doesn't generalize to other doctypes or datasets. Adding a new financial/ledger doctype to any spec's list is exactly the kind of change that needs the same explicit, deliberate confirmation, not a default. */
  cascadeDeleteDoctypes?: string[]
  /** Submittable doctypes that must be cancelled (docstatus 1 -> 2) before they can be deleted — e.g. a Student blocked by a submitted SMS Student Assessment with posted GL Entries. Handled separately from cascadeDeleteDoctypes because cancelling reverses real financial/ledger entries: MasterDetailScreen shows a distinctly stronger warning naming that consequence before cancelling and deleting the blocker. Only list doctypes where cancel-then-delete is an intentionally sanctioned cleanup path, not routine cleanup. */
  cancelAndDeleteDoctypes?: string[]
  /**
   * Fields that logically belong on this record but actually live on a
   * separate linked doctype — e.g. a Student's current Program (course) and
   * Year Level, which live on their Program Enrollment, not Student itself
   * (a student can shift programs, so it's a separate history record, not a
   * Student field). MasterDetailScreen looks up the newest matching record
   * for the row being edited (by `linkField`), shows these fields in their
   * own labeled section, and patches that record on save — separately from
   * the base doctype update. It never creates a new related record here
   * (those typically need other required fields this dialog doesn't
   * collect), so the fields are disabled with an explanatory note when no
   * related record exists yet.
   */
  relatedRecord?: {
    doctype: string
    /** Field on the related doctype linking back to this row's `name`. */
    linkField: string
    /** Field used to pick the most relevant record when several match (newest first). */
    orderBy: string
    /** Section label these fields render under in the edit dialog. */
    section: string
    /** Shown under the section heading when no related record exists yet. */
    missingRecordHint: string
    fields: FieldSpec[]
  }
}

export interface ChildTableSpec {
  fieldname: string
  doctype: string
  columns: FieldSpec[]
}

export interface EntrySpec extends FormSpec {
  childTable?: ChildTableSpec
  /** Doctype is submittable (docstatus workflow) per blueprint §5.1. */
  submittable?: boolean
  /** Workflow actions available at the current state, e.g. ["Submit for Recommendation"]. */
  workflowActions?: string[]
}

export interface ReportSpec {
  legacyForm?: string
  /** Either a registered Frappe Report name, or a raw whitelisted method. */
  report?: string
  method?: string
  title: string
  filters: FieldSpec[]
  columns: Array<{ fieldname: string; label: string; width?: number }>
}
