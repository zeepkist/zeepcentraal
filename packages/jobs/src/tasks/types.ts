import type { Helpers } from 'graphile-worker'

export type { Helpers as JobHelpers }

// Task handler type compatible with graphile-worker's task list.
// Payload typing is narrowed per-task but the taskList accepts the base signature.
export type TaskHandler<TPayload = unknown> = (payload: TPayload, helpers: Helpers) => Promise<void>
