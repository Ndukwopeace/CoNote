/**
 * Downloads a form's answers as a CSV file (D126). The answers come a page at a time, so this asks for
 * every page and joins them, then hands the file to the browser. Nothing is sent anywhere else.
 */

// Local state.
import { useState } from 'react'

// The shapes.
import type { FormQuestion } from '@conote/core/forms'

// The services.
import { useServices } from '@/services/useServices'
// The CSV.
import { responsesToCsv } from '@/lib/forms'
// The shapes.
import {
  FORM_RESPONSES_PAGE_SIZE,
  type FormResponseFilter,
  type FormResponseItem,
} from '@/types/forms'

/** A file name from a form's title: letters and digits only, so it is safe on any computer. */
function fileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return `${slug === '' ? 'form' : slug}-responses.csv`
}

/** Starts a download of `text` as `name`. */
function download(text: string, name: string) {
  // A byte order mark first, so Excel reads accented names as UTF-8.
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** A function that downloads the answers, and whether it is working or failed. */
export function useCsvDownload(
  formId: string,
  title: string,
  questions: readonly FormQuestion[],
  filter: FormResponseFilter,
) {
  // The form service.
  const { forms } = useServices()
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)

  /** Fetches every page of the answers and downloads them. */
  async function run() {
    setWorking(true)
    setFailed(false)
    try {
      const all: FormResponseItem[] = []
      let total = Number.POSITIVE_INFINITY
      while (all.length < total) {
        const page = await forms.listResponses(formId, { ...filter, offset: all.length })
        all.push(...page.items)
        total = page.total
        // A page with nothing in it ends the loop, whatever the total says.
        if (page.items.length === 0) break
      }
      download(responsesToCsv(questions, all), fileName(title))
    } catch {
      setFailed(true)
    } finally {
      setWorking(false)
    }
  }

  return { run, working, failed, pageSize: FORM_RESPONSES_PAGE_SIZE }
}
