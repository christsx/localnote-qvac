import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { LocalInference, MODEL_NAME } from './qvac.js'

const PORT = Number(process.env.PORT || 4173)
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url))
const MAX_NOTE_BYTES = 32_000
const inference = new LocalInference()

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > MAX_NOTE_BYTES) throw new Error('Note is too long.')
  }
  return JSON.parse(body || '{}')
}

function sendEvent(response, event) {
  response.write(`${JSON.stringify(event)}\n`)
}

async function generate(request, response) {
  try {
    const { operation, note } = await readJson(request)
    if (typeof note !== 'string' || !note.trim()) {
      return sendJson(response, 400, { error: 'Enter a note before generating.' })
    }

    response.writeHead(200, {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    })

    const result = await inference.generate({
      operation,
      note,
      onToken: (token) => sendEvent(response, { type: 'token', token })
    })
    sendEvent(response, { type: 'done', stats: result.stats })
    response.end()
  } catch (error) {
    if (!response.headersSent) return sendJson(response, 400, { error: error.message })
    sendEvent(response, { type: 'error', error: error.message })
    response.end()
  }
}

function serveStatic(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1)
  const filePath = normalize(join(PUBLIC_DIR, requested))

  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return sendJson(response, 404, { error: 'Not found.' })
  }

  response.writeHead(200, { 'content-type': MIME_TYPES[extname(filePath)] || 'application/octet-stream' })
  createReadStream(filePath).pipe(response)
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/api/status') {
    return sendJson(response, 200, { ...inference.status, model: MODEL_NAME })
  }
  if (request.method === 'POST' && request.url === '/api/generate') {
    return generate(request, response)
  }
  if (request.method === 'GET') return serveStatic(request, response)
  sendJson(response, 405, { error: 'Method not allowed.' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`LocalNote is running at http://127.0.0.1:${PORT}`)
  inference.load().catch((error) => console.error('QVAC model load failed:', error))
})

async function shutdown() {
  server.close()
  await inference.close().catch((error) => console.error('QVAC shutdown failed:', error))
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
