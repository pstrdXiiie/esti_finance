import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAcademicYearLabel(value: string | null | undefined): string {
  if (!value) return "—"

  const trimmed = value.trim()
  if (!trimmed) return "—"

  const withoutPrefix = trimmed.replace(
    /^(?:TEST\s*AY|AY|ACADEMIC\s*YEAR)\s*/i,
    ""
  )

  return withoutPrefix.trim() || trimmed
}
