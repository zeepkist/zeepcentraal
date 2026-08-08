import { ActionRowBuilder, ButtonBuilder, type ButtonInteraction, ButtonStyle } from 'discord.js'
import { displayContainer, editPayload, replyPayload } from '../../display'
import type { CommandContext } from '../context'
import type {
	CursorWindow,
	PageLoader,
	PagePresentation,
	PageResult,
	PageSession,
} from './session-store'

export type { CursorWindow, PageLoader, PagePresentation, PageResult }

const DEFAULT_PAGE_SIZE = 10

type PageDirection = 'first' | 'previous' | 'next' | 'last'

function pageCount(session: PageSession) {
	return Math.max(1, Math.ceil(session.result.totalCount / session.pageSize))
}

function pageRow(id: string, session: PageSession) {
	const pages = pageCount(session)
	const atFirst = session.page === 0 || !session.result.pageInfo.hasPreviousPage
	const atLast = session.page >= pages - 1 || !session.result.pageInfo.hasNextPage
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`page:${id}:first`)
			.setLabel('First')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(atFirst),
		new ButtonBuilder()
			.setCustomId(`page:${id}:previous`)
			.setLabel('Previous')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(atFirst),
		new ButtonBuilder()
			.setCustomId(`page:${id}:next`)
			.setLabel('Next')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(atLast),
		new ButtonBuilder()
			.setCustomId(`page:${id}:last`)
			.setLabel('Last')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(atLast),
	)
}

function currentPage(id: string, session: PageSession) {
	const presentation = session.presentation
	const rows = session.result.rows.join('\n') || presentation.emptyDescription || 'No results.'
	const leaderboard = [presentation.descriptionPrefix, rows].filter(Boolean).join('\n\n')
	const pages = pageCount(session)
	return editPayload(
		displayContainer({
			...presentation,
			actions: [...(presentation.actions ?? []), pageRow(id, session)],
			footer: `${presentation.footer ?? 'ZeepCentraal'} • Page ${session.page + 1}/${pages}`,
			sections: [
				...(presentation.sections ?? []),
				{
					content: leaderboard,
					heading: presentation.sectionHeading ?? 'Leaderboard',
				},
				...(session.result.sections ?? []),
			],
		}),
	)
}

function localResult(rows: string[], pageSize: number, page: number): PageResult {
	const pages = Math.max(1, Math.ceil(rows.length / pageSize))
	const current = Math.max(0, Math.min(pages - 1, page))
	return {
		pageInfo: {
			endCursor: String((current + 1) * pageSize),
			hasNextPage: current < pages - 1,
			hasPreviousPage: current > 0,
			startCursor: String(current * pageSize),
		},
		rows: rows.slice(current * pageSize, (current + 1) * pageSize),
		totalCount: rows.length,
	}
}

export function createPages(
	context: CommandContext,
	ownerId: string,
	title: string,
	rows: string[],
	perPage = DEFAULT_PAGE_SIZE,
	presentation: Omit<PagePresentation, 'title'> = {},
) {
	const loader: PageLoader = async (_window, page) => localResult(rows, perPage, page)
	const { id, session } = context.runtime.sessions.createPages(
		ownerId,
		perPage,
		localResult(rows, perPage, 0),
		{ ...presentation, title },
		loader,
	)
	return currentPage(id, session)
}

export async function createCursorPages(
	context: CommandContext,
	ownerId: string,
	presentation: PagePresentation,
	loader: PageLoader,
	pageSize = DEFAULT_PAGE_SIZE,
) {
	const result = await loader({ first: pageSize }, 0)
	const { id, session } = context.runtime.sessions.createPages(
		ownerId,
		pageSize,
		result,
		presentation,
		loader,
	)
	return currentPage(id, session)
}

function windowFor(direction: PageDirection, session: PageSession): CursorWindow {
	switch (direction) {
		case 'first':
			return { first: session.pageSize }
		case 'previous':
			return { before: session.result.pageInfo.startCursor, last: session.pageSize }
		case 'next':
			return { after: session.result.pageInfo.endCursor, first: session.pageSize }
		case 'last':
			return { last: session.pageSize }
	}
}

function targetPage(direction: PageDirection, session: PageSession) {
	switch (direction) {
		case 'first':
			return 0
		case 'previous':
			return Math.max(0, session.page - 1)
		case 'next':
			return Math.min(pageCount(session) - 1, session.page + 1)
		case 'last':
			return pageCount(session) - 1
	}
}

async function loadDirection(
	interaction: ButtonInteraction,
	id: string,
	direction: PageDirection,
	session: PageSession,
) {
	let page = targetPage(direction, session)
	let result = await session.loader(windowFor(direction, session), page)
	if (result.rows.length === 0 && result.totalCount > 0 && page > 0) {
		page = 0
		result = await session.loader({ first: session.pageSize }, page)
	}
	session.page = Math.min(page, Math.max(0, Math.ceil(result.totalCount / session.pageSize) - 1))
	session.result = result
	await interaction.editReply(currentPage(id, session))
}

function isPageDirection(value: string | undefined): value is PageDirection {
	return value === 'first' || value === 'previous' || value === 'next' || value === 'last'
}

export async function paginationHandler(
	interaction: ButtonInteraction,
	context: CommandContext,
	id: string,
	direction: string | undefined,
) {
	const session = context.runtime.sessions.page(id)
	if (!session) {
		await interaction.reply(
			replyPayload(
				displayContainer({
					description: 'Run command again.',
					title: 'Pagination expired',
				}),
				{ ephemeral: true },
			),
		)
		return true
	}
	if (session.ownerId !== interaction.user.id) {
		await interaction.reply(
			replyPayload(
				displayContainer({
					description: 'Only command owner can change pages.',
					title: 'Private controls',
				}),
				{ ephemeral: true },
			),
		)
		return true
	}
	if (!isPageDirection(direction)) return false

	await interaction.deferUpdate()
	const previous = session.pending?.catch(() => {}) ?? Promise.resolve()
	const pending = previous.then(() => loadDirection(interaction, id, direction, session))
	session.pending = pending
	try {
		await pending
	} finally {
		if (session.pending === pending) session.pending = undefined
	}
	return true
}
