// Shared between client and server. Do not import anything server-only here.

export const MIN_REWARDS = 2;
export const MAX_REWARDS = 5;
export const DEFAULT_DISCOUNTS = [10, 15, 20, 5, 25];

export const THEMES = [
  { value: "none", label: "No theme" },
  { value: "halloween", label: "🎃 Halloween" },
  { value: "christmas", label: "🎄 Christmas" },
  { value: "diwali", label: "🪔 Diwali" },
  { value: "valentines", label: "💗 Valentine's Day" },
  { value: "black-friday", label: "🛍️ Black Friday" },
  { value: "new-year", label: "🎉 New Year" },
  { value: "summer", label: "☀️ Summer Sale" },
];

export const PLACEMENTS = [
  { value: "popup", label: "Popup – opens automatically after 3 seconds" },
  { value: "banner", label: "Banner – top bar with a “Play now” button" },
  { value: "inline", label: "Inline – shown where you add the block" },
];

export const STATUSES = [
  { value: "draft", label: "Draft – not visible to customers" },
  { value: "active", label: "Active – live on your storefront" },
];

/** The wheel label is generated from the discount value, never typed by hand. */
export function rewardLabel(discountValue: number): string {
  if (!discountValue || discountValue <= 0) return "Try again";
  return `${discountValue}% OFF`;
}

export function labelFor(
  list: { value: string; label: string }[],
  value: string,
): string {
  const label = list.find((item) => item.value === value)?.label ?? value;
  // Drop the "– description" part for compact display.
  return label.split(" – ")[0];
}