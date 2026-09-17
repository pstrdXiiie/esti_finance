import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { frappe, getErrorMessage } from "@/lib/frappe"

/**
 * spec.title is already plural (e.g. "Students", "Graduation Batches") --
 * singularize it for a count of 1 rather than appending another "s". Plurals
 * formed with "-es" after ch/sh/s/x/z (e.g. "Batches" -> "Batch") need two
 * characters stripped, not one, or they end up misspelled ("Batche").
 * Preserves the original casing (unlike a lowercase-then-slice), so it works
 * both inline (lowercased by the caller) and as a toast's leading word.
 */
export function singularize(title: string): string {
  if (/(ch|sh|s|x|z)es$/i.test(title)) return title.slice(0, -2)
  if (/s$/i.test(title)) return title.slice(0, -1)
  return title
}

export function itemLabel(title: string, count: number) {
  const label = count === 1 ? singularize(title) : title
  return label.toLowerCase()
}

/**
 * A delete blocked by Frappe's LinkExistsError names the blocking doctype
 * and document literally in its message (e.g. "...is linked with SMS
 * Graduation Batch lr0atkhk55") -- match that against a spec's opt-in
 * `cascadeDeleteDoctypes` allowlist (derived/computed records that are safe
 * to remove on request, e.g. a graduation run's batch record) so the delete
 * flow can offer to remove the blocker and retry, rather than just failing.
 * Doctypes not on a spec's own allowlist never match, so this never touches
 * financial/accounting records without that spec's explicit say-so.
 */
function findCascadeTarget(
  error: unknown,
  candidates: string[] | undefined
): { doctype: string; name: string } | null {
  if (!candidates?.length) return null
  const message = getErrorMessage(error)
  for (const doctype of candidates) {
    const marker = `linked with ${doctype} `
    const idx = message.indexOf(marker)
    if (idx === -1) continue
    const name = message.slice(idx + marker.length).trim().split(/[\s,.;]/)[0]
    if (name) return { doctype, name }
  }
  return null
}

export interface CascadeDeleteSpec {
  doctype: string
  title: string
  cascadeDeleteDoctypes?: string[]
  cancelAndDeleteDoctypes?: string[]
}

/**
 * Shared "delete, resolving whatever blocks it" flow. Originally built into
 * MasterDetailScreen; extracted here so any list screen (MasterDetailScreen,
 * EntryListScreen, ...) can offer the same safe delete action against its
 * own spec instead of duplicating this recursive cancel/delete logic.
 */
export function useCascadeDelete(spec: CascadeDeleteSpec) {
  const queryClient = useQueryClient()

  // A blocker can itself be blocked by another allowlisted doctype (e.g. a
  // Student's Pre Enrollment blocked by its own Student Assessment, or that
  // Assessment blocked from even being CANCELLED by a Payment Entry still
  // referencing it) — so resolving one is the same "try the operation,
  // resolve whatever blocks it, retry" shape throughout, just recursed onto
  // the blocker's doctype/name. `budget` is shared across the whole call
  // tree (not reset per level) so a pathological chain can't loop forever.
  async function deleteResolvingBlockers(
    doctype: string,
    name: string,
    budget: { remaining: number }
  ) {
    if (budget.remaining <= 0) {
      throw new Error("Too many linked records to resolve automatically.")
    }
    budget.remaining -= 1

    const subject = doctype === spec.doctype ? itemLabel(spec.title, 1) : `${doctype} ${name}`
    const candidates = [
      ...(spec.cascadeDeleteDoctypes ?? []),
      ...(spec.cancelAndDeleteDoctypes ?? []),
    ]

    if (spec.cancelAndDeleteDoctypes?.includes(doctype)) {
      try {
        await frappe.updateDoc(doctype, name, { docstatus: 2 })
      } catch (cancelError) {
        // Cancelling a submitted record can itself fail with the exact same
        // "linked with X" shape as a delete failure (e.g. this Assessment
        // can't be cancelled while a Payment Entry still references it) —
        // resolve that blocker and retry this doctype/name from the top
        // (cancel, then delete) rather than assuming every cancel failure
        // just means "already cancelled" and barreling into a delete that's
        // guaranteed to fail with a much less informative error.
        const blocker = findCascadeTarget(cancelError, candidates)
        if (blocker) {
          if (
            !window.confirm(
              `This ${subject} is linked with ${blocker.doctype} ${blocker.name}, which must be resolved before it can be cancelled. Continue?`
            )
          ) {
            throw cancelError
          }
          await deleteResolvingBlockers(blocker.doctype, blocker.name, budget)
          return deleteResolvingBlockers(doctype, name, budget)
        }
        // Not a link error — already cancelled, already a draft, or some
        // other real issue. Fall through to the delete attempt below, which
        // will surface a clear error if cancelling really was still needed.
      }
    }

    try {
      await frappe.deleteDoc(doctype, name)
      if (doctype !== spec.doctype) {
        queryClient.invalidateQueries({ queryKey: [doctype, "list"] })
      }
    } catch (error) {
      const blocker = findCascadeTarget(error, candidates)
      if (!blocker) throw error

      const needsCancelFirst = spec.cancelAndDeleteDoctypes?.includes(blocker.doctype) ?? false
      const confirmMessage = needsCancelFirst
        ? `This ${subject} is linked with ${blocker.doctype} ${blocker.name}, a submitted record. This will CANCEL that ${blocker.doctype} — reversing any financial/ledger entries it posted — and then delete it, before trying this delete again. Continue?`
        : `This ${subject} is linked with ${blocker.doctype} ${blocker.name}. Delete that ${blocker.doctype} and try again?`

      if (!window.confirm(confirmMessage)) throw error

      await deleteResolvingBlockers(blocker.doctype, blocker.name, budget)
      await deleteResolvingBlockers(doctype, name, budget)
    }
  }

  async function deleteWithCascade(name: string) {
    // A single submitted assessment can pull in its own Payment Entry,
    // which needs its own cancel + 2 Payment Ledger Entry + 4 GL Entry
    // clears before the assessment's own 2 PLE + 4 GL Entry rows even start
    // - roughly 15-20 recursive calls per assessment. A student can have
    // several assessments (each its own such chain) plus Pre/Program/Course
    // Enrollment on top, so this needs real headroom - 50 still aborted
    // mid-chain on a two-assessment student despite steady real progress.
    await deleteResolvingBlockers(spec.doctype, name, { remaining: 200 })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteWithCascade,
    onSuccess: () => {
      toast.success(`${singularize(spec.title)} deleted`)
      queryClient.invalidateQueries({ queryKey: [spec.doctype, "list"] })
    },
    onError: (error) => toast.error(`Could not delete ${spec.title}: ${getErrorMessage(error)}`),
  })

  return { deleteMutation, deleteWithCascade }
}
