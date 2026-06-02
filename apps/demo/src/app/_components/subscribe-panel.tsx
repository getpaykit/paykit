"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PlanCard } from "@/app/_components/plan-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { planCatalog, type PlanId } from "@/lib/demo-catalog";
import { paykitClient } from "@/lib/paykit-client";
import { api, type RouterOutputs } from "@/trpc/react";

type CurrentPlan = RouterOutputs["paykit"]["currentPlans"][number];

const stripeTestClockQueryKey = ["paykit", "stripe", "test-clock"] as const;

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function advanceClockTime(date: Date | string, input: { days?: number; months?: number }) {
  const next = new Date(date);

  if (input.days) {
    next.setUTCDate(next.getUTCDate() + input.days);
  }

  if (input.months) {
    next.setUTCMonth(next.getUTCMonth() + input.months);
  }

  return next;
}

function getPlanAction(
  planId: PlanId,
  activePlan: CurrentPlan | null,
  scheduledPlan: CurrentPlan | null,
) {
  if (scheduledPlan?.planId === planId) {
    return { disabled: true, label: "Scheduled" };
  }

  if (activePlan?.planId === planId) {
    if (activePlan.cancelAtPeriodEnd || scheduledPlan) {
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

  const activeCatalog = planCatalog.find((plan) => plan.id === activePlan.planId);
  const activeAmount = activeCatalog?.priceAmount ?? 0;
  const targetAmount = target.priceAmount ?? 0;

  if (targetAmount > activeAmount) return { disabled: false, label: "Upgrade" };
  if (targetAmount < activeAmount) return { disabled: false, label: "Downgrade" };
  return { disabled: false, label: "Switch" };
}

function StripeTestClockPanel() {
  const utils = api.useUtils();
  const queryClient = useQueryClient();
  const testClock = useQuery({
    queryFn: async () => paykitClient.getTestClock({}),
    queryKey: stripeTestClockQueryKey,
  });

  const advanceClock = useMutation({
    mutationFn: async (frozenTime: Date) => {
      const result = await paykitClient.advanceTestClock({ frozenTime });
      return result;
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to advance test clock");
    },
    onSuccess: async () => {
      toast.success("Advanced test clock");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: stripeTestClockQueryKey }),
        utils.paykit.currentPlans.invalidate(),
        utils.paykit.checkFeature.invalidate(),
      ]);
    },
  });

  const actions = testClock.data
    ? [
        {
          frozenTime: advanceClockTime(testClock.data.frozenTime, { days: 7 }),
          label: "+1 week",
        },
        {
          frozenTime: advanceClockTime(testClock.data.frozenTime, {
            months: 1,
          }),
          label: "+1 month",
        },
        {
          frozenTime: advanceClockTime(testClock.data.frozenTime, {
            months: 3,
          }),
          label: "+3 months",
        },
      ]
    : [];

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Test clock
          {testClock.data ? <Badge variant="outline">{testClock.data.status}</Badge> : null}
        </CardTitle>
        <CardDescription>
          Advance the logged-in customer through billing cycles without leaving the demo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {testClock.isLoading ? (
          <>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full" />
          </>
        ) : testClock.error ? (
          <p className="text-destructive text-sm">
            {testClock.error instanceof Error
              ? testClock.error.message
              : "Failed to load test clock"}
          </p>
        ) : testClock.data ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-lg font-semibold">
                {formatDateTime(testClock.data.frozenTime)}
              </span>
              <span className="text-muted-foreground text-sm">Test clock</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant="outline"
                  disabled={advanceClock.isPending}
                  onClick={() => advanceClock.mutate(action.frozenTime)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No test clock available.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function SubscribePanel() {
  const utils = api.useUtils();
  const paykitApi = api.paykit;
  const paykitUtils = utils.paykit;
  const { data: currentPlans, isLoading: isLoadingPlans } = paykitApi.currentPlans.useQuery();
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
    mutationFn: async ({ planId }: { planId: PlanId }) => {
      const result = await paykitClient.subscribe({
        planId,
        successUrl: "/?tab=paykit&checkout=success",
        cancelUrl: "/?tab=paykit&checkout=canceled",
      });
      return { planId, result };
    },
    onSuccess: async ({ result }) => {
      if (!result.paymentUrl) {
        await paykitUtils.currentPlans.invalidate();
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
          {activePlan ? (
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
            <span className="text-lg font-semibold">
              {planCatalog.find((plan) => plan.id === activePlan.planId)?.name ?? activePlan.planId}
            </span>
            <Badge variant="secondary">{activePlan.status}</Badge>
            {scheduledPlan ? <Badge variant="outline">change pending</Badge> : null}
            <span className="text-muted-foreground text-sm">
              {activePlan.currentPeriodEnd
                ? activePlan.cancelAtPeriodEnd || scheduledPlan
                  ? `Ends ${formatDate(activePlan.currentPeriodEnd)}`
                  : `Renews ${formatDate(activePlan.currentPeriodEnd)}`
                : null}
            </span>
            {scheduledPlan ? (
              <span className="text-muted-foreground text-sm">
                &rarr;{" "}
                {planCatalog.find((plan) => plan.id === scheduledPlan.planId)?.name ??
                  scheduledPlan.planId}{" "}
                {scheduledPlan.currentPeriodStart
                  ? `on ${formatDate(scheduledPlan.currentPeriodStart)}`
                  : "at end of period"}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No active plan.</p>
        )}
      </section>

      <StripeTestClockPanel />

      <Separator />

      {/* Plan cards */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Choose a plan</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {planCatalog.map((plan) => {
            const isCurrent = activePlan?.planId === plan.id;
            const action = getPlanAction(plan.id, activePlan, scheduledPlan);

            return (
              <PlanCard
                key={plan.id}
                action={action}
                isCurrent={isCurrent}
                isPending={subscribe.isPending}
                onSelect={() => subscribe.mutate({ planId: plan.id })}
                plan={plan}
              />
            );
          })}
        </div>
      </section>

      {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
    </div>
  );
}
