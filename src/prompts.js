export const OPERATIONS = Object.freeze({
  summarize: {
    label: 'Summary',
    instruction:
      'Write a concise, useful summary of the note. Preserve the important facts and do not invent information. Return only the summary.'
  },
  cleanup: {
    label: 'Cleaned note',
    instruction:
      'Rewrite the note clearly and professionally while preserving its meaning and every important detail. Do not add new information. Return only the rewritten note.'
  },
  actions: {
    label: 'Action items',
    instruction:
      'Extract only concrete action items supported by the note. Use a short bulleted list. Include owners and timing when stated. Do not invent tasks. If there are no action items, say so.'
  }
})

export function createHistory(operation, note) {
  const config = OPERATIONS[operation]
  if (!config) throw new Error('Unknown operation.')

  const cleanNote = note.trim()
  if (!cleanNote) throw new Error('Enter a note before generating.')

  return [
    {
      role: 'system',
      content:
        'You are LocalNote, a precise writing assistant. Follow the requested operation faithfully. Never introduce facts that are not present in the note.'
    },
    {
      role: 'user',
      content: `${config.instruction}\n\nNOTE:\n${cleanNote}`
    }
  ]
}
