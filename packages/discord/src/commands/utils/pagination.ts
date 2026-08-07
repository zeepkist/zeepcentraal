import {
	ActionRowBuilder,
	type APIActionRowComponent,
	type APIButtonComponent,
	type APIEmbed,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	MessageFlags,
} from 'discord.js'
import { baseEmbed, safeMentions } from '../../format'
import type { CommandContext } from '../context'
import type { Page, PageSession } from './session-store'

export type PagePresentation = {
	components?: APIActionRowComponent<APIButtonComponent>[]
	descriptionPrefix?: string
	embed?: APIEmbed
	emptyDescription?: string
}

function pageRow(id: string, session: PageSession) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`page:${id}:previous`)
			.setLabel('Previous')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(session.page === 0),
		new ButtonBuilder()
			.setCustomId(`page:${id}:next`)
			.setLabel('Next')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(session.page >= session.pages.length - 1),
	)
}

function currentPage(id: string, session: PageSession) {
	const page = session.pages[session.page]
	if (!page) throw new Error('Page no longer exists')
	const footer = page.embed?.footer?.text ?? 'ZeepCentraal'
	return {
		embeds: [
			{
				...baseEmbed(page.title, page.description),
				...page.embed,
				title: page.title,
				description: page.description,
				footer: { text: `${footer} • Page ${session.page + 1}/${session.pages.length}` },
			},
		],
		components: [...(page.components ?? []), pageRow(id, session)],
		allowedMentions: safeMentions,
	}
}

export function createPagination(context: CommandContext, ownerId: string, pages: Page[]) {
	const { id, session } = context.runtime.sessions.createPages(ownerId, pages)
	return currentPage(id, session)
}

export function createPages(
	context: CommandContext,
	ownerId: string,
	title: string,
	rows: string[],
	perPage = 10,
	presentation: PagePresentation = {},
) {
	const {
		descriptionPrefix,
		emptyDescription = 'No results.',
		...pagePresentation
	} = presentation
	const pages = Array.from(
		{ length: Math.max(1, Math.ceil(rows.length / perPage)) },
		(_, index) => {
			const pageRows = rows.slice(index * perPage, (index + 1) * perPage).join('\n')
			return {
				...pagePresentation,
				title,
				description: [descriptionPrefix, pageRows || emptyDescription]
					.filter(Boolean)
					.join('\n\n'),
			}
		},
	)
	return createPagination(context, ownerId, pages)
}

export async function paginationHandler(
	interaction: ButtonInteraction,
	context: CommandContext,
	id: string,
	direction: string | undefined,
) {
	const session = context.runtime.sessions.page(id)
	if (!session) {
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: 'Pagination expired. Run command again.',
		})
		return true
	}
	if (session.ownerId !== interaction.user.id) {
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			content: 'Only command owner can change pages.',
		})
		return true
	}
	session.page = Math.max(
		0,
		Math.min(session.pages.length - 1, session.page + (direction === 'next' ? 1 : -1)),
	)
	await interaction.update(currentPage(id, session))
	return true
}
