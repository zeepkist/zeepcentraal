import {
	MODKIST_RELEASE_CHANNELS,
	MODKIST_RELEASE_FORMATS,
	type ModkistReleaseChannel,
	type ModkistReleaseFormat,
} from '../../../../../app/types/modkist'
import {
	getModkistReleases,
	MODKIST_RELEASES_URL,
	resolveModkistDownloadUrl,
} from '../../../../utils/githubModkist'
import { assertSameOrigin } from '../../../../utils/request'

function includes<T extends string>(values: readonly T[], value: string): value is T {
	return values.includes(value as T)
}

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	const channel = getRouterParam(event, 'channel') ?? ''
	const format = getRouterParam(event, 'format') ?? ''
	if (
		!includes(MODKIST_RELEASE_CHANNELS, channel) ||
		!includes(MODKIST_RELEASE_FORMATS, format)
	) {
		throw createError({ statusCode: 404, statusMessage: 'Modkist download not found' })
	}

	let destination = MODKIST_RELEASES_URL
	try {
		const releases = await getModkistReleases()
		destination = resolveModkistDownloadUrl(
			releases,
			channel as ModkistReleaseChannel,
			format as ModkistReleaseFormat,
		)
	} catch {
		// GitHub outages and missing credentials fall back to the trusted releases page.
	}
	return sendRedirect(event, destination, 302)
})
