import type { ModTagOptionsResponse } from '../../../app/types/mod'
import { getModioTagOptions } from '../../utils/modio'
import { assertSameOrigin } from '../../utils/request'

export default defineEventHandler(async (event): Promise<ModTagOptionsResponse> => {
	assertSameOrigin(event)
	return { tags: await getModioTagOptions() }
})
