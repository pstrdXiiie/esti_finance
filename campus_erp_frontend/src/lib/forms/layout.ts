import type { FieldSpec } from "./types"

export interface FieldSection {
  label: string
  columns: FieldSpec[][]
  autoFlow?: boolean
}

export function groupFieldsIntoSections(fields: FieldSpec[]): FieldSection[] {
  const hasMarkers = fields.some(
    (f) => f.fieldtype === "Section Break" || f.fieldtype === "Column Break"
  )

  if (hasMarkers) {
    const sections: FieldSection[] = []
    let current: FieldSection = { label: "", columns: [[]] }
    let started = false

    for (const f of fields) {
      if (f.fieldtype === "Section Break") {
        if (started) sections.push(current)
        current = { label: f.label ?? "", columns: [[]] }
        started = true
        continue
      }
      if (f.fieldtype === "Column Break") {
        current.columns.push([])
        continue
      }
      started = true
      current.columns[current.columns.length - 1].push(f)
    }
    sections.push(current)
    return sections.filter((s) => s.columns.some((c) => c.length > 0))
  }

  const legacyOrder: string[] = []
  const legacyMap = new Map<string, FieldSpec[]>()
  for (const f of fields) {
    const key = f.section ?? ""
    if (!legacyMap.has(key)) {
      legacyOrder.push(key)
      legacyMap.set(key, [])
    }
    legacyMap.get(key)!.push(f)
  }
  return legacyOrder.map((key) => ({
    label: key,
    columns: [legacyMap.get(key)!],
    autoFlow: true,
  }))
}

export function evaluateDependsOn(
  dependsOn: string | undefined,
  values: Record<string, unknown>
): boolean {
  if (!dependsOn) return true
  if (dependsOn.startsWith("eval:")) {
    const expr = dependsOn.slice(5)
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("doc", `return Boolean(${expr})`)
      return fn(values)
    } catch {
      return false
    }
  }
  return Boolean(values[dependsOn])
}
