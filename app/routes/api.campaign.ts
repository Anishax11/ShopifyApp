import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

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

  if (!campaign) {
    return Response.json({ campaign: null });
  }
  

  return Response.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      game: campaign.game,
      theme: campaign.theme,
      rewards: campaign.rewards.map((reward) => reward.reward),
    },
  });
};