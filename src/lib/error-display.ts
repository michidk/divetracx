export interface ErrorDisplayState {
  title: string
  message: string
  hint?: string
}

const DEFAULT_ERROR_STATE: ErrorDisplayState = {
  title: 'Something went wrong',
  message: 'Divetracx could not load this page.',
  hint: 'Try again. If the problem continues, check the server logs.',
}

function getErrorMessages(error: unknown): string[] {
  const messages: string[] = []
  const seen = new Set<unknown>()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)

    if (current instanceof Error) {
      if (current.message) messages.push(current.message)
      current = current.cause
      continue
    }

    if (typeof current === 'string') messages.push(current)
    break
  }

  return messages
}

export function getErrorDisplayState(error: unknown): ErrorDisplayState {
  const message = getErrorMessages(error).join('\n').toLowerCase()

  if (
    message.includes('database_url') &&
    (message.includes('required') ||
      message.includes('missing') ||
      message.includes('not configured'))
  ) {
    return {
      title: 'Database not configured',
      message: 'Divetracx is missing its PostgreSQL connection settings.',
      hint: 'Set DATABASE_URL, restart the server, then try again.',
    }
  }

  if (
    message.includes('econnrefused') ||
    message.includes('connection refused') ||
    message.includes('connection terminated') ||
    message.includes('failed to connect')
  ) {
    return {
      title: 'Database unavailable',
      message: 'Divetracx could not reach PostgreSQL.',
      hint: 'Check that the database is running and reachable, then try again.',
    }
  }

  if (
    message.includes('does not exist') &&
    (message.includes('relation') ||
      message.includes('column') ||
      message.includes('table'))
  ) {
    return {
      title: 'Database update required',
      message: 'The database schema does not match this version of Divetracx.',
      hint: 'Apply the latest database migrations, then try again.',
    }
  }

  if (message.includes('failed query:')) {
    return {
      title: 'Dive data unavailable',
      message: 'Divetracx could not read the requested data.',
      hint: 'Check the database connection and migrations, then try again.',
    }
  }

  return DEFAULT_ERROR_STATE
}
