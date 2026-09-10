import { z } from 'zod'

const id = z.string().regex(/^[1-9]\d{0,19}$/)
const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
export const rulesSchema = z
	.strictObject({
		minBlocks: z.number().int().nonnegative(),
		maxBlocks: z.number().int().positive().max(100_000),
		minTime: z.number().nonnegative().finite(),
		maxTime: z.number().positive().finite(),
		minCheckpoints: z.number().int().nonnegative(),
		requiredModes: z
			.array(
				z.enum([
					'Invert Steering',
					'Invert Arms Up Braking',
					'Offroad Wheels',
					'Paraglider',
					'Soap Wheels',
					'First Person',
					'Third Person',
					'Logic',
					'Music',
					'Reset',
				]),
			)
			.max(10)
			.default([]),
		// Geometry limits refer explicitly to block-center span, not mesh bounds.
		maxCenterSpan: z.number().positive().finite().optional(),
		fixedCheckpoints: z
			.array(
				z.strictObject({
					id: z.number().int().nonnegative(),
					position: vector,
					tolerance: z.number().nonnegative().max(1).default(0.01),
				}),
			)
			.max(1000)
			.default([]),
	})
	.refine(
		(r) => r.minBlocks <= r.maxBlocks && r.minTime <= r.maxTime,
		'Rule minimum exceeds maximum',
	)
export type Rules = z.infer<typeof rulesSchema>
export const configSchema = z
	.strictObject({
		version: z.literal(1),
		forums: z
			.array(z.strictObject({ guildId: id, forumId: id }))
			.min(1)
			.max(32),
		seasons: z.record(z.string().regex(/^[1-9]\d*$/), z.number().int().positive()),
		activeShowcaseThreadId: id.optional(),
		contests: z
			.array(
				z.strictObject({
					threadId: id,
					rules: rulesSchema,
					roundId: z.number().int().positive().optional(),
					closed: z.boolean().default(false),
					reopen: z.boolean().default(false),
				}),
			)
			.min(1)
			.max(128),
		runTimeoutMs: z
			.number()
			.int()
			.min(60_000)
			.max(29 * 60_000)
			.default(25 * 60_000),
	})
	.superRefine((value, context) => {
		if (new Set(value.contests.map((c) => c.threadId)).size !== value.contests.length)
			context.addIssue({ code: 'custom', message: 'Duplicate contest thread' })
		if (
			value.activeShowcaseThreadId &&
			!value.contests.some((c) => c.threadId === value.activeShowcaseThreadId)
		)
			context.addIssue({
				code: 'custom',
				message: 'Showcase thread must have explicit rules',
			})
	})
export type InspectorConfig = z.infer<typeof configSchema>
export function parseOptions(args: string[]) {
	if (args.some((a) => !['--dry-run', '--force'].includes(a)))
		throw new Error('Unknown inspector option')
	return { dryRun: args.includes('--dry-run'), force: args.includes('--force') }
}
