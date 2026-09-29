/**
 * A build step (decision D62): moves the app's stylesheet from a separate file into index.html.
 * A <link rel="stylesheet"> in the head stops the browser drawing anything until that file has
 * downloaded, so on a first open the launch splash waited behind a blank white screen. Inlined,
 * the splash paints as soon as the page itself arrives. Used by vite.config.ts at build time.
 */

/** What the step did: the new page, and the stylesheet addresses now inside it. */
export interface InlineResult {
  html: string
  inlined: string[]
}

// A stylesheet link as Vite writes it, capturing the address. Other links (icons, preloads) have
// a different rel and don't match.
const STYLESHEET_LINK = /<link rel="stylesheet"[^>]*? href="([^"]+)"[^>]*>/g

// "</style" anywhere in the rules, in any letter case.
const STYLE_END = /<\/style/i

// A url() that starts with ./ or ../, quoted or not.
const RELATIVE_URL = /url\(\s*['"]?\.\.?\//

/**
 * Replaces every stylesheet link whose content `readCss` knows with a <style> holding it.
 * Links it doesn't know stay as they are.
 */
export function inlineStylesheets(
  html: string,
  readCss: (href: string) => string | undefined,
): InlineResult {
  // Addresses inlined so far, reported back so the build can drop those files.
  const inlined: string[] = []
  // Visit each stylesheet link and decide what replaces it.
  const output = html.replace(STYLESHEET_LINK, (link, href: string) => {
    // The stylesheet's rules, if the build has them.
    const css = readCss(href)
    // Unknown file: keep the link, so the page still gets its styles the usual way.
    if (css === undefined) return link
    // SECURITY: "</style" would close the element early and let the rest of the stylesheet be
    // read as HTML (markup injection into every page). Fail the build instead.
    if (STYLE_END.test(css)) throw new Error(`${href} contains "</style" and can't be inlined`)
    // Relative paths would resolve against the page instead of /assets/ and break fonts.
    if (RELATIVE_URL.test(css)) throw new Error(`${href} uses relative url() paths`)
    // Record it and put the rules where the link was.
    inlined.push(href)
    return `<style>${css}</style>`
  })
  // The new page and what went into it.
  return { html: output, inlined }
}
