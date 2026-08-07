import { Zc_RecordLevelGeometryDocument } from '@zeepkist/graphql/generated'
import { parseLevelGeometryBlocks } from '../../../app/utils/ghostLevelGeometry'
import { fetchGraphql } from '../../utils/graphql'
import { requireProtectedMeshAccess } from '../../utils/protectedMeshAccess'
import {
	buildProtectedLevelMeshBundle,
	protectedMeshBundleCacheKey,
	protectedMeshCorpusDigest,
} from '../../utils/protectedMeshCorpus'
import { assertSameOrigin } from '../../utils/request'

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
	const bundle = await buildProtectedLevelMeshBundle(
		config.blockMeshCorpusPath,
		blocks,
		config.blockMeshCorpusToken,
	)
	setResponseHeaders(event, {
		'cache-control': 'private, no-store',
		'content-disposition': `inline; filename="${key.slice(0, 20)}.zcmb"`,
		'content-type': 'application/vnd.zeepcentraal.mesh-bundle',
		'x-content-type-options': 'nosniff',
	})
	return bundle
})
