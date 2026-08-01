import {
	buildProtectedGhostModelBundle,
	protectedMeshCorpusDigest,
} from '../utils/protectedMeshCorpus'
import { assertSameOrigin } from '../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	const config = useRuntimeConfig()
	const [bundle, digest] = await Promise.all([
		buildProtectedGhostModelBundle(config.blockMeshCorpusPath),
		protectedMeshCorpusDigest(config.blockMeshCorpusPath),
	])
	setResponseHeaders(event, {
		'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
		'content-disposition': `inline; filename="${digest.slice(0, 20)}-soapbox.zcmb"`,
		'content-type': 'application/vnd.zeepcentraal.mesh-bundle',
		'x-content-type-options': 'nosniff',
	})
	return bundle
})
