export interface SplitResult {
  inline: string
  extracted: string[]
}

export function splitContent(draft: string): SplitResult {
  if (draft.length <= 500) return { inline: draft, extracted: [] }
  return {
    inline: draft.slice(0, 500),
    extracted: [draft.slice(500)],
  }
}
