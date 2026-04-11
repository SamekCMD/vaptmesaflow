import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type OverviewMetricCardProps = {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  variant?: "inline" | "card";
};

export default function OverviewMetricCard({
  title,
  value,
  helper,
  icon: Icon,
  variant = "inline",
}: OverviewMetricCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </span>
        <Icon className="h-4 w-4 text-primary/80" strokeWidth={1.75} />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
    </>
  );

  if (variant === "card") {
    return (
      <Card className="border-border/80 bg-card/90">
        <CardContent className="p-5">{content}</CardContent>
      </Card>
    );
  }

  return <div className="rounded-md border border-border/70 bg-background px-4 py-3">{content}</div>;
}
