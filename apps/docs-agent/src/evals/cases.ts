export interface DocsEvalGroundTruth {
  allowedCitationPaths: string[];
  expectAbstention: boolean;
  requiredFacts: string[];
}

export interface DocsEvalCase {
  externalId: string;
  groundTruth: DocsEvalGroundTruth;
  input: string;
  requestContext: { currentPage: string; rubric: string };
}

function defineCase(
  externalId: string,
  input: string,
  currentPage: string,
  requiredFacts: string[],
  allowedCitationPaths: string[],
  expectAbstention = false,
): DocsEvalCase {
  const rubric = expectAbstention
    ? [
        "The answer clearly says the requested behavior is not documented.",
        "The answer does not invent PayKit behavior or APIs.",
        "The answer stays concise and relevant.",
      ].join("\n")
    : [
        ...requiredFacts.map((fact) => `The answer communicates this fact accurately: ${fact}`),
        "The answer does not add unsupported PayKit behavior.",
        "The answer stays concise and relevant.",
      ].join("\n");

  return {
    externalId,
    input,
    groundTruth: { allowedCitationPaths, expectAbstention, requiredFacts },
    requestContext: { currentPage, rubric },
  };
}

export const docsEvalCases: DocsEvalCase[] = [
  defineCase(
    "installation-database",
    "What database does PayKit require?",
    "/docs/installation",
    ["PayKit uses PostgreSQL", "createPayKit accepts a pg.Pool or connection string"],
    ["/docs/installation", "/docs/database"],
  ),
  defineCase(
    "define-plans",
    "How do I define a paid plan with a metered feature?",
    "/docs/plans-and-features",
    [
      "Features are defined separately and included in plans",
      "Metered grants require a limit and reset interval",
    ],
    ["/docs/plans-and-features"],
  ),
  defineCase(
    "default-plan",
    "Does a default free plan create a subscription record automatically?",
    "/docs/plans-and-features",
    [
      "A default plan is a group fallback",
      "No subscription record is created until explicit subscription",
    ],
    ["/docs/plans-and-features", "/docs/subscriptions"],
  ),
  defineCase(
    "subscription-downgrade",
    "When does a downgrade take effect?",
    "/docs/subscriptions",
    ["Downgrades are scheduled for the end of the billing period"],
    ["/docs/subscriptions"],
  ),
  defineCase(
    "cancel-subscription",
    "How do I cancel a paid subscription?",
    "/docs/subscriptions",
    ["Subscribe to the default free plan", "The paid plan remains active until period end"],
    ["/docs/subscriptions"],
  ),
  defineCase(
    "boolean-entitlement",
    "What does check return for a boolean feature?",
    "/docs/entitlements",
    ["check returns allowed", "Boolean features have no balance tracking"],
    ["/docs/entitlements"],
  ),
  defineCase(
    "metered-usage-order",
    "What is the correct order for checking and reporting metered usage?",
    "/docs/metered-usage",
    ["Call check before the action", "Call report only after the action succeeds"],
    ["/docs/metered-usage", "/docs/entitlements"],
  ),
  defineCase(
    "database-ownership",
    "Can my application write directly to PayKit tables?",
    "/docs/database",
    [
      "PayKit owns its prefixed tables",
      "Applications should use the PayKit API instead of direct writes",
    ],
    ["/docs/database"],
  ),
  defineCase(
    "webhook-deduplication",
    "How does PayKit avoid processing the same Stripe webhook twice?",
    "/docs/webhook-events",
    ["Webhook events are recorded for deduplication"],
    ["/docs/webhook-events", "/docs/database"],
  ),
  defineCase(
    "unsupported-provider",
    "How do I configure PayPal as the payment provider?",
    "/docs/introduction",
    [],
    [],
    true,
  ),
];
