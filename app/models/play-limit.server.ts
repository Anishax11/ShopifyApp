import prisma from "../db.server";
import {
  COOLDOWN_OPTIONS,
  DEVICES,
  FREQUENCIES,
  SCROLL_DEPTH_RANGE,
  SETTING_DEFAULTS_LEGACY,
  TRIGGERS,
  TRIGGER_DELAY_RANGE,
} from "../utils/campaign";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlayLimit = "unlimited" | "per_session" | "per_visitor";

export type Player = {
  visitorId: string | null;
  sessionId: string | null;
  customerId: string | null;
};

export function normalizePlayLimit(value: unknown): PlayLimit {
  return value === "per_session" || value === "per_visitor"
    ? value
    : "unlimited";
}

/**
 * Anonymous IDs come from the browser (localStorage / sessionStorage) and are
 * therefore client-controlled. The customer ID comes from the app proxy query
 * string, which Shopify signs, so it is trustworthy for logged-in shoppers.
 */
export function resolvePlayer(request: Request): Player {
  const visitor = request.headers.get("X-Visitor-Id");
  const session = request.headers.get("X-Session-Id");
  const customer = new URL(request.url).searchParams.get(
    "logged_in_customer_id",
  );

  return {
    visitorId: visitor && UUID_V4.test(visitor) ? visitor.toLowerCase() : null,
    sessionId: session && UUID_V4.test(session) ? session.toLowerCase() : null,
    customerId: customer && /^\d{1,20}$/.test(customer) ? customer : null,
  };
}

/** Unique key stored on Spin.playKey; the database rejects a second one. */
export function playKeyFor(
  campaignId: string,
  limit: PlayLimit,
  player: Player,
): string | null {
  if (limit === "per_visitor") {
    const id = player.customerId
      ? `c:${player.customerId}`
      : player.visitorId
        ? `v:${player.visitorId}`
        : null;
    return id ? `${campaignId}:${id}` : null;
  }
  if (limit === "per_session") {
    return player.sessionId ? `${campaignId}:s:${player.sessionId}` : null;
  }
  return null;
}

/** Friendly pre-check. The unique playKey is what actually prevents races. */
export async function hasAlreadyPlayed(
  campaignId: string,
  limit: PlayLimit,
  player: Player,
): Promise<boolean> {
  if (limit === "unlimited") return false;

  const or: Array<
    { visitorId: string } | { customerId: string } | { sessionId: string }
  > = [];
  if (limit === "per_visitor") {
    if (player.visitorId) or.push({ visitorId: player.visitorId });
    if (player.customerId) or.push({ customerId: player.customerId });
  } else if (player.sessionId) {
    or.push({ sessionId: player.sessionId });
  }
  if (or.length === 0) return false;

  // Failed spins never delivered a result, so they don't use up the play.
  const found = await prisma.spin.findFirst({
    where: { campaignId, status: { not: "failed" }, OR: or },
    select: { id: true },
  });
  return Boolean(found);
}

/** Sanitized settings for the storefront. Bad or missing values fall back. */
export function storefrontSettings(campaign: Record<string, unknown>) {
  const D = SETTING_DEFAULTS_LEGACY;
  const oneOf = (value: unknown, list: { value: string }[], fallback: string) =>
    typeof value === "string" && list.some((i) => i.value === value)
      ? value
      : fallback;
  const intIn = (value: unknown, min: number, max: number, fallback: number) =>
    Number.isInteger(value) && (value as number) >= min && (value as number) <= max
      ? (value as number)
      : fallback;

  return {
    trigger: {
      type: oneOf(campaign.triggerType, TRIGGERS, D.triggerType),
      delaySeconds: intIn(
        campaign.triggerDelaySeconds,
        TRIGGER_DELAY_RANGE.min,
        TRIGGER_DELAY_RANGE.max,
        D.triggerDelaySeconds,
      ),
      scrollDepthPercent: intIn(
        campaign.scrollDepthPercent,
        SCROLL_DEPTH_RANGE.min,
        SCROLL_DEPTH_RANGE.max,
        D.scrollDepthPercent,
      ),
    },
    frequency: {
      mode: oneOf(campaign.displayFrequency, FREQUENCIES, D.displayFrequency),
      cooldownDays: COOLDOWN_OPTIONS.includes(campaign.cooldownDays as number)
        ? (campaign.cooldownDays as number)
        : D.cooldownDays,
    },
    playLimit: normalizePlayLimit(campaign.playLimit),
    device: oneOf(campaign.deviceTarget, DEVICES, D.deviceTarget),
  };
}