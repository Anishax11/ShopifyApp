import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  deleteCampaign,
  setCampaignStatus,
} from "../models/campaign.server";
import { PLACEMENTS, THEMES, labelFor } from "../utils/campaign";

/* --------------------------------- Loader -------------------------------- */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [campaigns, spins] = await Promise.all([
    prisma.campaign.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
    }),
    prisma.spin.findMany({
      where: { shop: session.shop },
      select: {
        status: true,
        campaignId: true,
        reward: { select: { reward: true } },
      },
    }),
  ]);

  const analytics = {
    totalSpins: spins.length,
    discountsIssued: spins.filter((s) => s.status === "issued").length,
    noDiscountSpins: spins.filter((s) => s.status === "no_discount").length,
    unresolvedSpins: spins.filter(
      (s) => s.status === "pending" || s.status === "recovery_required",
    ).length,
    failedSpins: spins.filter((s) => s.status === "failed").length,
  };

  // Spins per campaign (used on cards and to explain why delete is blocked).
  const spinsByCampaign: Record<string, number> = {};
  const rewardCounts = new Map<string, number>();
  for (const spin of spins) {
    spinsByCampaign[spin.campaignId] =
      (spinsByCampaign[spin.campaignId] ?? 0) + 1;
    const label = spin.reward.reward;
    rewardCounts.set(label, (rewardCounts.get(label) ?? 0) + 1);
  }

  const rewardBreakdown = Array.from(rewardCounts.entries())
    .map(([reward, count]) => ({ reward, count }))
    .sort((a, b) => b.count - a.count);

  return {
    campaigns: campaigns.map((c) => ({
      ...c,
      spinCount: spinsByCampaign[c.id] ?? 0,
    })),
    analytics,
    rewardBreakdown,
  };
};

/* --------------------------------- Action -------------------------------- */

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const id = String(formData.get("id") ?? "");

  if (!id) return { ok: false as const, message: "Missing campaign." };

  if (intent === "delete") {
    const result = await deleteCampaign(session.shop, id);
    return result.ok
      ? { ok: true as const, message: "Campaign deleted" }
      : { ok: false as const, message: result.error };
  }

  if (intent === "setStatus") {
    const status = String(formData.get("status") ?? "");
    const result = await setCampaignStatus(session.shop, id, status);
    return result.ok
      ? {
          ok: true as const,
          message:
            status === "active" ? "Campaign is now live" : "Campaign set to draft",
        }
      : { ok: false as const, message: result.error };
  }

  return { ok: false as const, message: "Unknown action." };
};

/* ------------------------------- Components ------------------------------ */

type CampaignRow = ReturnType<typeof useLoaderData<typeof loader>>["campaigns"][number];

function CampaignCard({ campaign }: { campaign: CampaignRow }) {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const isActive = campaign.status === "active";
  const busy = fetcher.state !== "idle";
  const modalId = `delete-${campaign.id}`;

  // Give feedback for every action result.
  useEffect(() => {
    if (!fetcher.data) return;
    shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);

  const toggleStatus = () =>
    fetcher.submit(
      {
        intent: "setStatus",
        id: campaign.id,
        status: isActive ? "draft" : "active",
      },
      { method: "post" },
    );

  const remove = () =>
    fetcher.submit({ intent: "delete", id: campaign.id }, { method: "post" });

  return (
    <s-section heading={campaign.name}>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-badge tone={isActive ? "success" : "neutral"}>
            {isActive ? "Active" : "Draft"}
          </s-badge>
          <s-badge>{labelFor(THEMES, campaign.theme)}</s-badge>
          <s-badge>{labelFor(PLACEMENTS, campaign.placement)}</s-badge>
        </s-stack>

        <s-text color="subdued">
          Spin the Wheel · {campaign.rewardCount} rewards · {campaign.spinCount}{" "}
          {campaign.spinCount === 1 ? "spin" : "spins"}
        </s-text>

        <s-stack direction="inline" gap="small">
          <s-button href={`/app/campaigns/${campaign.id}`} disabled={busy || undefined}>
            Edit
          </s-button>
          <s-button onClick={toggleStatus} loading={busy || undefined}>
            {isActive ? "Set to draft" : "Activate"}
          </s-button>
          <s-button
            tone="critical"
            commandFor={modalId}
            command="--show"
            disabled={busy || undefined}
          >
            Delete
          </s-button>
        </s-stack>
      </s-stack>

      <s-modal id={modalId} heading="Delete this campaign?">
        {isActive ? (
          <s-paragraph>
            “{campaign.name}” is live on your storefront. Set it to draft
            before deleting it.
          </s-paragraph>
        ) : (
          <s-paragraph>
            “{campaign.name}” will be permanently deleted
            {campaign.spinCount > 0
              ? `, along with its ${campaign.spinCount} recorded spin${campaign.spinCount === 1 ? "" : "s"} (they'll disappear from your analytics). Discount codes already issued to customers are not removed from Shopify.`
              : "."}{" "}
            This can’t be undone.
          </s-paragraph>
        )}
        <s-button
          slot="secondary-actions"
          commandFor={modalId}
          command="--hide"
        >
          {isActive ? "Close" : "Cancel"}
        </s-button>
        {!isActive && (
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            commandFor={modalId}
            command="--hide"
            onClick={remove}
          >
            Delete campaign
          </s-button>
        )}
      </s-modal>
    </s-section>
  );
}

/* ---------------------------------- Page --------------------------------- */

const SAVED_MESSAGES: Record<string, string> = {
  created: "Campaign created",
  updated: "Changes saved",
  deleted: "Campaign deleted",
};

export default function Index() {
  const { campaigns, analytics, rewardBreakdown } =
    useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Toast after redirects from the create/edit pages, then clean the URL.
  const saved = searchParams.get("saved");
  useEffect(() => {
    if (saved && SAVED_MESSAGES[saved]) {
      shopify.toast.show(SAVED_MESSAGES[saved]);
      setSearchParams({}, { replace: true });
    }
  }, [saved, shopify, setSearchParams]);

  const needsAttention = analytics.unresolvedSpins + analytics.failedSpins;

  return (
    <s-page heading="Seasonal Games">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/campaigns/new")}
      >
        Create campaign
      </s-button>

      {/* Campaigns first: it's what merchants come here to manage. */}
      {campaigns.length === 0 ? (
        <s-section heading="Create your first campaign">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Turn promotions into experiences. Add a spin-the-wheel game to
              your storefront and reward customers with discounts.
            </s-paragraph>
            <s-stack direction="inline">
              <s-button
                variant="primary"
                onClick={() => navigate("/app/campaigns/new")}
              >
                Create campaign
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>
      ) : (
        campaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))
      )}

      <s-section heading="Campaign analytics">
        <s-stack direction="block" gap="base">
          <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
            <s-box border="base" padding="base" borderRadius="base">
              <s-text color="subdued">Total spins</s-text>
              <s-heading>{analytics.totalSpins}</s-heading>
            </s-box>
            <s-box border="base" padding="base" borderRadius="base">
              <s-text color="subdued">Discounts issued</s-text>
              <s-heading>{analytics.discountsIssued}</s-heading>
            </s-box>
            <s-box border="base" padding="base" borderRadius="base">
              <s-text color="subdued">No-discount outcomes</s-text>
              <s-heading>{analytics.noDiscountSpins}</s-heading>
            </s-box>
            <s-box border="base" padding="base" borderRadius="base">
              <s-text color="subdued">Needs attention</s-text>
              <s-heading>{needsAttention}</s-heading>
            </s-box>
          </s-grid>

          {needsAttention > 0 && (
            <s-banner tone="warning" heading="Some spins need your attention">
              <s-paragraph>
                {analytics.unresolvedSpins > 0 &&
                  `${analytics.unresolvedSpins} spin(s) are pending or need verification. `}
                {analytics.failedSpins > 0 &&
                  `${analytics.failedSpins} spin(s) failed.`}
              </s-paragraph>
            </s-banner>
          )}

          <s-heading>Rewards won</s-heading>
          {rewardBreakdown.length === 0 ? (
            <s-paragraph>
              No spins yet. Analytics will appear when customers start playing.
            </s-paragraph>
          ) : (
            rewardBreakdown.map((item) => (
              <s-paragraph key={item.reward}>
                {item.reward}: {item.count} {item.count === 1 ? "spin" : "spins"}
              </s-paragraph>
            ))
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};