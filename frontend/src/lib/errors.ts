import axios from 'axios'

/** Extract a human-readable message from a Laravel API error response. */
export function extractApiError(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) {
    return fallback
  }

  const data = err.response?.data as
    | { message?: string; errors?: Record<string, string[]> }
    | undefined

  if (!data) {
    return fallback
  }

  if (typeof data.message === 'string' && data.message.trim() !== '') {
    return data.message
  }

  if (data.errors && typeof data.errors === 'object') {
    const lines = Object.values(data.errors)
      .flat()
      .filter((line): line is string => typeof line === 'string' && line.trim() !== '')

    if (lines.length > 0) {
      return lines.join('\n')
    }
  }

  return fallback
}
