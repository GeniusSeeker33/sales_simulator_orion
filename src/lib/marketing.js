import { learnerClient } from "./learnerClient.js";

export const CAMPAIGN_STATUSES = ["draft", "planned", "active", "paused", "completed", "cancelled"];
export const APPROVAL_STATES = ["draft", "in_review", "changes_requested", "approved"];

export function splitList(value = "") {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function createAttributionKey(name, id = crypto.randomUUID()) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "campaign";
  return `${slug}-${id.slice(0, 8)}`;
}

async function rpc(name, args) {
  if (!learnerClient) throw new Error("Marketing storage is not configured.");
  const { data, error } = await learnerClient.rpc(name, args);
  if (error) throw new Error(error.message || "Marketing request could not be completed.");
  return data;
}

export function readMarketingWorkspace(workspaceId = null) {
  return rpc("read_marketing_workspace", { p_workspace: workspaceId });
}

export function saveMarketingCampaign(workspaceId, campaign, expectedRevision = null) {
  return rpc("save_marketing_campaign", {
    p_id: campaign.id,
    p_workspace: workspaceId,
    p_expected_revision: expectedRevision,
    p_payload: campaign,
  });
}
