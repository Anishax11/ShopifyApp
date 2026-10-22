import prisma from "../db.server";
import {
  MAX_REWARDS,
  MIN_REWARDS,
  PLACEMENTS,
  THEMES,
  rewardLabel,
} from "../utils/campaign";

export type CampaignInput = {
  name: string;
  theme: string;
  placement: string;
  status: "draft" | "active";
  discountValues: number[];
};

export type FormErrors = {
  name?: string;
  rewards?: Record<number, string>;
  form?: string;
};

/* ------------------------------ Validation ------------------------------ */

export function parseCampaignForm(
  formData: FormData,
): { input: CampaignInput } | { errors: FormErrors } {
  const errors: FormErrors = {};

  const name = String(formData.get("name") ?? "").trim();
  const theme = String(formData.get("theme") ?? "");
  const placement = String(formData.get("placement") ?? "");
  const status = String(formData.get("status") ?? "");
  const rewardCount = Number(formData.get("rewardCount"));

  if (!name) errors.name = "Give your campaign a name.";
  else if (name.length > 100)
    errors.name = "Campaign name must be 100 characters or fewer.";

  if (!THEMES.some((t) => t.value === theme))
    errors.form = "Please choose a valid theme.";
  if (!PLACEMENTS.some((p) => p.value === placement))
    errors.form = "Please choose a valid placement.";
  if (!["draft", "active"].includes(status))
    errors.form = "Status must be either draft or active.";

  if (
    !Number.isInteger(rewardCount) ||
    rewardCount < MIN_REWARDS ||
    rewardCount > MAX_REWARDS
  ) {
    errors.form = `A wheel needs between ${MIN_REWARDS} and ${MAX_REWARDS} rewards.`;
    return { errors };
  }

  const rewardErrors: Record<number, string> = {};
  const discountValues: number[] = [];

  for (let i = 0; i < rewardCount; i++) {
    const raw = formData.get(`discountValue-${i}`);
    const value = Number(raw);

    if (
      typeof raw !== "string" ||
      raw.trim() === "" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100 ||
      (value > 0 && value < 1)
    ) {
      rewardErrors[i] = "Enter 0 (no discount) or a value from 1 to 100.";
    }
    discountValues.push(value);
  }

  if (Object.keys(rewardErrors).length) errors.rewards = rewardErrors;

  if (Object.keys(errors).length) return { errors };

  return {
    input: {
      name,
      theme,
      placement,
      status: status as "draft" | "active",
      discountValues,
    },
  };
}

// Labels are generated here so the client can never submit custom text.
function buildRewards(discountValues: number[]) {
  return discountValues.map((value, position) => ({
    reward: rewardLabel(value),
    discountType: "percentage",
    discountValue: value,
    position,
  }));
}

/* --------------------------------- Create -------------------------------- */

export async function createCampaign(shop: string, input: CampaignInput) {
  return prisma.$transaction(async (tx) => {
    // Only one active Spin campaign per shop.
    if (input.status === "active") {
      await tx.campaign.updateMany({
        where: { shop, game: "spin", status: "active" },
        data: { status: "draft" },
      });
    }

    return tx.campaign.create({
      data: {
        shop,
        name: input.name,
        game: "spin",
        theme: input.theme,
        placement: input.placement,
        status: input.status,
        rewardCount: input.discountValues.length,
        rewards: { create: buildRewards(input.discountValues) },
      },
    });
  });
}

/* --------------------------------- Update -------------------------------- */

type Result = { ok: true } | { ok: false; error: string };

export async function updateCampaign(
  shop: string,
  id: string,
  input: CampaignInput,
): Promise<Result> {
  const existing = await prisma.campaign.findFirst({
    where: { id, shop },
    include: { rewards: { orderBy: { position: "asc" } } },
  });
  if (!existing) return { ok: false, error: "Campaign not found." };

  const newRewards = buildRewards(input.discountValues);

  // Rewards are updated in place (matched by position) so past spins keep
  // pointing at a valid reward row.
  const toUpdate = newRewards
    .filter((r) => existing.rewards.some((e) => e.position === r.position))
    .map((r) => ({
      where: { id: existing.rewards.find((e) => e.position === r.position)!.id },
      data: {
        reward: r.reward,
        discountType: r.discountType,
        discountValue: r.discountValue,
      },
    }));

  const toCreate = newRewards.filter(
    (r) => !existing.rewards.some((e) => e.position === r.position),
  );

  try {
    await prisma.$transaction(async (tx) => {
      if (input.status === "active") {
        await tx.campaign.updateMany({
          where: { shop, game: "spin", status: "active", id: { not: id } },
          data: { status: "draft" },
        });
      }

      await tx.campaign.update({
        where: { id },
        data: {
          name: input.name,
          theme: input.theme,
          placement: input.placement,
          status: input.status,
          rewardCount: newRewards.length,
          rewards: {
            update: toUpdate,
            create: toCreate,
            deleteMany: { position: { gte: newRewards.length } },
          },
        },
      });
    });
    return { ok: true };
  } catch (error) {
    console.error("Campaign update failed:", error);
    return {
      ok: false,
      error:
        "Couldn't save changes. If you reduced the number of rewards, note that rewards customers have already won can't be removed. Keep the same number of rewards or create a new campaign.",
    };
  }
}

/* ---------------------------- Status (activate) --------------------------- */

export async function setCampaignStatus(
  shop: string,
  id: string,
  status: string,
): Promise<Result> {
  if (!["draft", "active"].includes(status))
    return { ok: false, error: "Invalid status." };

  const existing = await prisma.campaign.findFirst({ where: { id, shop } });
  if (!existing) return { ok: false, error: "Campaign not found." };

  await prisma.$transaction(async (tx) => {
    if (status === "active") {
      await tx.campaign.updateMany({
        where: { shop, game: "spin", status: "active", id: { not: id } },
        data: { status: "draft" },
      });
    }
    await tx.campaign.update({ where: { id }, data: { status } });
  });
  return { ok: true };
}

/* --------------------------------- Delete -------------------------------- */

export async function deleteCampaign(
  shop: string,
  id: string,
): Promise<Result> {
  const existing = await prisma.campaign.findFirst({ where: { id, shop } });
  if (!existing) return { ok: false, error: "Campaign not found." };

  // A live campaign is on the storefront, so take it down first.
  if (existing.status === "active") {
    return {
      ok: false,
      error: "This campaign is live. Set it to draft before deleting it.",
    };
  }

  // Spins that still need verification carry recovery info; keep them.
  const unresolved = await prisma.spin.count({
    where: {
      shop,
      campaignId: id,
      status: { in: ["pending", "recovery_required"] },
    },
  });
  if (unresolved > 0) {
    return {
      ok: false,
      error: `${unresolved} spin${unresolved === 1 ? " is" : "s are"} still pending or need verification. Resolve ${unresolved === 1 ? "it" : "them"} before deleting this campaign.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Spins first: Spin -> CampaignReward is onDelete: Restrict.
      await tx.spin.deleteMany({ where: { shop, campaignId: id } });
      await tx.campaign.update({
        where: { id },
        data: { rewards: { deleteMany: {} } },
      });
      await tx.campaign.delete({ where: { id } });
    });
    return { ok: true };
  } catch (error) {
    console.error("Campaign delete failed:", error);
    return { ok: false, error: "Couldn't delete the campaign. Try again." };
  }
}