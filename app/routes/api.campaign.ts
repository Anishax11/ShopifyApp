import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  hasAlreadyPlayed,
  normalizePlayLimit,
  resolvePlayer,
  storefrontSettings,
} from "../models/play-limit.server";

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

  // Per-visitor responses must never be cached or shared.
  const headers = { "Cache-Control": "no-store" };

  if (!campaign) {
    return Response.json({ campaign: null }, { headers });
  }

  // Tells the storefront whether this visitor can still spin. This is a
  // convenience for the UI: /discount re-checks it and is the real enforcement.
  let canPlay = true;
  try {
    canPlay = !(await hasAlreadyPlayed(
      campaign.id,
      normalizePlayLimit(campaign.playLimit),
      resolvePlayer(request),
    ));
  } catch (error) {
    console.error("Play eligibility check failed:", error);
  }

  // A problem with the new settings must never hide the campaign itself:
  // fall back to the behaviour existing campaigns have always had.
  let settings;
  try {
    settings = storefrontSettings(campaign);
  } catch (error) {
    console.error("Campaign settings could not be read:", error);
    settings = {
      trigger: { type: "time_delay", delaySeconds: 3, scrollDepthPercent: 50 },
      frequency: { mode: "every_visit", cooldownDays: 7 },
      playLimit: "unlimited",
      device: "all",
    };
  }

  return Response.json(
    {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        game: campaign.game,
        theme: campaign.theme,
        placement: campaign.placement || "inline",
        rewards: campaign.rewards.map((reward) => reward.reward),
        settings,
        canPlay,
      },
    },
    { headers },
  );
};