import {
	type ActionRowBuilder,
	type APIActionRowComponent,
	type APIButtonComponent,
	type ButtonBuilder,
	ContainerBuilder,
	FileBuilder,
	type InteractionEditReplyOptions,
	type InteractionReplyOptions,
	type InteractionUpdateOptions,
	type MessageCreateOptions,
	type MessageEditOptions,
	MessageFlags,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder,
	ThumbnailBuilder,
} from 'discord.js'
import { safeMentions } from './format'

export const BRAND_COLOR = 0xfacc15
export const SUCCESS_COLOR = 0x57f287
export const ERROR_COLOR = 0xed4245
export const INFO_COLOR = 0x5865f2

export type DisplayActionRow =
	| ActionRowBuilder<ButtonBuilder>
	| APIActionRowComponent<APIButtonComponent>

export type DisplaySection = {
	content: string
	heading?: string
	separator?: boolean
}

export type DisplayFile = {
	name: string
	spoiler?: boolean
}

export type DisplayOptions = {
	actions?: DisplayActionRow[]
	accentColor?: number
	description?: string
	files?: DisplayFile[]
	footer?: string
	sections?: DisplaySection[]
	thumbnail?: { description: string; url: string }
	title: string
}

type PayloadOptions = {
	allowedMentions?: InteractionReplyOptions['allowedMentions']
	files?: InteractionReplyOptions['files']
	suppressNotifications?: boolean
}

function headerContent(title: string, description?: string) {
	return [`## ${title}`, description].filter(Boolean).join('\n')
}

export function displayContainer(options: DisplayOptions) {
	const container = new ContainerBuilder().setAccentColor(options.accentColor ?? BRAND_COLOR)
	const header = headerContent(options.title, options.description)

	if (options.thumbnail) {
		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
				.setThumbnailAccessory(
					new ThumbnailBuilder()
						.setURL(options.thumbnail.url)
						.setDescription(options.thumbnail.description),
				),
		)
	} else {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
	}

	for (const section of options.sections ?? []) {
		if (section.separator !== false) {
			container.addSeparatorComponents(
				new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
			)
		}
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				[section.heading ? `### ${section.heading}` : undefined, section.content]
					.filter(Boolean)
					.join('\n'),
			),
		)
	}

	for (const action of options.actions ?? []) container.addActionRowComponents(action)
	for (const file of options.files ?? []) {
		container.addFileComponents(
			new FileBuilder().setURL(`attachment://${file.name}`).setSpoiler(file.spoiler),
		)
	}

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`-# ${options.footer ?? 'ZeepCentraal'}`),
	)
	return container
}

export function replyPayload(
	container: ContainerBuilder,
	options: PayloadOptions & { ephemeral?: boolean } = {},
): InteractionReplyOptions {
	return {
		allowedMentions: options.allowedMentions ?? safeMentions,
		components: [container],
		files: options.files,
		flags:
			MessageFlags.IsComponentsV2 |
			(options.ephemeral ? MessageFlags.Ephemeral : 0) |
			(options.suppressNotifications ? MessageFlags.SuppressNotifications : 0),
	}
}

export function messagePayload(
	container: ContainerBuilder,
	options: PayloadOptions = {},
): MessageCreateOptions {
	return {
		allowedMentions: options.allowedMentions ?? safeMentions,
		components: [container],
		files: options.files,
		flags:
			MessageFlags.IsComponentsV2 |
			(options.suppressNotifications ? MessageFlags.SuppressNotifications : 0),
	}
}

export function editPayload(
	container: ContainerBuilder,
	options: PayloadOptions & { clearLegacy?: boolean } = {},
): InteractionEditReplyOptions {
	return {
		allowedMentions: options.allowedMentions ?? safeMentions,
		components: [container],
		content: options.clearLegacy ? null : undefined,
		embeds: options.clearLegacy ? [] : undefined,
		files: options.files,
		flags: MessageFlags.IsComponentsV2,
	}
}

export function updatePayload(
	container: ContainerBuilder,
	options: PayloadOptions & { clearLegacy?: boolean } = {},
): InteractionUpdateOptions {
	return editPayload(container, options)
}

export function messageEditPayload(
	container: ContainerBuilder,
	options: PayloadOptions & { clearLegacy?: boolean } = {},
): MessageEditOptions {
	return editPayload(container, options)
}

export function errorContainer(message: string) {
	return displayContainer({
		accentColor: ERROR_COLOR,
		description: message,
		title: 'Request failed',
	})
}
