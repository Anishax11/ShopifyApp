import { useEffect, useState } from "react";
import { Form } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const name = formData.get("name");
  const game = formData.get("game");
  const theme = formData.get("theme");
  const placement = formData.get("placement");
  const status = formData.get("status");
  const rewardCount = Number(formData.get("rewardCount"));
  // Validate campaign details before writing to the database.
  const campaignName = String(name ?? "").trim();
  const campaignGame = String(game ?? "");
  const campaignTheme = String(theme ?? "");
  const campaignPlacement = String(placement ?? "");
  const campaignStatus = String(status ?? "");

  if (!campaignName || campaignName.length > 100) {
    return Response.json(
      { error: "Campaign name must be between 1 and 100 characters." },
      { status: 400 },
    );
  }

  if (campaignGame !== "spin") {
    return Response.json(
      { error: "Unsupported game type." },
      { status: 400 },
    );
  }

  if (!campaignTheme || !campaignPlacement || !campaignStatus) {
    return Response.json(
      { error: "Theme, placement, and status are required." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(rewardCount) || rewardCount < 2 || rewardCount > 5) {
    return Response.json(
      { error: "A wheel must have between 2 and 5 rewards." },
      { status: 400 },
    );
  }
  const rewards = [];
  for (let i = 0; i < rewardCount; i++) {
    const rawReward = formData.get(`reward-${i}`);
    const rawDiscountValue = formData.get(`discountValue-${i}`);

    const reward = String(rawReward ?? "").trim();

    if (!reward || reward.length > 80) {
      return Response.json(
        {
          error: `Reward ${i + 1} must have a label between 1 and 80 characters.`,
        },
        { status: 400 },
      );
    }

    if (
      typeof rawDiscountValue !== "string" ||
      rawDiscountValue.trim() === ""
    ) {
      return Response.json(
        { error: `Reward ${i + 1} is missing its discount value.` },
        { status: 400 },
      );
    }

    const discountValue = Number(rawDiscountValue);

    if (
      !Number.isFinite(discountValue) ||
      discountValue < 0 ||
      discountValue > 100 ||
      (discountValue > 0 && discountValue < 1)
    ) {
      return Response.json(
        {
          error: `Reward ${i + 1} must have a discount value of 0 or between 1 and 100.`,
        },
        { status: 400 },
      );
    }

    rewards.push({
      reward,
      discountType: "percentage",
      discountValue,
      position: i,
    });
  }

  
  
  
  const campaign = await prisma.campaign.create({
    data: {
      shop: session.shop,
      name: campaignName,
      game: campaignGame,
      theme: campaignTheme,
      placement: campaignPlacement,
      status: campaignStatus,
      rewardCount,
      rewards: {
        create: rewards,
      },
    },
  });

  return { success: true, campaign };
};

export default function NewCampaign() {
  const [game, setGame] = useState("spin");
  const [rewardCount, setRewardCount] = useState(3);
  const [rewards, setRewards] = useState(["", "", ""]);
  const [discountValues, setDiscountValues] = useState([10, 15, 20]);
  useEffect(() => {
    setRewards((currentRewards) => {
      if (currentRewards.length < rewardCount) {
        return [
          ...currentRewards,
          ...Array(rewardCount - currentRewards.length).fill(""),
        ];
      }
  
      return currentRewards.slice(0, rewardCount);
    });
  
    setDiscountValues((currentValues) => {
      if (currentValues.length < rewardCount) {
        return [
          ...currentValues,
          ...Array(rewardCount - currentValues.length).fill(10),
        ];
      }
  
      return currentValues.slice(0, rewardCount);
    });
  }, [rewardCount]);

  const rewardLimits = {
    spin: { min: 3, max: 5 },
    scratch: { min: 1, max: 1 },
    mystery: { min: 1, max: 1 },
    quiz: { min: 1, max: 1 },
  };
  const currentLimits = rewardLimits[game as keyof typeof rewardLimits];
  
  return (
    
    <s-page heading="Create Campaign">
      <Form method="post">
        <s-section heading="Campaign Details">
          <s-stack direction="block" gap="base">
          <s-text-field
            label="Campaign name"
            name="name"
            placeholder="e.g. Halloween Mystery Pumpkin"
          />

            <s-select
              label="Game"
              name="game"
              value={game}
              onChange={(event) => setGame(event.currentTarget.value)}
            >
            <s-option value="spin">Spin the Wheel</s-option>
            <s-option value="scratch">Scratch Card</s-option>
            <s-option value="mystery">Mystery Box</s-option>
            <s-option value="quiz">Quiz</s-option>
            </s-select>

            <s-select label="Theme" name="theme">
              <s-option value="none">No Theme</s-option>
              <s-option value="halloween">🎃 Halloween</s-option>
              <s-option value="christmas">🎄 Christmas</s-option>
              <s-option value="diwali">🪔 Diwali</s-option>
              <s-option value="valentines">💗 Valentine's Day</s-option>
              <s-option value="black-friday">🛍️ Black Friday</s-option>
              <s-option value="new-year">🎉 New Year</s-option>
              <s-option value="summer">☀️ Summer Sale</s-option>
            </s-select>

            <s-select
              label="Number of Rewards"
              name="rewardCount"
              value={String(rewardCount)}
              onChange={(event) =>
                setRewardCount(Number(event.currentTarget.value))
              }
            >
            {Array.from(
              {
                length: currentLimits.max - currentLimits.min + 1,
              },
              (_, index) => {
                const count = currentLimits.min + index;

                return (
                  <s-option key={count} value={String(count)}>
                    {count}
                  </s-option>
                );
              },
            )}
          </s-select>

          <s-section heading="Reward Outcomes">
          <s-stack direction="block" gap="base">
            
            {rewards.slice(0, rewardCount).map((reward, index) => (
              <s-stack key={index} direction="block" gap="base">
                <s-text-field
                  name={`reward-${index}`}
                  label={`Reward ${index + 1} label`}
                  value={reward}
                  onChange={(event) => {
                    const newRewards = [...rewards];
                    newRewards[index] = event.currentTarget.value;
                    setRewards(newRewards);
                  }}
                />

                <s-number-field
                  name={`discountValue-${index}`}
                  label="Discount value (%)"
                  value={String(discountValues[index] ?? 10)}
                  min={1}
                  max={100}
                  onChange={(event) => {
                    const newValues = [...discountValues];
                    newValues[index] = Number(event.currentTarget.value);
                    setDiscountValues(newValues);
                  }}
                />
              </s-stack>
            ))}
                        
          </s-stack>
          </s-section>

            <s-select label="Placement" name="placement">
                <s-option value="popup">Storefront Popup</s-option>
                <s-option value="banner">Storefront Banner</s-option>
                <s-option value="inline">Inline on Storefront</s-option>
              </s-select>
              <s-select label="Status" name ="status">
              <s-option value="draft">Draft</s-option>
              <s-option value="active">Active</s-option>
            </s-select>
            </s-stack>

            
          </s-section>


        <s-section>
        <s-button type="submit" variant="primary">
          Create Campaign
        </s-button>
        </s-section>
      </Form>
    </s-page>
  );
}