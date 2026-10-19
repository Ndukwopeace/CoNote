/**
 * Tests for reading a PDF's text and positions through pdf.js (D105). pdf.js itself is replaced
 * with a small stand-in, so the tests check our mapping and our limits, not the library; the real
 * library is exercised by the browser test.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test and the part of pdf.js it uses.
import { extractPages, type PdfJs } from './extractPdf'

/** A stand-in pdf.js whose document has the given pages of raw text items. */
function fakePdfJs(pages: readonly (readonly unknown[])[]): PdfJs {
  return {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: (number: number) =>
          Promise.resolve({
            getTextContent: () => Promise.resolve({ items: pages[number - 1] ?? [] }),
          }),
      }),
    }),
  }
}

/** A text item as pdf.js gives it: its string and a transform whose last two numbers are x and y. */
const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] })

describe('extractPages', () => {
  // Proves each item's text and position are carried over, page by page.
  it('maps text items to text and position', async () => {
    const pages = await extractPages(
      new ArrayBuffer(8),
      fakePdfJs([[item('Monday', 126.8, 393)], [item('Friday', 600, 390)]]),
    )

    expect(pages).toEqual([
      { items: [{ text: 'Monday', x: 126.8, y: 393 }] },
      { items: [{ text: 'Friday', x: 600, y: 390 }] },
    ])
  })

  // Proves marked-content entries, which have no text, are left out.
  it('skips entries that are not text', async () => {
    const pages = await extractPages(
      new ArrayBuffer(8),
      fakePdfJs([
        [
          { type: 'beginMarkedContent', id: 'a' },
          item('Hello', 1, 2),
          { type: 'endMarkedContent' },
        ],
      ]),
    )

    expect(pages[0]?.items).toEqual([{ text: 'Hello', x: 1, y: 2 }])
  })

  // Proves a file with more pages than any timetable has is refused before it is read.
  it('refuses a file with too many pages', async () => {
    const many = Array.from({ length: 61 }, () => [item('x', 0, 0)])

    const refused = extractPages(new ArrayBuffer(8), fakePdfJs(many))

    await expect(refused).rejects.toMatchObject({ kind: 'validation' })
    await expect(refused).rejects.toThrow(/pages/)
  })

  // Proves a file pdf.js cannot open (not a PDF, damaged, locked) gives a plain message.
  it("explains a file that can't be read", async () => {
    const broken: PdfJs = {
      getDocument: () => ({ promise: Promise.reject(new Error('Invalid PDF structure.')) }),
    }

    const refused = extractPages(new ArrayBuffer(8), broken)

    await expect(refused).rejects.toMatchObject({ kind: 'validation' })
    await expect(refused).rejects.toThrow("can't be read")
  })
})
