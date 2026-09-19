const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

export class ApiError extends Error {
  constructor(message, { status = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL

  if (raw == null || String(raw).trim() === '') {
    throw new ApiError(
      'API base URL is not configured. Set VITE_API_BASE_URL in your frontend environment (see .env.example).',
    )
  }

  return String(raw).trim().replace(/\/+$/, '')
}

function buildUrl(pathname, query) {
  const url = new URL(`${getApiBaseUrl()}${pathname}`)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url.toString()
}

function messageForStatus(status) {
  switch (status) {
    case 400:
      return 'The request was invalid (400). Check the required fields and try again.'
    case 404:
      return 'The requested API route was not found (404).'
    case 500:
      return 'The LoopBreak API encountered a server error (500).'
    case 501:
      return 'This API endpoint is not implemented yet (501).'
    default:
      return `The LoopBreak API request failed (${status}).`
  }
}

function errorMessageFromBody(data) {
  if (!data || typeof data !== 'object') {
    return null
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim()
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim()
  }

  return null
}

async function parseResponseBody(response) {
  let text

  try {
    text = await response.text()
  } catch {
    throw new ApiError(
      'The API response could not be read.',
      { status: response.status },
    )
  }

  if (!text || text.trim() === '') {
    if (!response.ok) {
      throw new ApiError(messageForStatus(response.status), {
        status: response.status,
      })
    }

    throw new ApiError('The API returned an empty response.', {
      status: response.status,
    })
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError('The API returned a response that was not valid JSON.', {
      status: response.status,
    })
  }
}

async function request(pathname, { method, body, query } = {}) {
  const url = buildUrl(pathname, query)
  const options = {
    method,
    headers: method === 'GET' ? {} : JSON_HEADERS,
  }

  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  let response

  try {
    response = await fetch(url, options)
  } catch {
    throw new ApiError(
      'Unable to reach the LoopBreak API. Check your network connection and VITE_API_BASE_URL.',
    )
  }

  const data = await parseResponseBody(response)
  const bodyError = errorMessageFromBody(data)

  if (!response.ok) {
    throw new ApiError(bodyError || messageForStatus(response.status), {
      status: response.status,
    })
  }

  if (data && typeof data === 'object' && data.success === false) {
    throw new ApiError(
      bodyError || 'The LoopBreak API reported that the request did not succeed.',
      { status: response.status },
    )
  }

  return data
}

export async function createAttempt(payload) {
  return request('/attempt', {
    method: 'POST',
    body: payload,
  })
}

export async function analyzeAttempts(payload) {
  return request('/analyze', {
    method: 'POST',
    body: payload,
  })
}

export async function saveMemory(payload) {
  return request('/memory', {
    method: 'POST',
    body: payload,
  })
}

export async function recallMemory(params = {}) {
  const { repo_id, component, hypothesis_category, session_id } = params

  if (!repo_id || !component) {
    throw new ApiError('Recall requires repo_id and component.')
  }

  return request('/recall', {
    method: 'GET',
    query: {
      repo_id,
      component,
      hypothesis_category,
      session_id,
    },
  })
}
