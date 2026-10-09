/**
 * Tests for the portal frame and the not-found page (teacher REQUIREMENTS sections 3 and 4).
 */

// Queries.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real route table.
import { routes } from '@/app/routes'
// Session factory.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

describe('TeacherLayout', () => {
  // Proves the sidebar lists only pages that exist, and no student or admin destination.
  it('lists only My courses in the sidebar', async () => {
    renderWithRouter({ routes, path: '/teacher/courses', session: makeSession('teacher') })

    const nav = await screen.findByRole('navigation', { name: 'Teacher navigation' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent.trim()),
    ).toEqual(['My courses'])
    expect(within(nav).getByRole('link', { name: 'My courses' })).toHaveAttribute(
      'href',
      '/teacher/courses',
    )
  })

  // Proves the account menu names who is signed in.
  it('names the signed-in teacher in the account menu', async () => {
    renderWithRouter({ routes, path: '/teacher/courses', session: makeSession('teacher') })

    expect(
      await screen.findByRole('button', { name: 'Account menu for Sarah Mbarga' }),
    ).toBeInTheDocument()
  })

  // Proves the bare addresses lead to My courses.
  it.each(['/', '/teacher'])('sends %s to My courses', async (path) => {
    const { router } = renderWithRouter({ routes, path, session: makeSession('teacher') })

    await screen.findByRole('heading', { level: 1, name: 'My courses' })
    expect(router.state.location.pathname).toBe('/teacher/courses')
  })

  // Proves an unknown address under /teacher shows not-found inside the frame, so the
  // navigation stays.
  it('shows not-found inside the frame under /teacher', async () => {
    renderWithRouter({ routes, path: '/teacher/nowhere', session: makeSession('teacher') })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Teacher navigation' })).toBeInTheDocument()
  })

  // Proves an unknown address outside /teacher shows not-found on its own, with no frame.
  it('shows not-found on its own outside /teacher', async () => {
    renderWithRouter({ routes, path: '/nowhere' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Teacher navigation' })).not.toBeInTheDocument()
  })
})
