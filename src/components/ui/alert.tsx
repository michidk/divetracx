import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative flex gap-4 rounded-2xl border p-5 [&>svg]:mt-0.5 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground',
        warning: 'border-warning/25 bg-warning/5 text-foreground [&>svg]:text-warning',
        destructive: 'border-destructive/25 bg-destructive/5 text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}
function AlertTitle({ className, ...props }: React.ComponentProps<'h5'>) {
  return (
    <h5 data-slot="alert-title" className={cn('font-semibold', className)} {...props} />
  )
}
function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('mt-1 text-sm leading-6 text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Alert, AlertDescription, AlertTitle }
