export const financeRowInput =
  "w-full rounded border-none bg-transparent px-1.5 py-1 text-[13px] text-foreground hover:bg-muted focus:bg-muted focus:outline-none"

export const financeRowSelect = financeRowInput

export const financeRowLabel = "text-xs text-muted-foreground"

export const financePrimaryButton =
  "rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"

export const financeSecondaryButton =
  "rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"

export const financeAccentDot = "h-2 w-2 rounded-full bg-amber-700"

export const financeAccentToggleOn = "bg-amber-700 text-white"
export const financeAccentToggleOff = "text-muted-foreground"

export function financeBalanceBadge(isBalanced: boolean) {
  return isBalanced
    ? "text-xs font-semibold text-green-700"
    : "text-xs font-semibold text-red-700"
}
