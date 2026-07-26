export const MODKIST_RELEASE_CHANNELS = ['stable', 'prerelease'] as const
export const MODKIST_RELEASE_FORMATS = ['msi', 'appimage', 'deb', 'dmg'] as const
export const MODKIST_RELEASES_URL = 'https://github.com/Thundernerd/ModkistMKII/releases'
export const MODKIST_SOURCE_URL = 'https://github.com/Thundernerd/ModkistMKII'

export type ModkistReleaseChannel = (typeof MODKIST_RELEASE_CHANNELS)[number]
export type ModkistReleaseFormat = (typeof MODKIST_RELEASE_FORMATS)[number]

export type ModkistReleaseAsset = {
	readonly contentType: string | null
	readonly downloadUrl: string
	readonly name: string
	readonly size: number
}

export type ModkistRelease = {
	readonly assets: Readonly<Partial<Record<ModkistReleaseFormat, ModkistReleaseAsset>>>
	readonly isPrerelease: boolean
	readonly name: string
	readonly publishedAt: string
	readonly tagName: string
	readonly url: string
}

export type ModkistReleases = {
	readonly prerelease: ModkistRelease | null
	readonly releasesUrl: string
	readonly sourceUrl: string
	readonly stable: ModkistRelease | null
}
