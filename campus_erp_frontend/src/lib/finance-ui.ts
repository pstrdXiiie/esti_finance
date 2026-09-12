export const financeRowInput =
  "w-full rounded border-none bg-transparent px-1.5 py-1 text-[13px] text-zinc-900 hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none"

export const financeRowSelect = financeRowInput

export const financeRowLabel = "text-xs text-zinc-500"

export const financePrimaryButton =
  "rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"

export const financeSecondaryButton =
  "rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"

export const financeAccentDot = "h-2 w-2 rounded-full bg-amber-700"

export const financeAccentToggleOn = "bg-amber-700 text-white"
export const financeAccentToggleOff = "text-zinc-500"

export function financeBalanceBadge(isBalanced: boolean) {
  return isBalanced
    ? "text-xs font-semibold text-green-700"
    : "text-xs font-semibold text-red-700"
}
