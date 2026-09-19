import { print } from '../../../packages/graphql/node_modules/graphql'
import {
	Zc_DiscordActivityEventsLiveDocument,
	Zc_DiscordLevelSearchDocument,
	Zc_DiscordLevelsDocument,
	Zc_DiscordUserLookupDocument,
} from '../../../packages/graphql/src/generated/graphql'

const docs = {
	profile: print(Zc_DiscordUserLookupDocument),
	autocomplete: print(Zc_DiscordLevelSearchDocument),
	page: print(Zc_DiscordLevelsDocument),
	feed: print(Zc_DiscordActivityEventsLiveDocument),
}
const path = new URL('../../../crates/discord-evaluation/fixtures/documents.json', import.meta.url)
const text = JSON.stringify(docs, null, 2) + '\n'
if (process.argv.includes('--check')) {
	if ((await Bun.file(path).text()) !== text)
		throw new Error('GraphQL evaluation documents drifted')
} else await Bun.write(path, text)
