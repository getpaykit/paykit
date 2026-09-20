import { MastraError } from "@mastra/core/error";

import { mastra } from "../mastra";
import { docsEvalCases } from "./cases";

const datasetId = "paykit-docs-baseline";

async function getOrCreateDataset() {
  try {
    return await mastra.datasets.get({ id: datasetId });
  } catch (error) {
    if (!(error instanceof MastraError) || error.id !== "DATASET_NOT_FOUND") throw error;

    return mastra.datasets.create({
      id: datasetId,
      name: "PayKit docs baseline",
      description:
        "Regression questions for documentation retrieval, grounding, citations, and abstention.",
      targetType: "agent",
      targetIds: ["docs-agent"],
      scorerIds: ["docsToolUse", "docsCitation", "docsAnswerQuality"],
    });
  }
}

const dataset = await getOrCreateDataset();

const listed = await dataset.listItems({ page: 0, perPage: 100 });
const existingItems = Array.isArray(listed) ? listed : listed.items;
const existingByExternalId = new Map(existingItems.map((item) => [item.externalId, item]));

for (const item of docsEvalCases) {
  const existing = existingByExternalId.get(item.externalId);
  const payload = {
    externalId: item.externalId,
    input: item.input,
    groundTruth: item.groundTruth,
    requestContext: item.requestContext,
  };

  if (!existing) {
    await dataset.addItem(payload);
    continue;
  }

  const isCurrent =
    JSON.stringify(existing.input) === JSON.stringify(payload.input) &&
    JSON.stringify(existing.groundTruth) === JSON.stringify(payload.groundTruth) &&
    JSON.stringify(existing.requestContext) === JSON.stringify(payload.requestContext);

  if (!isCurrent) {
    await dataset.updateItem({
      itemId: existing.id,
      input: payload.input,
      groundTruth: payload.groundTruth,
      requestContext: payload.requestContext,
    });
  }
}

console.log(`Seeded ${docsEvalCases.length} cases into ${dataset.id}.`);
