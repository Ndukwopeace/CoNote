/**
 * Tests for the colour tokens (D104): in both themes, text and link colours must be readable on
 * the page and card backgrounds (WCAG AA, 4.5:1 for small text). Reads the real tokens.css, so
 * a colour change that breaks a theme fails here before a browser test does.
 */

/// <reference types="node" />
// Reads the CSS file.
import { readFileSync } from 'node:fs'
// Joins the folder of this test with the CSS file's name.
import { join } from 'node:path'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The CSS text.
const css = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')

/** The declarations inside the first block that starts with `selector {`. */
function block(selector: string) {
  // From the selector's opening brace to its closing one.
  const start = css.indexOf(`${selector} {`)
  const end = css.indexOf('\n}', start)
  return css.slice(start, end)
}

/** Reads `--name: #hex;` from a block, as [r, g, b]. */
function colour(source: string, name: string): [number, number, number] | null {
  // The declaration for this token, if the block sets it.
  const match = new RegExp(`${name}:\\s*#([0-9a-fA-F]{6})`).exec(source)
  if (!match?.[1]) return null
  // Three hex pairs.
  const hex = match[1]
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

/** WCAG relative luminance. */
function luminance([r, g, b]: [number, number, number]) {
  // Linearise each channel, then weight them.
  const [lr = 0, lg = 0, lb = 0] = [r, g, b].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/** WCAG contrast ratio of two colours. */
function contrast(a: [number, number, number], b: [number, number, number]) {
  // Lighter over darker, each with the 0.05 offset.
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

// The light theme is `:root`; the dark one repeats only what differs, so read light first and
// let dark override it.
const light = block(':root')
const dark = block(':root.dark')

/** A theme's colour for a token: its own value, else the light one. */
function themed(theme: 'light' | 'dark', name: string) {
  // Dark falls back to light for tokens it doesn't repeat.
  const found = (theme === 'dark' ? colour(dark, name) : null) ?? colour(light, name)
  // `--secondary` is `var(--brand-primary-light)` in light: a pale tint, read from that token.
  if (!found && name === '--secondary') return themed(theme, '--brand-primary-light')
  if (!found) throw new Error(`${name} is not set`)
  return found
}

describe.each(['light', 'dark'] as const)('%s theme colours', (theme) => {
  // Backgrounds text sits on: the page and the cards.
  const backgrounds = ['--brand-background', '--brand-surface'] as const

  it.each([
    ['--brand-foreground', 'main text'],
    ['--brand-muted-foreground', 'secondary text'],
    ['--brand-link', 'links'],
    ['--brand-primary-dark', 'active-navigation text'],
  ])('%s (%s) is readable on the page and on cards', (token) => {
    for (const background of backgrounds) {
      expect(contrast(themed(theme, token), themed(theme, background))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('has secondary button text that is readable on the secondary fill', () => {
    // Secondary buttons use --secondary with --secondary-foreground, which is --brand-primary-dark.
    expect(
      contrast(themed(theme, '--brand-primary-dark'), themed(theme, '--secondary')),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('has white button text that is readable on the primary colour', () => {
    // Buttons fill with --brand-primary and carry white text in both themes.
    expect(contrast([255, 255, 255], themed(theme, '--brand-primary'))).toBeGreaterThanOrEqual(4.5)
  })
})
