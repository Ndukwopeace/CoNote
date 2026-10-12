/**
 * The one place the language model is called. The summary pipeline and Ask AI both go through it,
 * so the key is sent to one address from one function, and each kind of refusal is told apart the
 * same way for both.
 */

// The error a failed call becomes, and the message shape.
import { PipelineError, type ChatMessage } from './summaryDraft.ts'

// SECURITY: the key is sent only to this address, never to one a request names.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// How long one call may take before it is given up, in milliseconds.
const MODEL_TIMEOUT_MS = 45_000

/** What a call needs that does not change between calls. */
export interface ModelSettings {
  // The network call; tests pass a double.
  fetch: typeof fetch
  // The key for the model's service.
  apiKey: string
  // Which model answers.
  model: string
}

/** What one call asks for. */
export interface AskOptions {
  // True for an answer that must be one JSON object (the summary); false for plain text (a chat).
  json: boolean
  // The longest answer, in tokens. The model's own reasoning counts against it.
  maxTokens: number
}

/** Asks the model for its answer text. Throws a `PipelineError` the caller records or explains. */
export async function askModel(
  settings: ModelSettings,
  messages: ChatMessage[],
  options: AskOptions,
): Promise<string> {
  let response: Response
  try {
    response = await settings.fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        // SECURITY: the key goes only to the model's own address.
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: 0.2,
        max_tokens: options.maxTokens,
        // JSON mode only when the caller needs an object; a chat answer is free text.
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    })
  } catch {
    // A network failure or the timeout: nothing was received.
    throw new PipelineError('model_unreachable', 'The language model could not be reached.')
  }
  // Each refusal gets its own code, so an administrator can tell a bad key from a busy model.
  if (response.status === 429) {
    throw new PipelineError('model_busy', 'The language model is busy. It will be tried again.')
  }
  if (response.status === 401 || response.status === 403) {
    throw new PipelineError('model_key', 'The language model refused the key.')
  }
  if (!response.ok) {
    // The model's own explanation, when it sent one in its usual shape. It describes the request
    // (a retired model, a bad setting), never a note, so it is safe to keep on a record.
    const failure: unknown = await response.json().catch(() => undefined)
    const detail = (failure as { error?: { code?: unknown; message?: unknown } } | undefined)?.error
    const said = [detail?.code, detail?.message]
      .filter((part) => typeof part === 'string')
      .join(': ')
    throw new PipelineError(
      'model_error',
      `The language model returned an error (${String(response.status)})${said ? `: ${said}` : '.'}`,
    )
  }
  // The text of the first choice.
  const body: unknown = await response.json().catch(() => undefined)
  const choices = (body as { choices?: { message?: { content?: unknown } }[] } | undefined)?.choices
  const content = choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new PipelineError('bad_output', 'The language model sent no text.')
  }
  return content
}
