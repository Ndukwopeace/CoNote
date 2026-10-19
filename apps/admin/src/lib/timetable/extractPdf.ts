/**
 * Reads the text of a PDF, with where each piece sits, through pdf.js (D105). The library is
 * large, so it is loaded only when an administrator opens the import; the rest of the app never
 * downloads it. Only text is read: nothing is drawn, so no PDF can run code on the page.
 */

// The error type every service throws, so the page shows its message as it is.
import { AppError } from '@conote/core/errors'

// The shape the parser reads.
import type { PageText } from './types'

/** The most pages a timetable may have. A bigger file is not a timetable. */
const MAX_PAGES = 60

/** The part of a pdf.js page this file uses. */
interface PdfPage {
  getTextContent(): Promise<{ items: readonly unknown[] }>
}
/** The part of a pdf.js document this file uses. */
interface PdfDocument {
  numPages: number
  getPage(number: number): Promise<PdfPage>
}
/** The part of the pdf.js module this file uses. */
export interface PdfJs {
  getDocument(source: { data: Uint8Array; isEvalSupported: boolean }): {
    promise: Promise<PdfDocument>
  }
}

/** Loads pdf.js and points it at its worker file, which the build serves from this site. */
async function loadPdfJs(): Promise<PdfJs> {
  // Both are loaded together, and only here.
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  // The worker is a file of our own, so the security policy (worker-src 'self') allows it.
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

/** A text entry: pdf.js also lists marked-content markers, which have no string. */
function isTextEntry(entry: unknown): entry is { str: string; transform: number[] } {
  if (typeof entry !== 'object' || entry === null) return false
  const candidate = entry as { str?: unknown; transform?: unknown }
  return typeof candidate.str === 'string' && Array.isArray(candidate.transform)
}

/**
 * The text of every page, each piece with its position. Rejects with a validation error, in
 * words a person can read, for a file that is not a readable PDF or is too long to be a timetable.
 * `pdfjs` is for tests; the app loads the real library.
 */
export async function extractPages(data: ArrayBuffer, pdfjs?: PdfJs): Promise<PageText[]> {
  const library = pdfjs ?? (await loadPdfJs())
  let document: PdfDocument
  try {
    // SECURITY: pdf.js may not run the file's scripts or build functions from its fonts
    // (isEvalSupported is off), so a crafted PDF cannot run code, and the page's security policy,
    // which forbids eval, is not broken.
    document = await library.getDocument({ data: new Uint8Array(data), isEvalSupported: false })
      .promise
  } catch (error) {
    throw new AppError('validation', "This file can't be read as a PDF.", { cause: error })
  }
  if (document.numPages > MAX_PAGES) {
    throw new AppError(
      'validation',
      `This file has too many pages (more than ${String(MAX_PAGES)}) to be a timetable.`,
    )
  }
  // The pages are read together (there are at most MAX_PAGES), and kept in order.
  const doc = document
  return Promise.all(
    Array.from({ length: doc.numPages }, async (_, index): Promise<PageText> => {
      const content = await (await doc.getPage(index + 1)).getTextContent()
      return {
        items: content.items
          .filter(isTextEntry)
          // The transform's last two numbers are where the text starts.
          .map((entry) => ({
            text: entry.str,
            x: entry.transform[4] ?? 0,
            y: entry.transform[5] ?? 0,
          })),
      }
    }),
  )
}
