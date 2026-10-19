/**
 * Browser test for the timetable import (D105): a timetable PDF made on the spot is read in the
 * browser, reviewed with a dry run, and imported into the demo platform. It also proves pdf.js and
 * its worker run under the production Content-Security-Policy. Runs on desktop and on a phone,
 * against the production build.
 */

// Playwright's runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

/** One line of text placed on the page, in points from the top left. */
interface Line {
  text: string
  x: number
  y: number
}

/** The lines of a one-page timetable laid out like the school's: heading, weekdays, rows. */
function timetableLines(): Line[] {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const lines: Line[] = [
    { text: 'Weekly Class Schedule - Software Engineering (SWE)', x: 200, y: 40 },
    { text: 'Year 1 - Trimester 1', x: 273, y: 66 },
    { text: 'Time Slot', x: 48, y: 110 },
    ...days.map((day, index) => ({ text: day, x: 127 + index * 124.5, y: 110 })),
  ]
  // Each row: its two-line time label, then the cells' lines.
  const rows: { label: [string, string]; cells: Record<number, string[]> }[] = [
    {
      label: ['8:00 AM -', '10:00 AM'],
      cells: {
        0: ['SWE 101 Intro to', 'Programming', 'by Dr. Smith'],
        3: ['SWE 101 Intro to', 'Programming', 'by Dr. Smith'],
      },
    },
    {
      label: ['10:00 AM -', '12:00 PM'],
      cells: { 1: ['MTH 202 Linear', 'Algebra', 'by Mrs. Okoro'] },
    },
  ]
  rows.forEach((row, rowIndex) => {
    const top = 150 + rowIndex * 90
    lines.push({ text: row.label[0], x: 50, y: top }, { text: row.label[1], x: 50, y: top + 12.7 })
    for (const [column, cell] of Object.entries(row.cells)) {
      cell.forEach((text, lineIndex) => {
        lines.push({ text, x: 127 + Number(column) * 124.5, y: top + lineIndex * 12.7 })
      })
    }
  })
  return lines
}

test('a timetable PDF is read, previewed and imported', async ({ page, context }, testInfo) => {
  // Make the PDF with a second page: absolutely placed lines, printed to PDF.
  const maker = await context.newPage()
  const html = `<!doctype html><style>@page{size:297mm 210mm;margin:0}body{margin:0;font:10pt Helvetica,Arial,sans-serif}div{position:absolute;white-space:nowrap;line-height:12.7pt}</style>${timetableLines()
    .map((line) => `<div style="left:${line.x}pt;top:${line.y}pt">${line.text}</div>`)
    .join('')}`
  await maker.setContent(html)
  const pdfPath = testInfo.outputPath('timetable.pdf')
  await maker.pdf({ path: pdfPath, width: '297mm', height: '210mm', printBackground: true })
  await maker.close()

  // Watch for Content-Security-Policy breaks throughout (pdf.js and its worker).
  const cspViolations = watchCspViolations(page)
  await page.goto('/admin/login?redirect=%2Fadmin%2Fcourses')
  await signInAs(page)
  // The way in from Courses.
  await page.getByRole('link', { name: 'Import timetable' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Import a timetable' })).toBeVisible()

  // The file and the term.
  await page.getByLabel('Timetable PDF').setInputFiles(pdfPath)
  await page.getByLabel('First day of term').fill('2026-10-13')
  await page.getByLabel('Last day of term').fill('2026-12-22')
  await expect(page.getByLabel('Time zone')).toHaveValue('Africa/Douala')
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Read timetable' }).click()

  // The review: the programme, both courses, a teacher for the new one, and a dry-run sentence.
  await expect(
    page.getByRole('heading', { level: 2, name: 'Review before importing' }),
  ).toBeVisible()
  await expect(page.getByRole('cell', { name: 'SWE-Y1' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'SWE 101' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'MTH 202' })).toBeVisible()
  await expect(page.getByText(/This will create 1 programme, 1 course and/)).toBeVisible()
  await expect(page.getByText(/1 course already exist/)).toBeVisible()
  await expectNoAxeViolations(page)

  // Import.
  await page.getByRole('button', { name: 'Import timetable' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Timetable imported' })).toBeVisible()

  // The new course and the programme are on the platform, after a reload too.
  await page.getByRole('link', { name: 'View courses' }).click()
  await page.reload()
  await expect(page.getByRole('link', { name: 'SWE 101' })).toBeVisible()
  await page.goto('/admin/programmes')
  await expect(
    page.getByRole('table', { name: 'Programmes' }).getByText('SWE-Y1', { exact: true }),
  ).toBeVisible()
  expect(cspViolations).toEqual([])
})
