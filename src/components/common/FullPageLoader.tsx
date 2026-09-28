import { LoaderCircle } from 'lucide-react'

export function FullPageLoader() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-dvh place-items-center">
      <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-primary" />
    </div>
  )
}
