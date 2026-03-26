"use client";

import { useMutation } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { paykitClient } from "@/lib/paykit-client";
import { api, type RouterOutputs } from "@/trpc/react";

type SubscribePlanId = Parameters<typeof paykitClient.subscribe>[0]["planId"];
type CurrentPlan = RouterOutputs["paykit"]["currentPlans"][number];

const planCatalog = [
  {
    description: "100 messages / month",
    id: "free",
    name: "Free",
    priceAmount: null,
  },
  {
    description: "2,000 messages, pro models",
    id: "pro",
    name: "Pro",
    priceAmount: 1900,
  },
  {
    description: "10,000 messages, priority support",
    id: "ultra",
    name: "Ultra",
    priceAmount: 4900,
  },
] as const satisfies ReadonlyArray<{
  description: string;
  id: SubscribePlanId;
  name: string;
  priceAmount: number | null;
}>;

function formatPrice(amount: number | null) {
  if (amount == null) return "$0";
  return `$${(amount / 100).toFixed(0)}`;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getPlanAction(
  planId: SubscribePlanId,
  activePlan: CurrentPlan | null,
  scheduledPlan: CurrentPlan | null,
) {
  if (scheduledPlan?.id === planId) {
    return { disabled: true, label: "Scheduled" };
  }

  if (activePlan?.id === planId) {
    if (activePlan.canceled || scheduledPlan) {
      return { disabled: false, label: "Resubscribe" };
    }
    return { disabled: true, label: "Current plan" };
  }

  const target = planCatalog.find((plan) => plan.id === planId);
  if (!target) return { disabled: false, label: "Choose plan" };

  if (!activePlan) {
    return {
      disabled: false,
      label: target.priceAmount == null ? "Get started" : "Subscribe",
    };
  }

  const activeAmount = activePlan.amount ?? 0;
  const targetAmount = target.priceAmount ?? 0;

  if (targetAmount > activeAmount) return { disabled: false, label: "Upgrade" };
  if (targetAmount < activeAmount) return { disabled: false, label: "Downgrade" };
  return { disabled: false, label: "Switch" };
}

export function SubscribePanel() {
  const utils = api.useUtils();
  const { data: currentPlans, isLoading: isLoadingPlans } = api.paykit.currentPlans.useQuery();
  const activePlan =
    currentPlans?.find((plan) => ["active", "trialing", "past_due"].includes(plan.status)) ?? null;
  const scheduledPlan = currentPlans?.find((plan) => plan.status === "scheduled") ?? null;

  const openPortal = useMutation({
    mutationFn: async () => {
      const result = await paykitClient.customerPortal({
        returnUrl: window.location.href,
      });
      return result;
    },
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  const subscribe = useMutation({
    mutationFn: async ({ planId }: { planId: SubscribePlanId }) => {
      const result = await paykitClient.subscribe({
        planId,
        successUrl: `${window.location.origin}/?checkout=success`,
        cancelUrl: `${window.location.origin}/?checkout=canceled`,
      });
      return { planId, result };
    },
    onSuccess: async ({ result }) => {
      if (!result.paymentUrl) {
        await utils.paykit.currentPlans.invalidate();
      }
      if (result.paymentUrl) {
        window.location.assign(result.paymentUrl);
      }
    },
  });

  const errorMessage =
    subscribe.error instanceof Error
      ? subscribe.error.message
      : subscribe.error
        ? "Subscribe failed"
        : "";

  return (
    <div className="flex flex-col gap-8">
      {/* Current plan */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Current plan</h2>
          {activePlan && activePlan.amount != null ? (
            <Button
              variant="outline"
              size="sm"
              disabled={openPortal.isPending}
              onClick={() => openPortal.mutate()}
            >
              Manage billing
            </Button>
          ) : null}
        </div>
        {isLoadingPlans ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
        ) : activePlan ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-lg font-semibold">{activePlan.name}</span>
            <Badge variant="secondary">{activePlan.status}</Badge>
            {scheduledPlan ? <Badge variant="outline">change pending</Badge> : null}
            <span className="text-muted-foreground text-sm">
              {activePlan.currentPeriodEndAt
                ? activePlan.canceled || scheduledPlan
                  ? `Ends ${formatDate(activePlan.currentPeriodEndAt)}`
                  : `Renews ${formatDate(activePlan.currentPeriodEndAt)}`
                : null}
            </span>
            {scheduledPlan ? (
              <span className="text-muted-foreground text-sm">
                &rarr; {scheduledPlan.name}{" "}
                {scheduledPlan.startedAt
                  ? `on ${formatDate(scheduledPlan.startedAt)}`
                  : "at end of period"}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No active plan.</p>
        )}
      </section>

      <Separator />

      {/* Plan cards */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Choose a plan</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {planCatalog.map((plan) => {
            const isCurrent = activePlan?.id === plan.id;
            const action = getPlanAction(plan.id, activePlan, scheduledPlan);

            return (
              <Card key={plan.id} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-baseline gap-2">
                    {plan.name}
                    {isCurrent ? <Badge variant="secondary">current</Badge> : null}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-foreground text-2xl font-semibold">
                      {formatPrice(plan.priceAmount)}
                    </span>
                    /mo
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <p className="text-muted-foreground flex-1 text-sm">{plan.description}</p>
                  <Button
                    className="w-full"
                    disabled={subscribe.isPending || action.disabled}
                    onClick={() => subscribe.mutate({ planId: plan.id })}
                    variant={action.disabled ? "outline" : "default"}
                    size="sm"
                  >
                    {action.label}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
    </div>
  );
}
