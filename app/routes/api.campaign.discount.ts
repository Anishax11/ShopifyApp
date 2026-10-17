import type { ActionFunctionArgs } from "react-router";
import { randomBytes, randomInt } from "node:crypto";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 },
    );
  }

  const { session, admin } =
    await authenticate.public.appProxy(request);

  if (!session || !admin) {
    return Response.json(
      { error: "Unable to authenticate this shop" },
      { status: 401 },
    );
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      shop: session.shop,
      status: "active",
      game: "spin",
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      rewards: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  
  if (!campaign || campaign.rewards.length === 0) {
    return Response.json(
      { error: "No active wheel campaign found" },
      { status: 404 },
    );
  }

  // Validate the saved campaign configuration before issuing a reward.
  const validRewardCount =
    Number.isInteger(campaign.rewardCount) &&
    campaign.rewardCount >= 2 &&
    campaign.rewardCount <= 12;

  const validRewardConfiguration =
    validRewardCount &&
    campaign.rewards.length === campaign.rewardCount &&
    campaign.rewards.every((reward, index) => {
      const validLabel =
        typeof reward.reward === "string" &&
        reward.reward.trim().length > 0 &&
        reward.reward.length <= 80;

      const validPosition = reward.position === index;

      const validDiscount =
        reward.discountType === "percentage" &&
        Number.isFinite(reward.discountValue) &&
        (
          reward.discountValue === 0 ||
          (
            reward.discountValue >= 1 &&
            reward.discountValue <= 100
          )
        );

      return validLabel && validPosition && validDiscount;
    });

  if (!validRewardConfiguration) {
    console.error("Invalid reward configuration for campaign:", campaign.id);

    return Response.json(
      { error: "This campaign has an invalid reward configuration." },
      { status: 422 },
    );
  }


  // The server chooses the winning reward.
  const winningIndex = randomInt(0, campaign.rewards.length);

  const winningReward = campaign.rewards[winningIndex];

  // A zero-value reward, such as TRY AGAIN, needs no discount code.
  if (winningReward.discountValue === 0) {
    return Response.json({
      reward: winningReward.reward,
      position: winningReward.position,
      code: null,
    });
  }

  // Validate the saved reward before creating a discount.
  if (
    winningReward.discountType !== "percentage" ||
    !Number.isFinite(winningReward.discountValue) ||
    winningReward.discountValue < 1 ||
    winningReward.discountValue > 100
  ) {
    return Response.json(
      { error: "Invalid reward configuration" },
      { status: 422 },
    );
  }

  const code = `SG-${randomBytes(8).toString("hex").toUpperCase()}`;

  const response = await admin.graphql(
    `#graphql
      mutation CreateWheelDiscount(
        $basicCodeDiscount: DiscountCodeBasicInput!
      ) {
        discountCodeBasicCreate(
          basicCodeDiscount: $basicCodeDiscount
        ) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        basicCodeDiscount: {
          title: `${campaign.name} - ${winningReward.reward}`,
          code,
          startsAt: new Date().toISOString(),
          customerSelection: {
            all: true,
          },
          customerGets: {
            value: {
              percentage: winningReward.discountValue / 100,
            },
            items: {
              all: true,
            },
          },
          usageLimit: 1,
          appliesOncePerCustomer: true,
        },
      },
    },
  );

  const result = await response.json();
  const creation = result.data?.discountCodeBasicCreate;

  if (result.errors?.length || creation?.userErrors?.length) {
    console.error(
      "Shopify discount creation failed:",
      result.errors ?? creation?.userErrors,
    );

    return Response.json(
      { error: "Could not create the discount code" },
      { status: 502 },
    );
  }

  const createdCode =
    creation?.codeDiscountNode?.codeDiscount?.codes?.nodes?.[0]?.code;

  if (!createdCode) {
    return Response.json(
      { error: "Shopify did not return a discount code" },
      { status: 502 },
    );
  }

  return Response.json({
    reward: winningReward.reward,
    position: winningReward.position,
    code: createdCode,
  });
};
