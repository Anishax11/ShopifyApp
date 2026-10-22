import type { ActionFunctionArgs } from "react-router";
import { redirect, useActionData, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { createCampaign, parseCampaignForm } from "../models/campaign.server";
import type { FormErrors } from "../models/campaign.server";
import { CampaignForm } from "../components/CampaignForm";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const parsed = parseCampaignForm(formData);
  if ("errors" in parsed) {
    return { errors: parsed.errors };
  }

  try {
    await createCampaign(session.shop, parsed.input);
  } catch (error) {
    console.error("Campaign create failed:", error);
    return {
      errors: {
        form: "Something went wrong while saving. Please try again.",
      } as FormErrors,
    };
  }

  return redirect("/app?saved=created");
};

export default function NewCampaign() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="Create campaign">
      <s-link slot="breadcrumb-actions" href="/app">
        Seasonal Games
      </s-link>
      <CampaignForm
        errors={actionData?.errors}
        isSubmitting={isSubmitting}
        submitLabel="Create campaign"
      />
    </s-page>
  );
}