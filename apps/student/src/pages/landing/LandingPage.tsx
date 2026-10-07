/**
 * The public landing page at / (FR-LND-2 to FR-LND-6). The header and footer come from
 * PublicLayout.
 */

// Runs the scroll after the page has rendered.
import { useEffect } from 'react'
// The address, for its #anchor.
import { useLocation } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'

// The page's sections, top to bottom.
import { AboutSection } from './AboutSection'
import { CallToActionSection } from './CallToActionSection'
import { FeaturesSection } from './FeaturesSection'
import { HeroSection } from './HeroSection'
import { HowItWorksSection } from './HowItWorksSection'

/** The landing page. */
export function LandingPage() {
  // The "#features"-style part of the address, or "".
  const { hash } = useLocation()

  // Scrolls to the section named in the address. The router doesn't do this itself, and the
  // page is lazy-loaded, so the browser's own jump happens before the section exists.
  useEffect(() => {
    // No anchor: stay at the top.
    if (hash === '') return
    // Find the section by id; an unknown anchor finds nothing and nothing happens.
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  return (
    <>
      {/* Tab title: the tagline. */}
      <PageTitle title="Your notes. Collective understanding." />
      {/* Tagline, subtitle, actions and preview. */}
      <HeroSection />
      {/* The six steps. */}
      <HowItWorksSection />
      {/* The four feature cards. */}
      <FeaturesSection />
      {/* Privacy and teacher approval. */}
      <AboutSection />
      {/* Closing call to action. */}
      <CallToActionSection />
    </>
  )
}
