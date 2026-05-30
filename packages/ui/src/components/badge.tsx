import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils.ts';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-[2px] border px-2 py-0.5 text-[0.7rem] font-semibold tracking-[0.08em] whitespace-nowrap uppercase transition-colors focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px] [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-primary/50 bg-primary/8 text-primary',
        secondary: 'border-border bg-muted text-muted-foreground',
        arcane: 'border-accent/55 bg-accent/10 text-accent',
        success:
          'border-[hsl(var(--success)/0.5)] bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))]',
        destructive:
          'border-destructive/50 bg-destructive/8 text-destructive',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp
      data-slot='badge'
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
