import { lt } from 'semver';
import { db, schema } from '../index';

export async function isModOutdated(modVersion: string): Promise<boolean> {
	try {
		const entry = await db.select().from(schema.version).limit(1);
		if (entry.length === 0 || !entry[0]?.minimum) {
			return false;
		}

		return lt(modVersion, entry[0].minimum, {});
	} catch {
		return true;
	}
}
