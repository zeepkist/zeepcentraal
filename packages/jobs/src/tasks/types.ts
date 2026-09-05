import type { Helpers } from '../queueTypes'

export type { Helpers as JobHelpers }

// Application-owned task handler.
// Payload typing is narrowed per-task but the taskList accepts the base signature.
export type TaskHandler<TPayload = unknown> = (payload: TPayload, helpers: Helpers) => Promise<void>
