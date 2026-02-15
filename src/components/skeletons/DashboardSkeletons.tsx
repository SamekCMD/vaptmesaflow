import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const MetricCardSkeleton = () => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-7 w-24 mb-1" />
      <Skeleton className="h-3 w-16 mt-1" />
    </CardContent>
  </Card>
);

export const ChartSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-3 w-64 mt-1" />
    </CardHeader>
    <CardContent>
      <div className="h-[300px] flex items-end gap-4 px-4 pb-4">
        {[60, 80, 45, 90, 70, 55, 75].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
    </CardContent>
  </Card>
);

export const OverviewSkeleton = () => (
  <div className="space-y-6">
    <div>
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-56" />
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
    <ChartSkeleton />
  </div>
);

export const FormFieldSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-28" />
    <Skeleton className="h-10 w-full rounded-md" />
  </div>
);

export const SettingsFormSkeleton = () => (
  <div className="space-y-6 max-w-2xl">
    <div>
      <Skeleton className="h-7 w-40 mb-2" />
      <Skeleton className="h-4 w-56" />
    </div>
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <FormFieldSkeleton key={i} />
        ))}
        <Skeleton className="h-10 w-36 rounded-md" />
      </CardContent>
    </Card>
  </div>
);

export const TableRowSkeleton = () => (
  <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
    <Skeleton className="h-4 flex-[2]" />
    <Skeleton className="h-4 flex-1" />
    <Skeleton className="h-4 w-16" />
    <Skeleton className="h-5 w-20 rounded-full" />
    <Skeleton className="h-8 w-16 ml-auto" />
  </div>
);

export const MenuTableSkeleton = () => (
  <Card>
    <CardContent className="p-0">
      <div className="px-4 py-3 border-b border-border flex gap-4">
        <Skeleton className="h-4 flex-[2]" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12 ml-auto" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </CardContent>
  </Card>
);

export const KitchenColumnSkeleton = () => (
  <div>
    <div className="flex items-center gap-2 mb-4">
      <Skeleton className="h-3 w-3 rounded-full" />
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-5 w-6 ml-auto rounded" />
    </div>
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-6 w-20 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

export const KitchenSkeleton = () => (
  <div className="space-y-6">
    <div>
      <Skeleton className="h-7 w-52 mb-2" />
      <Skeleton className="h-4 w-64" />
    </div>
    <div className="grid md:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <KitchenColumnSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const MenuItemCardSkeleton = () => (
  <div className="flex gap-3 p-4 rounded-xl bg-card border border-border">
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-4 w-16 mt-2" />
    </div>
    <Skeleton className="h-8 w-20 self-end rounded-md" />
  </div>
);

export const PublicMenuSkeleton = () => (
  <div className="min-h-screen bg-background">
    {/* Header */}
    <div className="py-6 px-4 text-center bg-muted">
      <div className="max-w-md mx-auto">
        <Skeleton className="h-16 w-16 rounded-full mx-auto mb-3" />
        <Skeleton className="h-5 w-36 mx-auto mb-1" />
        <Skeleton className="h-3 w-24 mx-auto" />
      </div>
    </div>
    {/* Category bar */}
    <div className="border-b border-border">
      <div className="max-w-md mx-auto flex gap-2 px-4 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
    </div>
    {/* Items */}
    <div className="max-w-md mx-auto px-4 py-4 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <MenuItemCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const AppearanceFormSkeleton = () => (
  <div className="space-y-6">
    <div>
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-72" />
    </div>
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-4">
              <FormFieldSkeleton />
              <FormFieldSkeleton />
            </CardContent>
          </Card>
        ))}
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
      <div className="hidden lg:block">
        <Skeleton className="h-[600px] w-full max-w-[320px] rounded-[2rem]" />
      </div>
    </div>
  </div>
);
