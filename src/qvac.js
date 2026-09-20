import {
  LLAMA_3_2_1B_INST_Q4_0,
  completion,
  loadModel,
  unloadModel
} from '@qvac/sdk'

import { createHistory } from './prompts.js'

export const MODEL_NAME = 'Llama 3.2 1B Instruct Q4_0'

export class LocalInference {
  #modelId = null
  #loadPromise = null
  #listeners = new Set()
  #status = { state: 'idle', label: 'Model not loaded', progress: null }

  get status() {
    return { ...this.#status }
  }

  subscribe(listener) {
    this.#listeners.add(listener)
    listener(this.status)
    return () => this.#listeners.delete(listener)
  }

  #setStatus(status) {
    this.#status = status
    for (const listener of this.#listeners) listener(this.status)
  }

  async load() {
    if (this.#modelId) return this.#modelId
    if (this.#loadPromise) return this.#loadPromise

    this.#setStatus({ state: 'loading', label: 'Preparing local model', progress: null })
    this.#loadPromise = loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelConfig: { ctx_size: 4096 },
      onProgress: (progress) => {
        const percentage = Math.max(0, Math.min(100, Math.round(progress.percentage)))
        this.#setStatus({
          state: 'downloading',
          label: `Downloading model — ${percentage}%`,
          progress: percentage
        })
      }
    })
      .then((modelId) => {
        this.#modelId = modelId
        this.#setStatus({ state: 'ready', label: 'Model ready', progress: 100 })
        return modelId
      })
      .catch((error) => {
        this.#loadPromise = null
        this.#setStatus({ state: 'error', label: 'Model error', progress: null, error: error.message })
        throw error
      })

    return this.#loadPromise
  }

  async generate({ operation, note, onToken }) {
    const modelId = await this.load()
    const history = createHistory(operation, note)
    this.#setStatus({ state: 'generating', label: 'Generating locally', progress: 100 })

    try {
      const run = completion({
        modelId,
        history,
        stream: true,
        maxTokens: 400,
        temperature: 0.2
      })

      let text = ''
      for await (const token of run.tokenStream) {
        text += token
        onToken(token)
      }

      const stats = await run.stats
      return { text: text.trim(), stats: stats ?? null }
    } finally {
      this.#setStatus({ state: 'ready', label: 'Model ready', progress: 100 })
    }
  }

  async close() {
    if (!this.#modelId) return
    await unloadModel({ modelId: this.#modelId })
    this.#modelId = null
  }
}
