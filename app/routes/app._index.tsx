import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Link } from "react-router";
import NewCampaign from "./app.campaigns.new";


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [campaigns, spins] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        shop: session.shop,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),

    prisma.spin.findMany({
      where: {
        shop: session.shop,
      },
      select: {
        status: true,
        campaignId: true,
        reward: {
          select: {
            reward: true,
          },
        },
      },
    }),
  ]);

  const analytics = {
    totalSpins: spins.length,
    discountsIssued: spins.filter(
      (spin) => spin.status === "issued",
    ).length,
    noDiscountSpins: spins.filter(
      (spin) => spin.status === "no_discount",
    ).length,
    unresolvedSpins: spins.filter(
      (spin) =>
        spin.status === "pending" ||
        spin.status === "recovery_required",
    ).length,
    failedSpins: spins.filter(
      (spin) => spin.status === "failed",
    ).length,
  };

  const rewardCounts = new Map<
    string,
    { reward: string; count: number }
  >();

  for (const spin of spins) {
    const key = `${spin.campaignId}:${spin.reward.reward}`;
    const existing = rewardCounts.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      rewardCounts.set(key, {
        reward: spin.reward.reward,
        count: 1,
      });
    }
  }

  const rewardBreakdown = Array.from(rewardCounts.values()).sort(
    (a, b) => b.count - a.count,
  );

  return {
    campaigns,
    analytics,
    rewardBreakdown,
  };
};


export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            titlei
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
            demoInfo: metafield(namespace: "$app", key: "demo_info") {
              jsonValue
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
          metafields: [
            {
              namespace: "$app",
              key: "demo_info",
              value: "Created by React Router Template",
            },
          ],
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  const metaobjectResponse = await admin.graphql(
    `#graphql
    mutation shopifyReactRouterTemplateUpsertMetaobject($handle: MetaobjectHandleInput!, $values: JSON!) {
      metaobjectUpsert(handle: $handle, values: $values) {
        metaobject {
          id
          handle
          values
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        handle: {
          type: "$app:example",
          handle: "demo-entry",
        },
        values: {
          title: "Demo Entry",
          description:
            "This metaobject was created by the Shopify app template to demonstrate the metaobject API.",
        },
      },
    },
  );

  const metaobjectResponseJson = await metaobjectResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
    metaobject: metaobjectResponseJson!.data!.metaobjectUpsert!.metaobject,
  };
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const { campaigns, analytics, rewardBreakdown } =
  useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data?.product?.id, shopify]);

  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  return (
    
    <s-page heading="Seasonal Games">
      <s-button slot="primary-action" onClick={generateProduct}>
        Generate a product
      </s-button>

      <s-section heading="Welcome to Seasonal Games!">
      <s-paragraph>
        Create interactive seasonal campaigns that engage your customers and
        unlock special rewards.
      </s-paragraph>
            
      <s-section heading="Campaign Analytics">
        <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
          <s-box border="base" padding="base" borderRadius="base">
            <s-heading>Total spins</s-heading>
            <s-heading>{analytics.totalSpins}</s-heading>
          </s-box>

          <s-box border="base" padding="base" borderRadius="base">
            <s-heading>Discounts issued</s-heading>
            <s-heading>{analytics.discountsIssued}</s-heading>
          </s-box>

          <s-box border="base" padding="base" borderRadius="base">
            <s-heading>No-discount outcomes</s-heading>
            <s-heading>{analytics.noDiscountSpins}</s-heading>
          </s-box>

          <s-box border="base" padding="base" borderRadius="base">
            <s-heading>Needs attention</s-heading>
            <s-heading>
              {analytics.unresolvedSpins + analytics.failedSpins}
            </s-heading>
          </s-box>
        </s-grid>

        <s-heading>Rewards won</s-heading>

        {rewardBreakdown.length === 0 ? (
          <s-paragraph>
            No spins recorded yet. Analytics will appear when customers start playing.
          </s-paragraph>
        ) : (
          rewardBreakdown.map((item) => (
            <s-paragraph key={item.reward}>
              {item.reward}: {item.count} spins
            </s-paragraph>
          ))
        )}

        {analytics.unresolvedSpins > 0 && (
          <s-paragraph>
            {analytics.unresolvedSpins} spin(s) are pending or need verification.
          </s-paragraph>
        )}

        {analytics.failedSpins > 0 && (
          <s-paragraph>
            {analytics.failedSpins} spin(s) failed.
          </s-paragraph>
        )}
      </s-section>

      </s-section>

      <s-section heading="Your Campaigns">
        <s-stack direction="block" gap="small">
          <s-paragraph>
            Create interactive campaigns that turn promotions into experiences.
          </s-paragraph>
          <Link to="/app/campaigns/new">
              <s-button variant="primary">
                Create Campaign
              </s-button>
            </Link>
        </s-stack>
   
    </s-section>

          {campaigns.length === 0 ? (
        <s-paragraph>
          You don't have any campaigns yet. Create your first campaign to get
          started.
        </s-paragraph>
      ) : (
        campaigns.map((campaign) => (
          <s-section key={campaign.id} heading={campaign.name}>
            <s-stack direction="block" gap="small">
              <s-paragraph>
                🎮 Game: {campaign.game}
              </s-paragraph>

              <s-paragraph>
                🎁 Rewards: {campaign.rewardCount}
              </s-paragraph>

              <s-paragraph>
                🎨 Theme: {campaign.theme}
              </s-paragraph>

              <s-paragraph>
                📍 Placement: {campaign.placement}
              </s-paragraph>

              <s-badge tone={campaign.status === "active" ? "success" : "info"}>
                {campaign.status}
              </s-badge>
            </s-stack>
          </s-section>
        ))
      )}
    </s-page>
  );
        }     
      
 
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
