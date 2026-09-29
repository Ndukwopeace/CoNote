/**
 * Accordion (shadcn/ui new-york on Radix Accordion): questions that open to show their answers.
 * Radix provides the button semantics, aria-expanded and arrow-key movement.
 */

// Chevron that turns when open.
import { ChevronDown } from 'lucide-react'
// Radix's accessible accordion parts.
import { Accordion as AccordionPrimitive } from 'radix-ui'
// React types.
import type * as React from 'react'

// Class-name helper.
import { cn } from '@/lib/utils'

/** The set of items. */
function Accordion(props: Readonly<React.ComponentProps<typeof AccordionPrimitive.Root>>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

/** One question and answer, divided from the next by a line. */
function AccordionItem({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AccordionPrimitive.Item>>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('border-b last:border-b-0', className)}
      {...props}
    />
  )
}

/** The question: a full-width button in a heading, with a chevron. */
function AccordionTrigger({
  className,
  children,
  ...props
}: Readonly<React.ComponentProps<typeof AccordionPrimitive.Trigger>>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'flex min-h-11 flex-1 items-center justify-between gap-4 rounded-md py-3 text-left text-sm font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&[data-state=open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        {/* Decorative chevron; aria-expanded says whether it is open. */}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

/** The answer. */
function AccordionContent({
  className,
  children,
  ...props
}: Readonly<React.ComponentProps<typeof AccordionPrimitive.Content>>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm"
      {...props}
    >
      <div className={cn('pb-4 text-muted-foreground', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

// The parts.
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
