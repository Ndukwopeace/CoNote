/**
 * Round profile picture with an initials fallback (shadcn/ui new-york on Radix Avatar). Radix
 * shows the fallback until the image loads, or forever if it fails.
 */

// Radix's accessible avatar parts.
import { Avatar as AvatarPrimitive } from 'radix-ui'
// React types.
import * as React from 'react'

// Class-name helper.
import { cn } from '../utils'

/** The round frame. */
function Avatar({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AvatarPrimitive.Root>>) {
  return (
    <AvatarPrimitive.Root
      // Marker for styling and debugging.
      data-slot="avatar"
      // 36 px circle; overflow-hidden crops the picture to the circle.
      className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}
      // Everything else.
      {...props}
    />
  )
}

/** The picture, when there is one. */
function AvatarImage({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AvatarPrimitive.Image>>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      // Fill the circle without stretching.
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  )
}

/** What shows without a picture: the student's initials on a brand tint. */
function AvatarFallback({
  className,
  ...props
}: Readonly<React.ComponentProps<typeof AvatarPrimitive.Fallback>>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      // Centred initials, dark brand text on the pale brand tint.
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary-dark',
        className,
      )}
      {...props}
    />
  )
}

// The three parts.
export { Avatar, AvatarImage, AvatarFallback }
