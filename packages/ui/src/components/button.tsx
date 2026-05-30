import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils.ts';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] border text-sm font-semibold outline-none transition-[background,border-color,box-shadow,color,transform] focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-primary bg-primary text-primary-foreground shadow-[var(--shadow-ink)] hover:bg-primary/92 active:translate-y-px',
        secondary:
          'border-border bg-secondary text-secondary-foreground shadow-[var(--shadow-parchment)] hover:bg-secondary/80 active:translate-y-px',
        arcane:
          'border-accent bg-accent text-accent-foreground shadow-[0_0_0_1px_hsl(var(--accent)),0_0_16px_hsl(var(--accent)/0.34)] hover:bg-accent/90 active:translate-y-px',
        parchment:
          'border-border bg-card text-card-foreground shadow-[var(--shadow-parchment)] hover:border-primary hover:bg-muted active:translate-y-px',
        ghost:
          'border-transparent bg-transparent text-foreground hover:bg-foreground/7 active:translate-y-px',
        destructive:
          'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 active:translate-y-px',
        outline:
          'border-border bg-transparent text-foreground hover:bg-muted active:translate-y-px',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6 text-base',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
