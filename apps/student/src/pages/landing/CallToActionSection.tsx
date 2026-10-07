/**
 * The closing call to action (FR-LND-6).
 */

// Internal link.
import { Link } from 'react-router'

// Standard button.
import { Button } from '@conote/ui/button'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** A brand-coloured band with one button. */
export function CallToActionSection() {
  return (
    // Named after its heading.
    <section aria-labelledby="cta-title" className="bg-primary px-4 py-16 text-center">
      {/* Heading in the brand's foreground colour. */}
      <h2 id="cta-title" className="text-3xl font-bold tracking-tight text-primary-foreground">
        Start learning smarter with CoNote
      </h2>
      {/* The button, inverted so it stands out on the brand colour. */}
      <Button size="lg" variant="secondary" asChild className="mt-8">
        <Link to={ROUTES.signup}>Create Free Account</Link>
      </Button>
    </section>
  )
}
