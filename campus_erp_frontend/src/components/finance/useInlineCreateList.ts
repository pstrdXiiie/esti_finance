"use client"

import { useCallback, useState, type Dispatch, type SetStateAction } from "react"

export interface UseInlineCreateListResult<T> {
  /** Saved records, newest first — addItem prepends. */
  items: T[]
  /** Escape hatch for callers that need to replace the whole list wholesale (e.g. re-seeding). */
  setItems: Dispatch<SetStateAction<T[]>>
  isFormOpen: boolean
  openForm: () => void
  closeForm: () => void
  /**
   * Flips isFormOpen. Does NOT touch any draft state — this hook never sees a
   * partial/in-progress record, only fully-formed T's (via addItem). A caller
   * that keeps its own draft (every module panel does) must reset that draft
   * itself whenever it closes the form this way, so a reopened form never
   * shows the previous discarded draft.
   */
  toggleForm: () => void
  /** Prepends `item` to `items` and closes the form. */
  addItem: (item: T) => void
}

/**
 * Owns the two pieces of state every "inline create" list screen in this app
 * needs: the saved records, and whether the create-form is open. Deliberately
 * generic and record-shape-agnostic so it is reused as-is by every module
 * panel (Purchase Requisitions, Purchase Orders, and future ones).
 *
 * Draft/form-field state is intentionally NOT owned here — each panel knows
 * its own record shape and required-field rules, so it keeps its draft in its
 * own useState and is responsible for resetting it on Cancel/Save.
 */
export function useInlineCreateList<T>(
  initialItems: T[]
): UseInlineCreateListResult<T> {
  const [items, setItems] = useState<T[]>(initialItems)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const openForm = useCallback(() => setIsFormOpen(true), [])
  const closeForm = useCallback(() => setIsFormOpen(false), [])
  const toggleForm = useCallback(() => setIsFormOpen((open) => !open), [])

  const addItem = useCallback((item: T) => {
    setItems((prev) => [item, ...prev])
    setIsFormOpen(false)
  }, [])

  return { items, setItems, isFormOpen, openForm, closeForm, toggleForm, addItem }
}
