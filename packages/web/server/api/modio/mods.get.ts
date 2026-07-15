import type { ModListResponse, ModSort, ModSummary } from '../../../app/types/mod'
import {
	GTR_MOD_SLUG,
	getModPageWindow,
	MOD_PAGE_SIZE,
	MODIO_SORTS,
	normalizeEssentialsOnly,
	normalizeModPage,
	normalizeModSearch,
	normalizeModSort,
} from '../../../app/utils/modExplorer'
import {
	findModBySlug,
	MODIO_GAME_ID,
	type ModioListResponse,
	type ModioMod,
	mapModioMod,
	requestModio,
} from '../../utils/modio'
import { assertSameOrigin } from '../../utils/request'

function listParams(
	search: string,
	sort: ModSort,
	limit: number,
	offset: number,
	essentialsOnly: boolean,
	excludedId?: number,
) {
	return {
		status: 1,
		visible: 1,
		tags: essentialsOnly ? 'Plugin,Essentials' : 'Plugin',
		_sort: MODIO_SORTS[sort],
		_limit: limit,
		_offset: offset,
		...(search ? { 'name-lk': search } : {}),
		...(excludedId ? { 'id-not-in': excludedId } : {}),
	}
}

async function getMods(
	search: string,
	sort: ModSort,
	page: number,
	pinnedMod: ModioMod | null,
	essentialsOnly: boolean,
) {
	const window = getModPageWindow(page, pinnedMod !== null)
	return requestModio<ModioListResponse<ModioMod>>(
		`v1/games/${MODIO_GAME_ID}/mods`,
		listParams(search, sort, window.limit, window.offset, essentialsOnly, pinnedMod?.id),
	)
}

export default defineEventHandler(async (event): Promise<ModListResponse> => {
	assertSameOrigin(event)
	const query = getQuery(event)
	const search = normalizeModSearch(query.q)
	const sort = normalizeModSort(query.sort)
	const page = normalizeModPage(query.page)
	const essentialsOnly = normalizeEssentialsOnly(query.essential)
	const shouldPinGtr = search === '' && sort === 'popular' && !essentialsOnly
	const pinnedMod = shouldPinGtr ? await findModBySlug(GTR_MOD_SLUG) : null
	const response = await getMods(search, sort, page, pinnedMod, essentialsOnly)
	const listed = (response.data ?? []).map(mapModioMod)
	const items: ModSummary[] =
		page === 1 && pinnedMod ? [mapModioMod(pinnedMod), ...listed] : listed
	const total = (response.result_total ?? 0) + (pinnedMod ? 1 : 0)

	return {
		items,
		page,
		pageSize: MOD_PAGE_SIZE,
		total,
		totalPages: Math.max(1, Math.ceil(total / MOD_PAGE_SIZE)),
	}
})
