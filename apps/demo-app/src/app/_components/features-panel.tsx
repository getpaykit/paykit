"use client";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";

const featureCatalog = [
  {
    description: "Send an AI message",
    id: "messages",
    name: "Messages",
    type: "metered" as const,
  },
  {
    description: "Access to advanced AI models",
    id: "pro_models",
    name: "Pro Models",
    type: "boolean" as const,
  },
  {
    description: "Dedicated priority support channel",
    id: "priority_support",
    name: "Priority Support",
    type: "boolean" as const,
  },
];

function MeteredFeatureRow({
  featureId,
  name,
  description,
}: {
  description: string;
  featureId: string;
  name: string;
}) {
  const utils = api.useUtils();
  const { data, isLoading } = api.paykit.checkFeature.useQuery({
    featureId,
  });

  const report = api.paykit.reportUsage.useMutation({
    onSuccess: (result) => {
      void utils.paykit.checkFeature.invalidate({ featureId });
      if (!result.success) {
        toast.error("Insufficient balance", {
          description: `Not enough ${name.toLowerCase()} remaining`,
        });
      }
    },
  });

  const balance = data?.balance;
  const used = balance ? balance.limit - balance.remaining : 0;
  const percentage = balance && balance.limit > 0 ? (used / balance.limit) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          {data && !data.allowed ? <Badge variant="destructive">limit reached</Badge> : null}
        </div>
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : balance && !balance.unlimited ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {used.toLocaleString()} / {balance.limit.toLocaleString()} used
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">No access</span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-1 w-full" />
      ) : balance && !balance.unlimited ? (
        <Progress value={percentage} className="h-1.5" />
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">{description}</p>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={report.isPending || !data?.allowed}
            onClick={() => report.mutate({ featureId, amount: 1 })}
          >
            +1
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={report.isPending || !data?.allowed}
            onClick={() => report.mutate({ featureId, amount: 10 })}
          >
            +10
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={report.isPending || !data?.allowed}
            onClick={() => report.mutate({ featureId, amount: 100 })}
          >
            +100
          </Button>
        </div>
      </div>
    </div>
  );
}

function BooleanFeatureRow({
  featureId,
  name,
  description,
}: {
  description: string;
  featureId: string;
  name: string;
}) {
  const { data, isLoading } = api.paykit.checkFeature.useQuery({
    featureId,
  });

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{name}</span>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-5 w-16" />
      ) : data?.allowed ? (
        <Badge variant="secondary">enabled</Badge>
      ) : (
        <Badge variant="outline">locked</Badge>
      )}
    </div>
  );
}

export function FeaturesPanel() {
  return (
    <div className="flex flex-col gap-4">
      {featureCatalog.map((feat) =>
        feat.type === "metered" ? (
          <MeteredFeatureRow
            key={feat.id}
            featureId={feat.id}
            name={feat.name}
            description={feat.description}
          />
        ) : (
          <BooleanFeatureRow
            key={feat.id}
            featureId={feat.id}
            name={feat.name}
            description={feat.description}
          />
        ),
      )}
    </div>
  );
}
