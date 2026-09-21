import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { displayContainer, messagePayload } from '../../../packages/discord/src/display'

const inputs = [
	{
		title: 'Player',
		description: 'Steam ID `76561198000000001`',
		sections: [{ heading: 'Career summary', content: '**Rank** #1' }],
	},
	{
		title: 'Page 2',
		description: 'Levels',
		sections: [],
		button: 'page:2',
		filename: 'playlist.json',
	},
	{
		title: 'New personal best',
		description: 'Fixture level',
		thumbnail: 'https://example.test/image.png',
		sections: [{ heading: 'Personal best', content: '28.375' }],
	},
]
const fixtures = inputs.map((input) => {
	const payload = messagePayload(
		displayContainer({
			...input,
			thumbnail:
				typeof input.thumbnail === 'string'
					? { url: input.thumbnail, description: 'Evaluation thumbnail' }
					: undefined,
			files:
				typeof input.filename === 'string'
					? [{ name: input.filename, spoiler: false }]
					: undefined,
			actions:
				typeof input.button === 'string'
					? [
							new ActionRowBuilder<ButtonBuilder>().addComponents(
								new ButtonBuilder()
									.setCustomId(input.button)
									.setLabel('Next')
									.setDisabled(false)
									.setStyle(ButtonStyle.Primary),
							),
						]
					: undefined,
		}),
		{ allowedMentions: { parse: [], users: [], roles: [], repliedUser: false } },
	)
	return {
		input,
		expected: {
			components: payload.components?.map((c) => ('toJSON' in c ? c.toJSON() : c)),
			flags: Number(payload.flags),
			allowed_mentions: {
				parse: payload.allowedMentions?.parse,
				users: payload.allowedMentions?.users,
				roles: payload.allowedMentions?.roles,
				replied_user: payload.allowedMentions?.repliedUser,
			},
		},
	}
})
const path = new URL('../../../crates/discord-evaluation/fixtures/components.json', import.meta.url)
const expected = JSON.stringify(fixtures, null, 2) + '\n'
if (process.argv.includes('--check')) {
	if ((await Bun.file(path).text()) !== expected)
		throw new Error('Discord golden fixtures changed')
} else await Bun.write(path, expected)
