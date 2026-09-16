import Link from "next/link"

/**
 * The same "← Back to X" muted-link pattern already hand-rolled in a couple
 * of places (registrar/students/new/page.tsx, EmployeeWizard.tsx) —
 * extracted here as one shared component instead of copy-pasted markup per
 * page, for any page that has a real, single place a user came from.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm text-muted-foreground hover:underline w-fit shrink-0">
      ← Back to {label}
    </Link>
  )
}
