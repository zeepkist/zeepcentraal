import { createHash } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import { client, db } from '../../client'
import { downloadFile, uploadFile } from '../../s3'
import {
	levelSubmissionContest as contests,
	levelSubmissionPlaylistEntry as entries,
	levelSubmissionPlaylist as playlists,
	levelSubmissions as submissions,
	levelSubmissionValidation as validations,
	zslRound,
} from '../../schema'

export type SubmissionRow = typeof submissions.$inferSelect
export type ContestRow = typeof contests.$inferSelect
export type ValidationRow = typeof validations.$inferSelect
export type ValidationInput = Omit<typeof validations.$inferInsert, 'id' | 'dateCreated'>
export type SubmissionInput = Omit<
	typeof submissions.$inferInsert,
	'id' | 'dateCreated' | 'dateUpdated' | 'latestValidationId' | 'retryCategory'
>
export function submissionDigest(value: unknown) {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
export async function withInspectorLock<T>(run: () => Promise<T>) {
	const connection = await client.reserve()
	try {
		const [result] = await connection`select pg_try_advisory_lock(1953721968, 1) as locked`
		if (!result?.locked) return undefined
		try {
			return await run()
		} finally {
			await connection`select pg_advisory_unlock(1953721968, 1)`
		}
	} finally {
		connection.release()
	}
}
export async function findSubmissionRound(
	seasonId: number | undefined,
	round: number,
	override?: number,
) {
	if (!override && !seasonId) return undefined
	const rows = await db
		.select({ id: zslRound.id })
		.from(zslRound)
		.where(
			override
				? eq(zslRound.id, override)
				: and(eq(zslRound.idSeason, seasonId!), eq(zslRound.round, round)),
		)
		.limit(2)
	return rows.length === 1 ? rows[0]!.id : undefined
}
export async function getSubmissionContest(threadId: string) {
	return (await db.select().from(contests).where(eq(contests.threadId, threadId)))[0]
}
/** Mapping may become available after a contest's immutable playlist is frozen. */
export async function linkSubmissionRound(id: bigint, idZslRound: number, explicit: boolean) {
	await db
		.update(contests)
		.set({
			idZslRound,
			mappingSource: explicit ? 'explicit' : 'title',
			dateUpdated: new Date().toISOString(),
		})
		.where(eq(contests.id, id))
}
export async function saveSubmissionContest(input: typeof contests.$inferInsert) {
	const [row] = await db
		.insert(contests)
		.values(input)
		.onConflictDoUpdate({
			target: contests.threadId,
			set: { ...input, dateUpdated: new Date().toISOString() },
		})
		.returning()
	return row!
}
export async function freezeSubmissionContest(id: bigint, frozen: boolean) {
	await db
		.update(contests)
		.set({
			state: frozen ? 'frozen' : 'open',
			frozenAt: frozen ? new Date().toISOString() : null,
			dateUpdated: new Date().toISOString(),
		})
		.where(frozen ? and(eq(contests.id, id), eq(contests.state, 'open')) : eq(contests.id, id))
}
export async function getContestSubmissions(idContest: bigint) {
	return db
		.select()
		.from(submissions)
		.where(eq(submissions.idContest, idContest))
		.orderBy(asc(submissions.id))
}
/** Called only after all source pages completed successfully. */
export async function reconcileContestSubmissions(idContest: bigint, rows: SubmissionInput[]) {
	return db.transaction(async (tx) => {
		await tx
			.update(submissions)
			.set({ state: 'withdrawn', dateUpdated: new Date().toISOString() })
			.where(eq(submissions.idContest, idContest))
		for (const row of rows)
			await tx
				.insert(submissions)
				.values(row)
				.onConflictDoUpdate({
					target: [submissions.idContest, submissions.messageId, submissions.workshopId],
					set: { ...row, dateUpdated: new Date().toISOString() },
				})
		await tx
			.update(contests)
			.set({ lastCompleteScan: new Date().toISOString() })
			.where(eq(contests.id, idContest))
		return tx
			.select()
			.from(submissions)
			.where(and(eq(submissions.idContest, idContest), eq(submissions.state, 'selected')))
	})
}
export async function getSubmissionValidation(id: bigint | null) {
	return id === null
		? undefined
		: (await db.select().from(validations).where(eq(validations.id, id)))[0]
}
export async function saveSubmissionValidation(input: ValidationInput) {
	return db.transaction(async (tx) => {
		const [row] = await tx.insert(validations).values(input).returning()
		await tx
			.update(submissions)
			.set({
				latestValidationId: row!.id,
				retryCategory: null,
				dateUpdated: new Date().toISOString(),
			})
			.where(eq(submissions.id, input.idSubmission))
		return row!
	})
}
export async function setSubmissionRetry(id: bigint, category: string) {
	await db.update(submissions).set({ retryCategory: category }).where(eq(submissions.id, id))
}
export async function uploadSubmissionObject(key: string, data: Uint8Array, type: string) {
	if (!key.startsWith('inspector/')) throw new Error('Invalid inspector object key')
	await uploadFile(key, data, type)
}
export async function downloadSubmissionPayload(metadata: {
	objectKey: string
	sha256: string
	byteSize: number
}) {
	if (
		!metadata.objectKey.startsWith('inspector/') ||
		metadata.byteSize < 1 ||
		metadata.byteSize > 64 * 1024 * 1024
	)
		throw new Error('Invalid inspector payload metadata')
	return downloadFile(metadata.objectKey, {
		maxBytes: 64 * 1024 * 1024,
		expectedBytes: metadata.byteSize,
		expectedSha256: metadata.sha256,
	})
}
export async function publishSubmissionPlaylist(
	idContest: bigint,
	digest: string,
	objectKey: string,
	members: { idValidation: bigint; workshopId: bigint }[],
) {
	return db.transaction(async (tx) => {
		const [contest] = await tx
			.select()
			.from(contests)
			.where(eq(contests.id, idContest))
			.for('update')
		if (!contest || contest.state === 'frozen') throw new Error('Contest is frozen or missing')
		const [inserted] = await tx
			.insert(playlists)
			.values({ idContest, digest, objectKey, validCount: members.length })
			.onConflictDoNothing()
			.returning()
		const playlist =
			inserted ??
			(
				await tx
					.select()
					.from(playlists)
					.where(and(eq(playlists.idContest, idContest), eq(playlists.digest, digest)))
			)[0]!
		if (inserted && members.length)
			await tx
				.insert(entries)
				.values(members.map((m, position) => ({ ...m, position, idPlaylist: playlist.id })))
		await tx
			.update(contests)
			.set({ currentPlaylistId: playlist.id, dateUpdated: new Date().toISOString() })
			.where(eq(contests.id, idContest))
		return playlist
	})
}
export async function getSubmissionPlaylist(threadId: string) {
	const contest = await getSubmissionContest(threadId)
	if (!contest?.currentPlaylistId) return undefined
	const [playlist] = await db
		.select()
		.from(playlists)
		.where(eq(playlists.id, contest.currentPlaylistId))
	if (!playlist) return undefined
	const members = await db
		.select({
			validation: validations,
			workshopId: entries.workshopId,
			position: entries.position,
		})
		.from(entries)
		.innerJoin(validations, eq(entries.idValidation, validations.id))
		.where(eq(entries.idPlaylist, playlist.id))
		.orderBy(asc(entries.position))
	return { contest, playlist, members }
}
export async function saveSubmissionPublication(
	id: bigint,
	publication: ContestRow['publication'],
) {
	await db.update(contests).set({ publication }).where(eq(contests.id, id))
}
