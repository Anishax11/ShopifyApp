import type { ActionFunctionArgs } from "react-router";
import { randomBytes, randomInt } from "node:crypto";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";


function existingSpinResponse(spin: {
  status: string;
  reward: { reward: string; position: number };
  discountCode: string | null;
}) {
  if (spin.status === "issued" && spin.discountCode) {
    return Response.json({
      reward: spin.reward.reward,
      position: spin.reward.position,
      code: spin.discountCode,
    });
  }

  if (spin.status === "no_discount") {
    return Response.json({
      reward: spin.reward.reward,
      position: spin.reward.position,
      code: null,
    });
  }

  if (spin.status === "pending") {
    return Response.json(
      { error: "This spin is still being processed. Please wait." },
      { status: 409 },
    );
  }

  return Response.json(
    { error: "This spin could not be completed. Start a new spin." },
    { status: 409 },
  );
}


const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_SPINS_PER_SHOP_PER_WINDOW = 30;

async function consumeShopSpinAllowance(shop: string) {
  const now = Date.now();

  // Put requests into fixed, one-minute windows.
  const windowStart = new Date(
    Math.floor(now / RATE_LIMIT_WINDOW_MS) *
      RATE_LIMIT_WINDOW_MS,
  );

  // Atomically create or increment this shop's counter.
  const bucket = await prisma.spinRateLimit.upsert({
    where: {
      shop_windowStart: {
        shop,
        windowStart,
      },
    },
    create: {
      shop,
      windowStart,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
  });

  const windowEndsAt =
    windowStart.getTime() + RATE_LIMIT_WINDOW_MS;

  return {
    allowed: bucket.count <= MAX_SPINS_PER_SHOP_PER_WINDOW,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((windowEndsAt - Date.now()) / 1000),
    ),
  };
}


export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 },
    );
  }

  const { session, admin } =
  await authenticate.public.appProxy(request);
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!session || !admin) {
    return Response.json(
      { error: "Unable to authenticate this shop" },
      { status: 401 },
    );
  }

  const validKey =
    typeof idempotencyKey === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idempotencyKey,
    );

  if (!validKey) {
    return Response.json(
      { error: "A valid spin request key is required." },
      { status: 400 },
    );
  }
  const normalizedIdempotencyKey = idempotencyKey!.toLowerCase();
  const existingSpin = await prisma.spin.findUnique({
    where: {
      shop_idempotencyKey: {
        shop: session.shop,
        idempotencyKey: normalizedIdempotencyKey,
      },
    },
    include: {
      reward: true,
    },
  });

  
if (existingSpin) {
  if (
    existingSpin.status === "pending" &&
    existingSpin.reward.discountValue === 0
  ) {
    const recoveredSpin = await prisma.spin.update({
      where: { id: existingSpin.id },
      data: {
        status: "no_discount",
        error: null,
      },
      include: {
        reward: true,
      },
    });
  
    return existingSpinResponse(recoveredSpin);
  }
  const needsRecovery =
    existingSpin.status === "pending" ||
    existingSpin.status === "recovery_required";

  if (
    needsRecovery &&
    existingSpin.requestedDiscountCode
  ) {
    try {
      const response = await admin.graphql(
        `#graphql
          query FindWheelDiscount($code: String!) {
            codeDiscountNodeByCode(code: $code) {
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
          }
        `,
        {
          variables: {
            code: existingSpin.requestedDiscountCode,
          },
        },
      );

      const result = await response.json();

      if (result.errors?.length) {
        throw new Error("Shopify discount lookup returned errors");
      }

      const node = result.data?.codeDiscountNodeByCode;
      const recoveredCode =
        node?.codeDiscount?.codes?.nodes?.[0]?.code;

      if (node?.id && recoveredCode) {
        const recoveredSpin = await prisma.spin.update({
          where: { id: existingSpin.id },
          data: {
            status: "issued",
            discountCode: recoveredCode,
            shopifyDiscountId: node.id,
            error: null,
          },
          include: {
            reward: true,
          },
        });

        return existingSpinResponse(recoveredSpin);
      }

      // Not found does NOT prove the original creation failed.
      return Response.json(
        {
          error:
            "This spin is still being verified. Please try again shortly.",
        },
        { status: 503 },
      );
    } catch (error) {
      console.error("Spin recovery lookup failed:", error);

      return Response.json(
        {
          error:
            "This spin is still being verified. Please try again shortly.",
        },
        { status: 503 },
      );
    }
  }

  return existingSpinResponse(existingSpin);
}



  
  
let allowance;

try {
  allowance = await consumeShopSpinAllowance(session.shop);
} catch (error) {
  console.error("Spin rate limit check failed:", error);

  // Fail closed: don't issue a reward if the limit
  // cannot be checked reliably.
  return Response.json(
    { error: "Spin service temporarily unavailable. Please try again." },
    { status: 503 },
  );
}

if (!allowance.allowed) {
  return Response.json(
    {
      error: "Too many spin attempts. Please try again shortly.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(allowance.retryAfterSeconds),
      },
    },
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
  
  // Validate the selected reward before creating a spin record.
  if (
    winningReward.discountType !== "percentage" ||
    !Number.isFinite(winningReward.discountValue) ||
    winningReward.discountValue < 0 ||
    winningReward.discountValue > 100
  ) {
    return Response.json(
      { error: "Invalid reward configuration" },
      { status: 422 },
    );
  }

  const code =
  winningReward.discountValue > 0
    ? `SG-${randomBytes(8).toString("hex").toUpperCase()}`
    : null;
  let spin;
  
  
try {
  spin = await prisma.spin.create({
    data: {
      shop: session.shop,
      campaignId: campaign.id,
      campaignRewardId: winningReward.id,
      idempotencyKey: normalizedIdempotencyKey,
      status: "pending",
      requestedDiscountCode: code,
    },
  });
} catch (error) {
  // Another simultaneous request may have created this key first.
  const duplicateSpin = await prisma.spin.findUnique({
    where: {
      shop_idempotencyKey: {
        shop: session.shop,
        idempotencyKey: normalizedIdempotencyKey,
      },
    },
    include: {
      reward: true,
    },
  });

  if (duplicateSpin) {
    return existingSpinResponse(duplicateSpin);
  }

  // This was not a duplicate-key collision.
  throw error;
}


  // A zero-value reward, such as TRY AGAIN, needs no discount code.
  
  if (winningReward.discountValue === 0) {
    await prisma.spin.update({
      where: { id: spin.id },
      data: { status: "no_discount" },
    });

    return Response.json({
      reward: winningReward.reward,
      position: winningReward.position,
      code: null,
    });
  }

  
  let result: any;
  let creation: any;

  try {
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
            code: code!,
            startsAt: new Date().toISOString(),
            customerSelection: { all: true },
            customerGets: {
              value: {
                percentage: winningReward.discountValue / 100,
              },
              items: { all: true },
            },
            usageLimit: 1,
            appliesOncePerCustomer: true,
          },
        },
      },
    );

    result = await response.json();
    creation = result.data?.discountCodeBasicCreate;
  } catch (error) {
    console.error("Discount creation outcome is uncertain:", error);

    await prisma.spin.update({
      where: { id: spin.id },
      data: {
        status: "recovery_required",
        error: "Shopify discount creation outcome is uncertain",
      },
    });

    return Response.json(
      {
        error: "Your spin is being checked. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  // Shopify returned a response, but GraphQL errors may still be ambiguous.
  if (result.errors?.length) {
    console.error("Shopify GraphQL errors:", result.errors);

    await prisma.spin.update({
      where: { id: spin.id },
      data: {
        status: "recovery_required",
        error: "Shopify returned an uncertain GraphQL result",
      },
    });

    return Response.json(
      { error: "Your spin is being checked. Please try again shortly." },
      { status: 503 },
    );
  }

  // Explicit Shopify userErrors indicate that creation was rejected.
  if (creation?.userErrors?.length) {
    console.error("Shopify rejected discount creation:", creation.userErrors);

    await prisma.spin.update({
      where: { id: spin.id },
      data: {
        status: "failed",
        error: "Shopify rejected discount creation",
      },
    });

    return Response.json(
      { error: "Could not create the discount code" },
      { status: 502 },
    );
  }

  const createdCode =
    creation?.codeDiscountNode?.codeDiscount?.codes?.nodes?.[0]?.code;

  const discountId = creation?.codeDiscountNode?.id;

  // Missing expected data is not proof that creation failed.
  if (!createdCode || !discountId) {
    await prisma.spin.update({
      where: { id: spin.id },
      data: {
        status: "recovery_required",
        error: "Shopify response did not contain the expected discount data",
      },
    });

    return Response.json(
      { error: "Your spin is being checked. Please try again shortly." },
      { status: 503 },
    );
  }


  try {
    await prisma.spin.update({
      where: { id: spin.id },
      data: {
        status: "issued",
        discountCode: createdCode,
        shopifyDiscountId: discountId,
        error: null,
      },
    });
  } catch (error) {
    console.error("Failed to save issued spin:", error);
  
    // Shopify has already created the discount.
    // Keep the original requestedDiscountCode so a retry can recover it.
    return Response.json(
      {
        error:
          "Your discount was created, but we couldn't confirm the result. Please retry shortly.",
      },
      { status: 503 },
    );
  }
  
  return Response.json({
    reward: winningReward.reward,
    position: winningReward.position,
    code: createdCode,
  });

};