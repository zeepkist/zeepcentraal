import { db } from '../client'
import { version } from '../schema'
import { isExactModVersionOutdated } from './versionSemver'

export async function isModOutdated(modVersion: string): Promise<boolean> {
	try {
		const entry = await db.select().from(version).limit(1)
		if (entry.length === 0 || !entry[0]?.minimum) {
			return false
		}

		return isExactModVersionOutdated(modVersion, entry[0].minimum)
	} catch {
		return true
	}
}

export { isExactModVersionOutdated } from './versionSemver'
