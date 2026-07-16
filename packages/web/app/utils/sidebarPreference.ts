export function parseSidebarOpenPreference(value: string | null): boolean | null {
	if (value === 'true') return true
	if (value === 'false') return false
	return null
}
