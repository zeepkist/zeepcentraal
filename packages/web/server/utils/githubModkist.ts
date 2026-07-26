import type {
	ModkistRelease,
	ModkistReleaseAsset,
	ModkistReleaseChannel,
	ModkistReleaseFormat,
	ModkistReleases,
} from '../../app/types/modkist'
import { MODKIST_RELEASES_URL, MODKIST_SOURCE_URL } from '../../app/types/modkist'
import { getSharedCached } from './sharedCache'

export { MODKIST_RELEASES_URL, MODKIST_SOURCE_URL }

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql'

type GitHubReleaseAsset = {
	contentType?: string | null
	downloadUrl?: string | null
	name?: string | null
	size?: number | null
}

type GitHubRelease = {
	isDraft?: boolean | null
	isPrerelease?: boolean | null
	name?: string | null
	publishedAt?: string | null
	releaseAssets?: { nodes?: Array<GitHubReleaseAsset | null> | null } | null
	tagName?: string | null
	url?: string | null
}

export type GitHubModkistReleaseQueryResult = {
	repository?: {
		latestRelease?: GitHubRelease | null
		releases?: { nodes?: Array<GitHubRelease | null> | null } | null
	} | null
}

type GitHubGraphqlResponse = {
	data?: GitHubModkistReleaseQueryResult
	errors?: Array<{ message?: string }>
}

const MODKIST_RELEASE_QUERY = `
	query ZeepCentraal_ModkistReleases($owner: String!, $name: String!) {
		repository(owner: $owner, name: $name) {
			latestRelease { ...ModkistReleaseFields }
			releases(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
				nodes { ...ModkistReleaseFields }
			}
		}
	}
	fragment ModkistReleaseFields on Release {
		name
		tagName
		url
		publishedAt
		isDraft
		isPrerelease
		releaseAssets(first: 50) {
			nodes {
				name
				downloadUrl
				contentType
				size
			}
		}
	}
`

function assetFormat(name: string): ModkistReleaseFormat | null {
	const normalized = name.toLowerCase()
	if (normalized.endsWith('.appimage')) return 'appimage'
	if (normalized.endsWith('.msi')) return 'msi'
	if (normalized.endsWith('.deb')) return 'deb'
	if (normalized.endsWith('.dmg')) return 'dmg'
	return null
}

export function isTrustedModkistDownloadUrl(value: string): boolean {
	try {
		const url = new URL(value)
		return (
			url.protocol === 'https:' &&
			url.hostname === 'github.com' &&
			url.username === '' &&
			url.password === '' &&
			url.pathname.toLowerCase().startsWith('/thundernerd/modkistmkii/releases/download/')
		)
	} catch {
		return false
	}
}

function normalizeAsset(asset: GitHubReleaseAsset): ModkistReleaseAsset | null {
	if (!asset.name || !asset.downloadUrl || !isTrustedModkistDownloadUrl(asset.downloadUrl)) {
		return null
	}
	return {
		contentType: asset.contentType ?? null,
		downloadUrl: asset.downloadUrl,
		name: asset.name,
		size: Math.max(0, asset.size ?? 0),
	}
}

function normalizeRelease(release: GitHubRelease | null | undefined): ModkistRelease | null {
	if (!release || release.isDraft || !release.tagName || !release.url || !release.publishedAt) {
		return null
	}

	const assets: Partial<Record<ModkistReleaseFormat, ModkistReleaseAsset>> = {}
	for (const candidate of release.releaseAssets?.nodes ?? []) {
		if (!candidate?.name) continue
		const format = assetFormat(candidate.name)
		const asset = normalizeAsset(candidate)
		if (format && asset && !assets[format]) assets[format] = asset
	}

	return {
		assets,
		isPrerelease: Boolean(release.isPrerelease),
		name: release.name?.trim() || release.tagName,
		publishedAt: release.publishedAt,
		tagName: release.tagName,
		url: release.url,
	}
}

export function mapGitHubModkistReleases(data: GitHubModkistReleaseQueryResult): ModkistReleases {
	const stable = normalizeRelease(data.repository?.latestRelease)
	const prerelease =
		(data.repository?.releases?.nodes ?? [])
			.filter((release) => release?.isPrerelease && !release.isDraft)
			.map(normalizeRelease)
			.find((release): release is ModkistRelease => release !== null) ?? null

	return {
		prerelease,
		releasesUrl: MODKIST_RELEASES_URL,
		sourceUrl: MODKIST_SOURCE_URL,
		stable: stable ?? prerelease,
	}
}

export function resolveModkistDownloadUrl(
	releases: ModkistReleases | null,
	channel: ModkistReleaseChannel,
	format: ModkistReleaseFormat,
): string {
	const url = releases?.[channel]?.assets[format]?.downloadUrl
	return url && isTrustedModkistDownloadUrl(url) ? url : MODKIST_RELEASES_URL
}

async function requestModkistReleases(): Promise<ModkistReleases> {
	const token = String(useRuntimeConfig().githubToken || '').trim()
	if (!token) {
		throw createError({ statusCode: 503, statusMessage: 'GitHub releases are not configured' })
	}

	const response = await $fetch<GitHubGraphqlResponse>(GITHUB_GRAPHQL_URL, {
		method: 'POST',
		headers: {
			accept: 'application/vnd.github+json',
			authorization: `Bearer ${token}`,
			'user-agent': 'ZeepCentraal',
		},
		body: {
			query: MODKIST_RELEASE_QUERY,
			operationName: 'ZeepCentraal_ModkistReleases',
			variables: { owner: 'Thundernerd', name: 'ModkistMKII' },
		},
		timeout: 5_000,
	})

	if (response.errors?.length || !response.data?.repository) {
		throw createError({ statusCode: 502, statusMessage: 'GitHub releases request failed' })
	}
	return mapGitHubModkistReleases(response.data)
}

export function getModkistReleases(): Promise<ModkistReleases> {
	return getSharedCached('web:github:modkist-releases', requestModkistReleases)
}
