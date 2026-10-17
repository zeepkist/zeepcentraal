import { createError, defineEventHandler, getRouterParam, useRuntimeConfig } from 'nuxt/server'
import { parseLevelGeometryBlocks } from '../../../../../../../app/utils/ghostLevelGeometry'
import type { ValidationReview } from '../../../../../../../shared/ghostValidation'
import { fetchAuthenticatedBackend } from '../../../../../../utils/backend'
import { requireProtectedMeshAccess } from '../../../../../../utils/protectedMeshAccess'
import { buildProtectedLevelMeshBundle } from '../../../../../../utils/protectedMeshCorpus'
import { assertSameOrigin } from '../../../../../../utils/request'

export default defineEventHandler(async (event) => {
	assertSameOrigin(event)
	await requireProtectedMeshAccess(event)
	const id = Number(getRouterParam(event, 'id', { decode: true }))
	const snapshotId = getRouterParam(event, 'snapshot', { decode: true })
	if (!Number.isSafeInteger(id) || id < 1 || !snapshotId || !/^\d+$/.test(snapshotId))
		throw createError({ status: 404, statusText: 'Snapshot not found' })
	// Backend checks verified web session and DB administrator role before disclosing blocks.
	const review = await fetchAuthenticatedBackend<ValidationReview>(
		event,
		`/admin/ghost-validation/records/${id}`,
		{ method: 'GET' },
	)
	const snapshot = review.snapshots.find(
		(candidate) => String(candidate.snapshot.id) === snapshotId,
	)?.snapshot
	if (!snapshot) throw createError({ status: 404, statusText: 'Snapshot not found' })
	const config = useRuntimeConfig()
	const bundle = await buildProtectedLevelMeshBundle(
		config.blockMeshCorpusPath,
		parseLevelGeometryBlocks(snapshot.blocks),
		config.blockMeshCorpusToken,
		snapshot.environment,
		snapshot.typeSkybox,
	)
	for (const [name, value] of Object.entries({
		'cache-control': 'private, no-store',
		'content-type': 'application/vnd.zeepcentraal.mesh-bundle',
		'x-content-type-options': 'nosniff',
	})) {
		event.res.headers.set(name, value)
	}
	return bundle
})
