import type { TaskHandler } from './types'

export const syncPersonalBests: TaskHandler = async (_payload, helpers) => {
	helpers.logger.info('syncPersonalBests executed (stub parity with V1 empty task).')
}
