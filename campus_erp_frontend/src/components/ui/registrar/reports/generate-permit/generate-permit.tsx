import Link from "next/link"

import { Button } from "@/components/ui/button"

/**
 * Batch permit generation (compute eligible students for a term and issue
 * permits in bulk) isn't built yet — no backend endpoint exists for it. The
 * Permits screen already supports creating and issuing permits one at a
 * time, so that's linked here in the meantime.
 */
export default function GeneratePermit() {
  return (
    <div className="rounded-2xl border border-border h-full p-7">
      <p className="text-muted-foreground">
        Generate Permit — coming soon. Batch permit generation for a school
        year/term isn&apos;t built yet.
      </p>
      <Button render={<Link href="/registrar/permits" />} variant="outline" className="mt-4">
        Go to Permits
      </Button>
    </div>
  )
}
