let resolvedApiKeyFromEnv: string | null | undefined

/** Env-only Gemini key lookup (safe for modules that must not import `lib/gemini.ts`). */
export async function resolveGeminiApiKeyFromEnv(): Promise<string | null> {
  if (resolvedApiKeyFromEnv !== undefined) return resolvedApiKeyFromEnv
  const fromEnv = process.env.GEMINI_API_KEY?.trim()
  resolvedApiKeyFromEnv = fromEnv || null
  return resolvedApiKeyFromEnv
}

/** Reset cached env key (tests). */
export function resetGeminiApiKeyEnvCacheForTests(): void {
  resolvedApiKeyFromEnv = undefined
}
