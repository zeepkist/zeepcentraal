import { Zc_RecordLevelGeometryDocument } from '../../../app/graphql/generated/graphql'
import { parseLevelGeometryBlocks } from '../../../app/utils/ghostLevelGeometry'
import { fetchGraphql } from '../../utils/graphql'
import { requireProtectedMeshAccess } from '../../utils/protectedMeshAccess'
import {
	buildProtectedLevelMeshBundle,
	protectedMeshBundleCacheKey,
	protectedMeshCorpusDigest,
} from '../../utils/protectedMeshCorpus'
import { assertSameOrigin } from '../../utils/request'

const MAXIMUM_CACHE_ENTRIES = 16
const MAXIMUM_CACHE_BYTES = 256 * 1024 * 1024
const bundleCache = new Map<string, Uint8Array>()
let bundleCacheBytes = 0

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	await requireProtectedMeshAccess(event)
	const levelId = Number(getRouterParam(event, 'levelId'))
	if (!Number.isSafeInteger(levelId) || levelId < 1) {
		throw createError({ statusCode: 404, statusMessage: 'Level not found' })
	}
	const config = useRuntimeConfig()
	const data = await fetchGraphql(Zc_RecordLevelGeometryDocument, { levelId })
	const metadata = data.level?.levelMetadata.nodes[0]
	if (!metadata) throw createError({ statusCode: 404, statusMessage: 'Level geometry not found' })
	const blocks = parseLevelGeometryBlocks(metadata.blocks)
	const digest = await protectedMeshCorpusDigest(
		config.blockMeshCorpusPath,
		config.blockMeshCorpusToken,
	)
	const key = protectedMeshBundleCacheKey(digest, blocks)
	let bundle = bundleCache.get(key)
	if (!bundle) {
		bundle = await buildProtectedLevelMeshBundle(
			config.blockMeshCorpusPath,
			blocks,
			config.blockMeshCorpusToken,
		)
		bundleCache.set(key, bundle)
		bundleCacheBytes += bundle.byteLength
		while (bundleCache.size > MAXIMUM_CACHE_ENTRIES || bundleCacheBytes > MAXIMUM_CACHE_BYTES) {
			const oldest = bundleCache.keys().next().value
			if (oldest === undefined) break
			bundleCacheBytes -= bundleCache.get(oldest)?.byteLength ?? 0
			bundleCache.delete(oldest)
		}
	}
	setResponseHeaders(event, {
		'cache-control': 'private, no-store',
		'content-disposition': `inline; filename="${key.slice(0, 20)}.zcmb"`,
		'content-type': 'application/vnd.zeepcentraal.mesh-bundle',
		'x-content-type-options': 'nosniff',
	})
	return bundle
})
