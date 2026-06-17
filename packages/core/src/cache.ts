import { TTLCache } from '@isaacs/ttlcache';

export const cache = new TTLCache<string, unknown>({
	max: 1_000,
	ttl: 5 * 60 * 1_000,
});
