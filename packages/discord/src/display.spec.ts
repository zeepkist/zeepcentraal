import { expect, test } from 'bun:test'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	MessageFlags,
} from 'discord.js'
import { expectComponentsV2, messageJson } from '../test/components'
import {
	BRAND_COLOR,
	displayContainer,
	editPayload,
	errorContainer,
	messageEditPayload,
	messagePayload,
	replyPayload,
	SUCCESS_COLOR,
	updatePayload,
} from './display'

test('display container applies brand shell, sections, thumbnail, actions, file, and footer', () => {
	const container = displayContainer({
		actions: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel('Open')
					.setStyle(ButtonStyle.Link)
					.setURL('https://zeepki.st'),
			),
		],
		description: 'Description',
		files: [{ name: 'playlist.zeeplist' }],
		footer: 'ZeepCentraal • Today',
		sections: [{ content: 'Details', heading: 'Summary' }],
		thumbnail: { description: 'Level thumbnail', url: 'https://zeepki.st/level.png' },
		title: 'Title',
	})
	const json = container.toJSON()
	expect(json.accent_color).toBe(BRAND_COLOR)
	expect(json.components.map((component) => component.type)).toEqual([
		ComponentType.Section,
		ComponentType.Separator,
		ComponentType.TextDisplay,
		ComponentType.ActionRow,
		ComponentType.File,
		ComponentType.TextDisplay,
	])
	expect(JSON.stringify(json)).toContain('Level thumbnail')
	expect(JSON.stringify(json)).toContain('ZeepCentraal • Today')
})

test('payload helpers enforce Components V2 and safe legacy migration', () => {
	const container = displayContainer({ title: 'Message' })
	expectComponentsV2(messagePayload(container))
	expectComponentsV2(replyPayload(container, { ephemeral: true }), true)
	expectComponentsV2(editPayload(container))
	expectComponentsV2(updatePayload(container))
	const edit = messageJson(messageEditPayload(container, { clearLegacy: true }))
	expect(edit.content).toBeNull()
	expect(edit.embeds).toEqual([])
	expect((edit.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2)
})

test('semantic error and success colors remain consistent', () => {
	expect(errorContainer('Failure').toJSON().accent_color).not.toBe(SUCCESS_COLOR)
	expect(
		displayContainer({ accentColor: SUCCESS_COLOR, title: 'Success' }).toJSON().accent_color,
	).toBe(SUCCESS_COLOR)
})
