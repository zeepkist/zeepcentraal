const EXACT_SEMVER =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function parseExactVersion(input: string): string | null {
	const value = input.trim().replace(/^v/, '')
	return EXACT_SEMVER.test(value) ? value : null
}

export function isExactModVersionOutdated(modVersion: string, minimumVersion: string): boolean {
	const current = parseExactVersion(modVersion)
	const minimum = parseExactVersion(minimumVersion)
	if (!current || !minimum) return true
	if (current.includes('-') && !minimum.includes('-')) {
		const currentRelease = current.split('-', 1)[0]
		const minimumRelease = minimum.split('+', 1)[0]
		return (
			currentRelease === minimumRelease ||
			Bun.semver.satisfies(currentRelease ?? current, `<${minimumRelease ?? minimum}`)
		)
	}
	return Bun.semver.satisfies(current, `<${minimum}`)
}
