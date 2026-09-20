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

function getFinalAssistantOutputText(output: unknown) {
  if (!Array.isArray(output)) return "";

  for (let index = output.length - 1; index >= 0; index -= 1) {
    const message = output[index];
    if (!message || typeof message !== "object" || !("role" in message)) continue;
    if (message.role !== "assistant") continue;

    const text = getTextContentFromMastraDBMessage(message).trim();
    if (text) return text;
  }

  return "";
}

function normalizeDocsPath(path: string) {
  const pathname = new URL(path, "https://paykit.sh").pathname.toLowerCase();
  return pathname === "/docs" ? pathname : pathname.replace(/\/$/, "");
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
  if (!groundTruth.success) {
    throw new Error(`Invalid docs citation ground truth: ${groundTruth.error.message}`);
  }

  const output = getFinalAssistantOutputText(run.output).toLowerCase();
  if (groundTruth.data.expectAbstention) {
    return /not (documented|covered|available)|could(?: not|n't) find|does not (document|cover|mention)|docs do not/.test(
      output,
    )
      ? 1
      : 0;
  }

  const citationPaths = [
    ...output.matchAll(/\]\(\s*(\/docs(?:\/[^)\s]+)?)(?:\s+["'][^)]*["'])?\s*\)/g),
  ].flatMap(([, path]) => (path ? [normalizeDocsPath(path)] : []));

  return groundTruth.data.allowedCitationPaths.some((path) =>
    citationPaths.includes(normalizeDocsPath(path)),
  )
    ? 1
    : 0;
});

export const docsAnswerQualityScorer = createRubricScorer({
  model: vercelGatewayModel,
});
