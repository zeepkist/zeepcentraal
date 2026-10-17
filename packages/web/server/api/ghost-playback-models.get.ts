import { defineEventHandler, useRuntimeConfig } from 'nuxt/server'
import {
	buildProtectedGhostModelBundle,
	protectedMeshCorpusDigest,
} from '../utils/protectedMeshCorpus'
import { assertSameOrigin } from '../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	const config = useRuntimeConfig()
	const [bundle, digest] = await Promise.all([
		buildProtectedGhostModelBundle(config.blockMeshCorpusPath, config.blockMeshCorpusToken),
		protectedMeshCorpusDigest(config.blockMeshCorpusPath, config.blockMeshCorpusToken),
	])
	for (const [name, value] of Object.entries({
		'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
		'content-disposition': `inline; filename="${digest.slice(0, 20)}-soapbox.zcmb"`,
		'content-type': 'application/vnd.zeepcentraal.mesh-bundle',
		'x-content-type-options': 'nosniff',
	})) {
		event.res.headers.set(name, value)
	}
	return bundle
})
