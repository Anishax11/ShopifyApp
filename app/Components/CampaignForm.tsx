import { useState } from "react";
import { Form } from "react-router";
import {
  DEFAULT_DISCOUNTS,
  MAX_REWARDS,
  MIN_REWARDS,
  PLACEMENTS,
  STATUSES,
  THEMES,
  rewardLabel,
} from "../utils/campaign";
import type { FormErrors } from "../models/campaign.server";

export type CampaignFormValues = {
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
  const [rewardCount, setRewardCount] = useState(initial.discountValues.length);
  // Always keep MAX_REWARDS slots so changing the count never loses values.
  const [discounts, setDiscounts] = useState<number[]>(() =>
    Array.from(
      { length: MAX_REWARDS },
      (_, i) => initial.discountValues[i] ?? DEFAULT_DISCOUNTS[i] ?? 10,
    ),
  );

  const visible = discounts.slice(0, rewardCount);
  const hasFieldErrors = Boolean(errors?.name || errors?.rewards);

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="save" />
      <input type="hidden" name="game" value="spin" />

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