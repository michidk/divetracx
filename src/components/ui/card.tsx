import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-2xl border border-border bg-card', className)}
      {...props}
    />
  )
}

function CardLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      data-slot="card"
      className={cn(
        'group block rounded-2xl border border-border bg-card transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
      {...props}
    />
  )
}
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...props}
    />
  )
}
function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('font-semibold leading-none', className)}
      {...props}
    />
  )
}
function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}
function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-6 pt-0', className)} {...props} />
}

export { Card, CardContent, CardDescription, CardHeader, CardLink, CardTitle }
