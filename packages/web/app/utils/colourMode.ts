export type ResolvedColourMode = 'dark' | 'light'

export function resolveInitialColourMode(preference: unknown): ResolvedColourMode {
	return preference === 'light' ? 'light' : 'dark'
}
