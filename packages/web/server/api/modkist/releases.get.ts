import type { ModkistReleases } from '../../../app/types/modkist'
import { getModkistReleases } from '../../utils/githubModkist'
import { assertSameOrigin } from '../../utils/request'

export default defineEventHandler(async (event): Promise<ModkistReleases> => {
	assertSameOrigin(event)
	return getModkistReleases()
})
