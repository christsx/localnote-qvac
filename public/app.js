const note = document.querySelector('#note')
const output = document.querySelector('#output')
const outputTitle = document.querySelector('#output-title')
const buttons = [...document.querySelectorAll('[data-operation]')]
const count = document.querySelector('#character-count')
const status = document.querySelector('#model-status')
const statusLabel = document.querySelector('#status-label')
const progressTrack = document.querySelector('#progress-track')
const progressBar = document.querySelector('#progress-bar')
const copyButton = document.querySelector('#copy-button')
const stats = document.querySelector('#stats')

const labels = {
  summarize: 'Summary',
  cleanup: 'Cleaned note',
  actions: 'Action items'
}

let isGenerating = false
let currentText = ''

function updateCount() {
  const length = note.value.length
  count.textContent = `${length.toLocaleString()} character${length === 1 ? '' : 's'}`
}

function setBusy(busy, operation) {
  isGenerating = busy
  buttons.forEach((button) => {
    button.disabled = busy
    button.classList.toggle('active', busy && button.dataset.operation === operation)
  })
}

function renderStats(result) {
  const parts = []
  if (Number.isFinite(result?.tokensPerSecond)) parts.push(`${result.tokensPerSecond.toFixed(1)} tok/s`)
  if (Number.isFinite(result?.generatedTokens)) parts.push(`${result.generatedTokens} tokens`)
  if (Number.isFinite(result?.promptTokensPerSecond)) parts.push(`${result.promptTokensPerSecond.toFixed(1)} prompt tok/s`)
  stats.textContent = parts.join('  ·  ')
  stats.hidden = parts.length === 0
}

async function generate(operation) {
  if (isGenerating) return
  if (!note.value.trim()) {
    outputTitle.textContent = 'Note required'
    output.className = 'output-content error'
    output.textContent = 'Enter a note before generating.'
    note.focus()
    return
  }

  setBusy(true, operation)
  currentText = ''
  outputTitle.textContent = labels[operation]
  output.className = 'output-content generating'
  output.textContent = ''
  copyButton.hidden = true
  stats.hidden = true

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation, note: note.value })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Generation failed.')
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line)
        if (event.type === 'token') {
          currentText += event.token
          output.textContent = currentText
        } else if (event.type === 'done') {
          renderStats(event.stats)
        } else if (event.type === 'error') {
          throw new Error(event.error)
        }
      }
    }

    output.classList.remove('generating')
    copyButton.hidden = !currentText.trim()
  } catch (error) {
    outputTitle.textContent = 'Couldn’t generate'
    output.className = 'output-content error'
    output.textContent = error.message
  } finally {
    setBusy(false)
  }
}

async function refreshStatus() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' })
    const model = await response.json()
    status.dataset.state = model.state
    statusLabel.textContent = model.label
    const showProgress = model.state === 'downloading' && Number.isFinite(model.progress)
    progressTrack.hidden = !showProgress
    progressBar.style.width = `${model.progress || 0}%`
  } catch {
    status.dataset.state = 'error'
    statusLabel.textContent = 'Local server unavailable'
  }
}

buttons.forEach((button) => button.addEventListener('click', () => generate(button.dataset.operation)))
note.addEventListener('input', updateCount)
copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(currentText.trim())
  copyButton.textContent = 'Copied'
  setTimeout(() => { copyButton.textContent = 'Copy' }, 1200)
})

updateCount()
refreshStatus()
setInterval(refreshStatus, 800)
