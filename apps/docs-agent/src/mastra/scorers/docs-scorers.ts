import { createScorer } from "@mastra/core/evals";
import { createRubricScorer } from "@mastra/evals/scorers/prebuilt";
import { extractToolCalls, getTextContentFromMastraDBMessage } from "@mastra/evals/scorers/utils";
import { z } from "zod";

import { vercelGatewayModel } from "../../env";

const groundTruthSchema = z.object({
  allowedCitationPaths: z.array(z.string()),
  expectAbstention: z.boolean().default(false),
  requiredFacts: z.array(z.string()),
});

function getOutputText(output: unknown) {
  if (!Array.isArray(output)) return "";

  return output
    .map((message) => getTextContentFromMastraDBMessage(message))
    .join("\n")
    .trim();
}

export const docsToolUseScorer = createScorer({
  id: "docs-tool-use",
  name: "Docs tool use",
  description: "Checks that the agent searched the PayKit documentation before answering.",
  type: "agent",
}).generateScore(({ run }) => {
  const { tools } = extractToolCalls(run.output);
  return tools.includes("paykitDocs_search") ? 1 : 0;
});

export const docsCitationScorer = createScorer({
  id: "docs-citation",
  name: "Docs citation or abstention",
  description:
    "Checks for an expected docs citation or an explicit documentation-grounded abstention.",
  type: "agent",
}).generateScore(({ run }) => {
  const groundTruth = groundTruthSchema.safeParse(run.groundTruth);
  if (!groundTruth.success) return 0;

  const output = getOutputText(run.output).toLowerCase();
  if (groundTruth.data.expectAbstention) {
    return /not (documented|covered|available)|could(?: not|n't) find|does not (document|cover)|docs do not/.test(
      output,
    )
      ? 1
      : 0;
  }

  return groundTruth.data.allowedCitationPaths.some((path) => output.includes(path.toLowerCase()))
    ? 1
    : 0;
});

export const docsAnswerQualityScorer = createRubricScorer({
  model: vercelGatewayModel,
});
