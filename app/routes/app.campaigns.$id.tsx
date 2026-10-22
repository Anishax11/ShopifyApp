import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  deleteCampaign,
  parseCampaignForm,
  updateCampaign,
} from "../models/campaign.server";
import { CampaignForm } from "../components/CampaignForm";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id!;

  const campaign = await prisma.campaign.findFirst({
    where: { id, shop: session.shop },
    include: { rewards: { orderBy: { position: "asc" } } },
  });

  if (!campaign) {
    throw new Response("Campaign not found", { status: 404 });
  }

  const spinCount = await prisma.spin.count({
    where: { shop: session.shop, campaignId: id },
  });

  return {
    spinCount,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      theme: campaign.theme,
      placement: campaign.placement,
      status: campaign.status,
      discountValues: campaign.rewards.map((r) => Number(r.discountValue)),
    },
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id!;
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");

  if (intent === "delete") {
    const result = await deleteCampaign(session.shop, id);
    if (!result.ok) return { errors: { form: result.error } };
    return redirect("/app?saved=deleted");
  }

  const parsed = parseCampaignForm(formData);
  if ("errors" in parsed) return { errors: parsed.errors };

  const result = await updateCampaign(session.shop, id, parsed.input);
  if (!result.ok) return { errors: { form: result.error } };

  return redirect("/app?saved=updated");
};

export default function EditCampaign() {
  const { campaign, spinCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();

  const isSubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save";
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";

  const modalId = "delete-campaign-modal";

  return (
    <s-page heading={`Edit ${campaign.name}`}>
      <s-link slot="breadcrumb-actions" href="/app">
        Seasonal Games
      </s-link>

      <CampaignForm
        initial={campaign}
        errors={actionData?.errors}
        isSubmitting={isSubmitting}
        submitLabel="Save changes"
      />

      <s-section heading="Delete campaign">
        <s-stack direction="block" gap="base">
          {campaign.status === "active" ? (
            <s-paragraph>
              This campaign is live. Set its status to Draft and save before
              deleting it.
            </s-paragraph>
          ) : (
            <>
              <s-paragraph>
                Permanently remove this campaign
                {spinCount > 0
                  ? ` and its ${spinCount} recorded spin${spinCount === 1 ? "" : "s"}`
                  : ""}
                . This can’t be undone.
              </s-paragraph>
              <s-stack direction="inline">
                <s-button
                  tone="critical"
                  commandFor={modalId}
                  command="--show"
                  loading={isDeleting || undefined}
                >
                  Delete campaign
                </s-button>
              </s-stack>
            </>
          )}
        </s-stack>
      </s-section>

      <s-modal id={modalId} heading="Delete this campaign?">
        <s-paragraph>
          “{campaign.name}” will be permanently deleted
          {spinCount > 0
            ? `, along with its ${spinCount} recorded spin${spinCount === 1 ? "" : "s"} (they'll disappear from your analytics). Discount codes already issued to customers are not removed from Shopify.`
            : "."}{" "}
          This can’t be undone.
        </s-paragraph>
        <s-button
          slot="secondary-actions"
          commandFor={modalId}
          command="--hide"
        >
          Cancel
        </s-button>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor={modalId}
          command="--hide"
          onClick={() => submit({ intent: "delete" }, { method: "post" })}
        >
          Delete campaign
        </s-button>
      </s-modal>
    </s-page>
  );
}