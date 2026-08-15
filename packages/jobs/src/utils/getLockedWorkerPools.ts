import { client } from '@zeepkist/database'
import { WORKER_POOL_MARKER_LOCK_NAMESPACE } from '../workerEvents'
import {
	DEAD_WORKER_POOL_LOCK_AGE_MS,
	LOCKED_WORKER_POOLS_SQL,
	type LockedWorkerPool,
} from './workerPoolRecovery'

export async function getLockedWorkerPools(
	minimumLockAgeMs = DEAD_WORKER_POOL_LOCK_AGE_MS,
): Promise<LockedWorkerPool[]> {
	return client.unsafe(LOCKED_WORKER_POOLS_SQL, [
		WORKER_POOL_MARKER_LOCK_NAMESPACE,
		minimumLockAgeMs,
	])
}
