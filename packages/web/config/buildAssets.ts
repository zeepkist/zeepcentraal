const DEFAULT_BUILD_REVISION = 'local'
const MAX_BUILD_REVISION_LENGTH = 80

export const normalizeBuildRevision = (revision?: string) => {
	const normalized = revision
		?.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_BUILD_REVISION_LENGTH)

	return normalized || DEFAULT_BUILD_REVISION
}

export const getBuildAssetsDir = (revision?: string) =>
	`/_nuxt/${normalizeBuildRevision(revision)}/`
