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

/* ----------------------- Triggers, frequency, limits ---------------------- */

export const TRIGGERS = [
  { value: "time_delay", label: "Time delay – after a set number of seconds" },
  { value: "exit_intent", label: "Exit intent – when a desktop visitor is about to leave" },
  { value: "scroll_depth", label: "Scroll depth – after scrolling part of the page" },
];

export const FREQUENCIES = [
  { value: "every_visit", label: "Every visit – on each page load until closed" },
  { value: "once_per_session", label: "Once per session" },
  { value: "once_per_visitor", label: "Once per visitor – then wait for a cooldown" },
];

export const COOLDOWN_OPTIONS = [1, 7, 30];

export const PLAY_LIMITS = [
  { value: "per_visitor", label: "One play per visitor" },
  { value: "per_session", label: "One play per session" },
];
// Only offered when editing a campaign created before play limits existed.
export const LEGACY_PLAY_LIMIT = {
  value: "unlimited",
  label: "Unlimited plays (legacy)",
};

export const DEVICES = [
  { value: "all", label: "All devices" },
  { value: "desktop", label: "Desktop only" },
  { value: "mobile", label: "Mobile only" },
];

export const TRIGGER_DELAY_RANGE = { min: 0, max: 120 };
export const SCROLL_DEPTH_RANGE = { min: 10, max: 90 };
export const EXIT_INTENT_MOBILE_FALLBACK_SECONDS = 20;

export type CampaignSettings = {
  triggerType: string;
  triggerDelaySeconds: number;
  scrollDepthPercent: number;
  displayFrequency: string;
  cooldownDays: number;
  playLimit: string;
  deviceTarget: string;
};

// Defaults for campaigns created from now on.
export const SETTING_DEFAULTS_NEW: CampaignSettings = {
  triggerType: "time_delay",
  triggerDelaySeconds: 3,
  scrollDepthPercent: 50,
  displayFrequency: "once_per_session",
  cooldownDays: 7,
  playLimit: "per_visitor",
  deviceTarget: "all",
};

// Matches the database column defaults, i.e. how existing campaigns behave.
export const SETTING_DEFAULTS_LEGACY: CampaignSettings = {
  ...SETTING_DEFAULTS_NEW,
  displayFrequency: "every_visit",
  playLimit: "unlimited",
};