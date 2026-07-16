export const MODKIST_RELEASE_CHANNELS = ['stable', 'prerelease'] as const
export const MODKIST_RELEASE_FORMATS = ['msi', 'appimage', 'deb', 'dmg'] as const
export const MODKIST_RELEASES_URL = 'https://github.com/Thundernerd/ModkistMKII/releases'
export const MODKIST_SOURCE_URL = 'https://github.com/Thundernerd/ModkistMKII'

export type ModkistReleaseChannel = (typeof MODKIST_RELEASE_CHANNELS)[number]
export type ModkistReleaseFormat = (typeof MODKIST_RELEASE_FORMATS)[number]

export type ModkistReleaseAsset = {
	contentType: string | null
	downloadUrl: string
	name: string
	size: number
}

export type ModkistRelease = {
	assets: Partial<Record<ModkistReleaseFormat, ModkistReleaseAsset>>
	isPrerelease: boolean
	name: string
	publishedAt: string
	tagName: string
	url: string
}

export type ModkistReleases = {
	prerelease: ModkistRelease | null
	releasesUrl: string
	sourceUrl: string
	stable: ModkistRelease | null
}
