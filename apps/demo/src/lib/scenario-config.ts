import { env } from "@/env";

export const scenarioConfig = {
  autumn: {
    configured: Boolean(env.AUTUMN_SECRET_KEY),
    label: "Autumn Stripe",
    tab: "autumn-stripe",
  },
} as const;

export type ScenarioConfig = typeof scenarioConfig;

export function getConfiguredScenarios() {
  return Object.fromEntries(
    Object.entries(scenarioConfig).filter(([, scenario]) => scenario.configured),
  ) as Partial<ScenarioConfig>;
}
