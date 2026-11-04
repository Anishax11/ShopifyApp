import { useState } from "react";
import { Form } from "react-router";
import {
  COOLDOWN_OPTIONS,
  DEFAULT_DISCOUNTS,
  DEVICES,
  EXIT_INTENT_MOBILE_FALLBACK_SECONDS,
  FREQUENCIES,
  LEGACY_PLAY_LIMIT,
  MAX_REWARDS,
  MIN_REWARDS,
  PLACEMENTS,
  PLAY_LIMITS,
  SCROLL_DEPTH_RANGE,
  SETTING_DEFAULTS_NEW,
  STATUSES,
  THEMES,
  TRIGGERS,
  TRIGGER_DELAY_RANGE,
  rewardLabel,
} from "../utils/campaign";
import type { CampaignSettings } from "../utils/campaign";
import type { FormErrors } from "../models/campaign.server";

export type CampaignFormValues = CampaignSettings & {
  name: string;
  theme: string;
  placement: string;
  status: string;
  discountValues: number[];
};

export const emptyCampaign: CampaignFormValues = {
  name: "",
  theme: "none",
  placement: "popup",
  status: "draft",
  discountValues: DEFAULT_DISCOUNTS.slice(0, 3),
  ...SETTING_DEFAULTS_NEW,
};

type Props = {
  initial?: CampaignFormValues;
  errors?: FormErrors;
  isSubmitting: boolean;
  submitLabel: string;
};

export function CampaignForm({
  initial = emptyCampaign,
  errors,
  isSubmitting,
  submitLabel,
}: Props) {
  const [name, setName] = useState(initial.name);
  const [theme, setTheme] = useState(initial.theme);
  const [placement, setPlacement] = useState(initial.placement);
  const [status, setStatus] = useState(initial.status);
  const [triggerType, setTriggerType] = useState(initial.triggerType);
  const [triggerDelay, setTriggerDelay] = useState(initial.triggerDelaySeconds);
  const [scrollDepth, setScrollDepth] = useState(initial.scrollDepthPercent);
  const [frequency, setFrequency] = useState(initial.displayFrequency);
  const [cooldown, setCooldown] = useState(initial.cooldownDays);
  const [playLimit, setPlayLimit] = useState(initial.playLimit);
  const [device, setDevice] = useState(initial.deviceTarget);
  const [rewardCount, setRewardCount] = useState(initial.discountValues.length);
  // Always keep MAX_REWARDS slots so changing the count never loses values.
  const [discounts, setDiscounts] = useState<number[]>(() =>
    Array.from(
      { length: MAX_REWARDS },
      (_, i) => initial.discountValues[i] ?? DEFAULT_DISCOUNTS[i] ?? 10,
    ),
  );

  const visible = discounts.slice(0, rewardCount);
  const hasFieldErrors = Boolean(
    errors?.name ||
      errors?.rewards ||
      errors?.triggerDelaySeconds ||
      errors?.scrollDepthPercent,
  );
  // Triggers and display frequency only apply to popup and banner placements.
  const isOverlay = placement !== "inline";
  const playLimitOptions =
    initial.playLimit === LEGACY_PLAY_LIMIT.value
      ? [...PLAY_LIMITS, LEGACY_PLAY_LIMIT]
      : PLAY_LIMITS;

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="save" />
      <input type="hidden" name="game" value="spin" />
      {/* Always submit current values, even when a control is hidden. */}
      <input type="hidden" name="triggerType" value={triggerType} />
      <input type="hidden" name="triggerDelaySeconds" value={triggerDelay} />
      <input type="hidden" name="scrollDepthPercent" value={scrollDepth} />
      <input type="hidden" name="displayFrequency" value={frequency} />
      <input type="hidden" name="cooldownDays" value={cooldown} />
      <input type="hidden" name="playLimit" value={playLimit} />
      <input type="hidden" name="deviceTarget" value={device} />

      <s-stack direction="block" gap="base">
        {errors?.form && (
          <s-banner tone="critical" heading="Couldn't save campaign">
            <s-paragraph>{errors.form}</s-paragraph>
          </s-banner>
        )}
        {!errors?.form && hasFieldErrors && (
          <s-banner tone="critical" heading="Please fix the highlighted fields" />
        )}

        <s-section heading="Campaign details">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Campaign name"
              name="name"
              required
              placeholder="e.g. Halloween Mystery Pumpkin"
              details="Only you see this. It helps you tell campaigns apart."
              value={name}
              error={errors?.name}
              onInput={(e: any) => setName(e.currentTarget.value)}
            />

            <s-select label="Game" name="gameDisplay" value="spin" disabled>
              <s-option value="spin">Spin the Wheel</s-option>
            </s-select>
            <s-text color="subdued">
              Scratch Card, Mystery Box and Quiz are coming soon.
            </s-text>

            <s-select
              label="Theme"
              name="theme"
              value={theme}
              onChange={(e: any) => setTheme(e.currentTarget.value)}
            >
              {THEMES.map((t) => (
                <s-option key={t.value} value={t.value}>
                  {t.label}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-section>

        <s-section heading="Rewards">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Choose how many slices the wheel has and set the discount for
              each. Labels like “10% OFF” are created for you. Use 0% for a
              “Try again” slice.
            </s-paragraph>

            <s-select
              label="Number of rewards"
              name="rewardCount"
              value={String(rewardCount)}
              onChange={(e: any) => setRewardCount(Number(e.currentTarget.value))}
            >
              {Array.from(
                { length: MAX_REWARDS - MIN_REWARDS + 1 },
                (_, i) => MIN_REWARDS + i,
              ).map((count) => (
                <s-option key={count} value={String(count)}>
                  {count}
                </s-option>
              ))}
            </s-select>

            {visible.map((value, index) => (
              <s-number-field
                key={index}
                name={`discountValue-${index}`}
                label={`Reward ${index + 1} discount (%)`}
                min={0}
                max={100}
                value={String(value)}
                details={`Shown on the wheel as “${rewardLabel(value)}”`}
                error={errors?.rewards?.[index]}
                onInput={(e: any) => {
                  const next = [...discounts];
                  next[index] = Number(e.currentTarget.value);
                  setDiscounts(next);
                }}
              />
            ))}

            <s-stack direction="inline" gap="small" alignItems="center">
              <s-text color="subdued">Wheel preview:</s-text>
              {visible.map((value, index) => (
                <s-badge key={index}>{rewardLabel(value)}</s-badge>
              ))}
            </s-stack>
          </s-stack>
        </s-section>

        <s-section heading="Publishing">
          <s-stack direction="block" gap="base">
            <s-select
              label="Placement"
              name="placement"
              value={placement}
              onChange={(e: any) => setPlacement(e.currentTarget.value)}
            >
              {PLACEMENTS.map((p) => (
                <s-option key={p.value} value={p.value}>
                  {p.label}
                </s-option>
              ))}
            </s-select>

            <s-select
              label="Status"
              name="status"
              value={status}
              details="Only one Spin campaign can be active at a time. Activating this one will set the current active campaign to draft."
              onChange={(e: any) => setStatus(e.currentTarget.value)}
            >
              {STATUSES.map((s) => (
                <s-option key={s.value} value={s.value}>
                  {s.label}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-section>

        {isOverlay && (
          <s-section heading="When it appears">
            <s-stack direction="block" gap="base">
              <s-select
                label="Trigger"
                value={triggerType}
                onChange={(e: any) => setTriggerType(e.currentTarget.value)}
              >
                {TRIGGERS.map((t) => (
                  <s-option key={t.value} value={t.value}>
                    {t.label}
                  </s-option>
                ))}
              </s-select>

              {triggerType === "time_delay" && (
                <s-number-field
                  label="Show after (seconds)"
                  min={TRIGGER_DELAY_RANGE.min}
                  max={TRIGGER_DELAY_RANGE.max}
                  value={String(triggerDelay)}
                  error={errors?.triggerDelaySeconds}
                  onInput={(e: any) =>
                    setTriggerDelay(Number(e.currentTarget.value))
                  }
                />
              )}

              {triggerType === "scroll_depth" && (
                <s-number-field
                  label="Show after scrolling (% of page)"
                  min={SCROLL_DEPTH_RANGE.min}
                  max={SCROLL_DEPTH_RANGE.max}
                  value={String(scrollDepth)}
                  error={errors?.scrollDepthPercent}
                  details="Very short pages that can't scroll show it after 15 seconds."
                  onInput={(e: any) =>
                    setScrollDepth(Number(e.currentTarget.value))
                  }
                />
              )}

              {triggerType === "exit_intent" && (
                <s-banner tone="info">
                  <s-paragraph>
                    Detected when a desktop visitor moves the mouse out of the
                    top of the page. Touch devices have no exit signal, so they
                    see it after {EXIT_INTENT_MOBILE_FALLBACK_SECONDS} seconds
                    instead. Choose “Desktop only” below to skip them.
                  </s-paragraph>
                </s-banner>
              )}

              <s-select
                label="Display frequency"
                value={frequency}
                details="Closing a popup also stops it reopening for the rest of that session."
                onChange={(e: any) => setFrequency(e.currentTarget.value)}
              >
                {FREQUENCIES.map((f) => (
                  <s-option key={f.value} value={f.value}>
                    {f.label}
                  </s-option>
                ))}
              </s-select>

              {frequency === "once_per_visitor" && (
                <s-select
                  label="Cooldown"
                  value={String(cooldown)}
                  onChange={(e: any) => setCooldown(Number(e.currentTarget.value))}
                >
                  {COOLDOWN_OPTIONS.map((d) => (
                    <s-option key={d} value={String(d)}>
                      {d === 1 ? "1 day" : `${d} days`}
                    </s-option>
                  ))}
                </s-select>
              )}
            </s-stack>
          </s-section>
        )}

        <s-section heading="Play limits & devices">
          <s-stack direction="block" gap="base">
            <s-select
              label="Play limit"
              value={playLimit}
              details="Checked on the server. Visitors are recognised by browser storage, or by their account when logged in, so clearing storage or switching device can reset an anonymous visitor."
              onChange={(e: any) => setPlayLimit(e.currentTarget.value)}
            >
              {playLimitOptions.map((p) => (
                <s-option key={p.value} value={p.value}>
                  {p.label}
                </s-option>
              ))}
            </s-select>

            <s-select
              label="Show on"
              value={device}
              onChange={(e: any) => setDevice(e.currentTarget.value)}
            >
              {DEVICES.map((d) => (
                <s-option key={d.value} value={d.value}>
                  {d.label}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-section>

        <s-stack direction="inline" gap="base" justifyContent="end">
          <s-button href="/app" disabled={isSubmitting || undefined}>
            Cancel
          </s-button>
          <s-button
            type="submit"
            variant="primary"
            loading={isSubmitting || undefined}
          >
            {submitLabel}
          </s-button>
        </s-stack>
      </s-stack>
    </Form>
  );
}