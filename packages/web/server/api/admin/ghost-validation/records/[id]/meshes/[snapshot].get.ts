import { parseLevelGeometryBlocks } from '../../../../../../../app/utils/ghostLevelGeometry'
import type { ValidationReview } from '../../../../../../../shared/ghostValidation'
import { fetchAuthenticatedBackend } from '../../../../../../utils/backend'
import { requireProtectedMeshAccess } from '../../../../../../utils/protectedMeshAccess'
import { buildProtectedLevelMeshBundle } from '../../../../../../utils/protectedMeshCorpus'
import { assertSameOrigin } from '../../../../../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	await requireProtectedMeshAccess(event)
	const id = Number(getRouterParam(event, 'id'))
	const snapshotId = getRouterParam(event, 'snapshot')
	if (!Number.isSafeInteger(id) || id < 1 || !snapshotId || !/^\d+$/.test(snapshotId))
		throw createError({ statusCode: 404, statusMessage: 'Snapshot not found' })
	// Backend checks verified Steam session and DB administrator role before disclosing blocks.
	const review = await fetchAuthenticatedBackend<ValidationReview>(
		event,
		`/admin/ghost-validation/records/${id}`,
		{ method: 'GET' },
	)
	const snapshot = review.snapshots.find(
		(candidate) => String(candidate.snapshot.id) === snapshotId,
	)?.snapshot
	if (!snapshot) throw createError({ statusCode: 404, statusMessage: 'Snapshot not found' })
	const config = useRuntimeConfig()
	const bundle = await buildProtectedLevelMeshBundle(
		config.blockMeshCorpusPath,
		parseLevelGeometryBlocks(snapshot.blocks),
		config.blockMeshCorpusToken,
		snapshot.environment,
		snapshot.typeSkybox,
	)
	setResponseHeaders(event, {
		'cache-control': 'private, no-store',
		'content-type': 'application/vnd.zeepcentraal.mesh-bundle',
		'x-content-type-options': 'nosniff',
	})
	return bundle
})
