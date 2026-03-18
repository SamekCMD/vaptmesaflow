import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[hsl(153_27%_23%)] bg-[hsl(153_27%_14%)] text-[hsl(153_33%_62%)]",
        secondary:
          "border-[hsl(35_31%_18%)] bg-[hsl(37_27%_13%)] text-[hsl(44_51%_54%)]",
        destructive:
          "border-[hsl(0_23%_19%)] bg-[hsl(0_27%_13%)] text-destructive",
        outline: "border-border text-muted-foreground",
        info:
          "border-[hsl(213_21%_19%)] bg-[hsl(220_27%_13%)] text-[hsl(216_34%_64%)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
