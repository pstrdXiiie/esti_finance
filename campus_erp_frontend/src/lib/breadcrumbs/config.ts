import { frappe } from "@/lib/frappe"

export type BreadcrumbResolver = (id: string) => Promise<string | null>

export const staticLabels: Record<string, string> = {
  registrar: "Registrar",
  students: "Students",
  "student-groups": "Class Groups",
  enrollment: "Enrollment & Grades",

  // Finance — segments with no separator, or that shouldn't just be
  // de-underscored, need an explicit override even after the
  // toTitleCase fix below.
  chartsofaccounts: "Charts of Accounts",
  financialreport: "Financial Report",
  collection_for_the_period: "Collection for the Period",
  assessment_for_the_period: "Assessment for the Period",
  sundry_acc: "Sundry Accounts",
  student_acc: "Student Accounts",
}

export const hiddenSegments = new Set<string>([])

export const breadcrumbResolvers: Record<string, BreadcrumbResolver> = {
  students: async (id) => {
    const doc = await frappe.getDoc<{ student_name?: string }>("Student", id)
    return doc.student_name ?? null
  },
  "student-groups": async (id) => {
    const doc = await frappe.getDoc<{ student_group_name?: string }>(
      "Student Group",
      id
    )
    return doc.student_group_name ?? null
  },

  // "Chart of Account" doctype + account_name field confirmed earlier in
  // this build (used by GLEntryGrid's account picker).
  chartsofaccounts: async (id) => {
    const doc = await frappe.getDoc<{ account_name?: string }>(
      "Account",
      id
    )
    return doc.account_name ?? null
  },

  // student_acc serves SMS Student Account (module: Finance Billing, 9 real
  // rows in the DB) — it does exist on the backend; it just wasn't wired to
  // this route before. SMS Student Assessment (0 rows currently) still has
  // its own assessmentSpec/AssessmentActions screen elsewhere, untouched.
  // stud_num links to SMS Student, which has no combined "name" field (and
  // no autoname pattern, so its `name` itself is an opaque hash) — this
  // composes a readable label from first/last name instead.
  student_acc: async (id) => {
    const doc = await frappe.getDoc<{ stud_num?: string }>("SMS Student Account", id)
    if (!doc.stud_num) return null
    const student = await frappe.getDoc<{
      first_name?: string
      last_name?: string
      student_number?: string
    }>("SMS Student", doc.stud_num)
    const fullName = [student.first_name, student.last_name].filter(Boolean).join(" ")
    return fullName || student.student_number || null
  },
}