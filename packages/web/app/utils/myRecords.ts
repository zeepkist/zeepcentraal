export const myRecordViews = ['recent', 'personal-bests', 'world-records'] as const

export type MyRecordView = (typeof myRecordViews)[number]

export function normalizeMyRecordView(value: unknown): MyRecordView {
	return typeof value === 'string' && (myRecordViews as readonly string[]).includes(value)
		? (value as MyRecordView)
		: 'recent'
}
