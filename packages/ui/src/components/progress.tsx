import * as React from 'react';

import { cn } from '../lib/utils.ts';

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<'div'> & {
  value?: number | null;
}) {
  const safeValue =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : 0;

  return (
    <div
      data-slot='progress'
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-foreground/15',
        className,
      )}
      {...props}
    >
      <div
        data-slot='progress-indicator'
        className='h-full w-full flex-1 rounded-full bg-[linear-gradient(90deg,hsl(var(--success)),hsl(140_48%_44%))] transition-transform'
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </div>
  );
}

export { Progress };
