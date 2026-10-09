/**
 * Browser tests for Courses (admin REQUIREMENTS section 12), on desktop and phone profiles,
 * against the production build with the demo platform.
 */

// Playwright's test runner and assertions.
import { expect, test } from '@playwright/test'

// Admin helpers.
import { expectNoAxeViolations, signInAs, watchCspViolations } from './helpers.ts'

test('the list opens filtered to courses without a teacher, and a new course survives a reload', async ({
  page,
}) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // The dashboard's link: courses without a teacher.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fcourses%3Fteacher%3Dnone')
  await signInAs(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Courses' })).toBeVisible()
  await expect(page.getByLabel('Teacher')).toHaveValue('none')
  await expect(page.getByRole('link', { name: 'CSC 301' })).toBeVisible()
  await expect(page.getByText('Showing 1–1 of 1')).toBeVisible()
  await expectNoAxeViolations(page)

  // Create a course; a taken code is refused first.
  await page.getByRole('button', { name: 'Create course' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create a course' })
  await dialog.getByLabel('Course code').fill('csc301')
  await dialog.getByLabel('Title').fill('Duplicate')
  await dialog.getByRole('button', { name: 'Create course' }).click()
  await expect(dialog.getByText('A course with this code already exists.')).toBeVisible()
  await dialog.getByLabel('Course code').fill('csc410')
  await dialog.getByLabel('Title').fill('Compilers')
  await expectNoAxeViolations(page)
  await dialog.getByRole('button', { name: 'Create course' }).click()
  await expect(page.getByText('Course CSC 410 created.')).toBeVisible()

  // Listed without a teacher, and still there after a reload.
  await expect(page.getByRole('link', { name: 'CSC 410' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: 'CSC 410' })).toBeVisible()
  expect(cspViolations).toEqual([])
})

test('a teacher is assigned and removed, and students are enrolled from a preview', async ({
  page,
}) => {
  // Open the untaught course.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fcourses')
  await signInAs(page)
  await page.getByRole('link', { name: 'CSC 301' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'CSC 301 · Operating Systems' }),
  ).toBeVisible()
  await expect(page.getByText('No teacher assigned.')).toBeVisible()

  // Assign Dr. Smith.
  await page.getByRole('button', { name: 'Assign teacher' }).click()
  const assign = page.getByRole('dialog', { name: 'Assign a teacher' })
  await assign.getByLabel('Teacher').selectOption({ label: 'Dr. Smith' })
  await assign.getByRole('button', { name: 'Assign teacher' }).click()
  await expect(page.getByText('Dr. Smith now teaches CSC 301.')).toBeVisible()

  // Remove: asks first.
  await page.getByRole('button', { name: 'Remove teacher' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Remove Dr. Smith?' })
  await confirm.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('No teacher assigned.')).toBeVisible()

  // Enrol: a preview first, then only the valid row.
  await page.getByRole('tab', { name: 'Students' }).click()
  await page.getByRole('button', { name: 'Enrol students' }).click()
  const enrol = page.getByRole('dialog', { name: 'Enrol students' })
  await enrol
    .getByLabel('Emails or student numbers')
    .fill('student@conote.example\nnobody@conote.example\nteacher@conote.example')
  await enrol.getByRole('button', { name: 'Preview' }).click()
  await expect(enrol.getByText('Will be enrolled (1)')).toBeVisible()
  await expect(enrol.getByText('Not matched (2)')).toBeVisible()
  await expect(enrol.getByText(/^nobody@conote\.example — No account found/)).toBeVisible()
  await expect(enrol.getByText(/^teacher@conote\.example — Not a student/)).toBeVisible()
  await expectNoAxeViolations(page)
  await enrol.getByRole('button', { name: 'Enrol 1 student' }).click()
  await expect(page.getByText('Enrolled 1 student.')).toBeVisible()

  // The student is listed; removing asks first.
  const table = page.getByRole('table', { name: 'Students in CSC 301' })
  await expect(table.getByText('student@conote.example')).toBeVisible()
  await expectNoAxeViolations(page)
  await table
    .getByRole('button', { name: /^Remove / })
    .first()
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('removed from CSC 301.')).toBeVisible()
})

test('an archived course leaves the list, refuses changes, and comes back when restored', async ({
  page,
}) => {
  // Open a course's details.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fcourses%3Fq%3Dcsc%2520301')
  await signInAs(page)
  await page.getByRole('link', { name: 'CSC 301' }).click()

  // Archive: asks first, then the page locks.
  await page.getByRole('button', { name: 'Archive' }).click()
  await page
    .getByRole('alertdialog', { name: 'Archive CSC 301?' })
    .getByRole('button', { name: 'Archive' })
    .click()
  await expect(page.getByText('This course is archived. Restore it to make changes.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)

  // Gone from the list, present in the archived view.
  await page.goto('/admin/courses?q=csc%20301')
  await expect(page.getByText('Nothing matches these filters.')).toBeVisible()
  // The checkbox follows the address, so it is checked once the address has changed.
  await page.getByRole('checkbox', { name: 'Show archived courses' }).click()
  await expect(page.getByRole('checkbox', { name: 'Show archived courses' })).toBeChecked()
  await expect(page.getByRole('link', { name: 'CSC 301' })).toBeVisible()
  await expectNoAxeViolations(page)

  // Restore from the row menu.
  await page.getByRole('button', { name: 'Actions for CSC 301' }).click()
  await page.getByRole('menuitem', { name: 'Restore' }).click()
  await expect(page.getByText('CSC 301 restored.')).toBeVisible()
})

test('the dashboard alert leads to courses with requests, and a request is approved then declined', async ({
  page,
}) => {
  // Watch for Content-Security-Policy breaks throughout.
  const cspViolations = watchCspViolations(page)
  // The dashboard's link: courses with students waiting to join.
  await page.goto('/admin/login?redirect=%2Fadmin%2Fcourses%3Frequests%3Dwaiting')
  await signInAs(page)
  await expect(page.getByLabel('Requests waiting')).toBeChecked()
  // MTH 202 has two students waiting.
  await expect(page.getByText('2 waiting')).toBeVisible()
  await expectNoAxeViolations(page)

  // Open the course's Requests tab.
  await page.getByRole('link', { name: 'MTH 202' }).click()
  await page.getByRole('tab', { name: 'Requests (2)' }).click()
  const table = page.getByRole('table', { name: 'Requests to join MTH 202' })
  await expect(table.getByRole('row')).toHaveCount(3)
  await expectNoAxeViolations(page)

  // Approve the first: the tab count drops, and the student is on the roster.
  await table
    .getByRole('button', { name: /^Approve / })
    .first()
    .click()
  await expect(page.getByText(/ added to MTH 202\./)).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Requests (1)' })).toBeVisible()

  // Decline the other: nobody is left waiting.
  await table.getByRole('button', { name: /^Decline / }).click()
  await expect(page.getByText('No students are waiting to join.')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Requests', exact: true })).toBeVisible()
  expect(cspViolations).toEqual([])
})
