import type { ModDetailResponse } from '../../../../app/types/mod'
import { normalizeModSlug } from '../../../../app/utils/modExplorer'
import {
	findModBySlug,
	MODIO_GAME_ID,
	type ModioListResponse,
	type ModioMod,
	mapModioDetail,
	mapModioMod,
	requestModio,
} from '../../../utils/modio'
import { assertSameOrigin } from '../../../utils/request'

export default defineEventHandler(async (event): Promise<ModDetailResponse> => {
	assertSameOrigin(event)
	const slug = normalizeModSlug(getRouterParam(event, 'slug'))
	if (!slug) throw createError({ statusCode: 404, statusMessage: 'Mod not found' })

	const mod = await findModBySlug(slug)
	if (!mod) throw createError({ statusCode: 404, statusMessage: 'Mod not found' })

	const query = getQuery(event)
	const dependencies =
		query.dependencies === 'true'
			? await requestModio<ModioListResponse<ModioMod>>(
					`v1/games/${MODIO_GAME_ID}/mods/${mod.id}/dependencies`,
					{ recursive: false, _limit: 100 },
				)
			: null

	return {
		mod: mapModioDetail(mod),
		dependencies: (dependencies?.data ?? [])
			.filter((dependency) => dependency.status === 1 && dependency.visible === 1)
			.map(mapModioMod),
	}
})
