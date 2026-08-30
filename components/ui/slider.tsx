"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

// `role="slider"` sits on the Thumb, not the Root, so an aria-label passed to
// this component has to be forwarded there or the control ends up with no
// accessible name at all — the Root's label is on an element screen readers
// never announce as the control.
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      // The rail takes a click, the thumb takes a drag — see "The cursor names
      // the gesture" in design/README.md. Here rather than at the call sites,
      // which is how the velocity slider ended up with a hand cursor and the
      // Inspector's sliders with an arrow.
      "relative flex w-full cursor-pointer touch-none select-none items-center",
      "data-[disabled]:cursor-not-allowed",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className="block h-4 w-4 cursor-grab rounded-full border border-primary/50 bg-background shadow transition-colors active:cursor-grabbing focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
