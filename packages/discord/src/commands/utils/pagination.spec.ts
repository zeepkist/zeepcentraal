import { expect, mock, test } from 'bun:test'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { allComponents, displayText, expectComponentsV2 } from '../../../test/components'
import { createButtonInteraction, createMockContext } from '../../../test/mocks'
import { createCursorPages, createPages, type PageResult, paginationHandler } from './pagination'

function result(
	rows: string[],
	options: Partial<PageResult> & { next?: boolean; previous?: boolean; totalCount?: number } = {},
): PageResult {
	return {
		pageInfo: {
			endCursor: 'end',
			hasNextPage: options.next ?? false,
			hasPreviousPage: options.previous ?? false,
			startCursor: 'start',
		},
		rows,
		sections: options.sections,
		totalCount: options.totalCount ?? rows.length,
	}
}

function buttonDisabled(value: unknown, label: string) {
	return allComponents(value).find(
		(component) => component.type === 2 && component.label === label,
	)?.disabled
}

test('local pagination renders branded empty and four-button pages', () => {
	const { context } = createMockContext()
	const empty = createPages(context, 'owner', 'Empty', [])
	expectComponentsV2(empty)
	expect(displayText(empty)).toContain('No results.')

	const full = createPages(
		context,
		'owner',
		'Full',
		Array.from({ length: 11 }, (_, index) => `Row ${index}`),
		10,
	)
	const buttons = allComponents(full).filter((component) => component.type === 2)
	expect(buttons).toHaveLength(4)
	expect(JSON.stringify(buttons)).toContain('First')
	expect(JSON.stringify(buttons)).toContain('Previous')
	expect(JSON.stringify(buttons)).toContain('Next')
	expect(JSON.stringify(buttons)).toContain('Last')
	expect(displayText(full)).toContain('Page 1/2')
})

test('pagination preserves full presentation and custom empty context', async () => {
	const { context } = createMockContext()
	const response = createPages(context, 'discord-1', 'Leaderboard', ['First', 'Second'], 1, {
		actions: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel('Open')
					.setStyle(ButtonStyle.Link)
					.setURL('https://frontend.example.test/leaderboard'),
			),
		],
		description: 'By Author',
		descriptionPrefix: 'Qualified players',
		footer: 'Custom footer',
		sections: [{ content: '**Entries**  2', heading: 'Details' }],
		thumbnail: {
			description: 'Level thumbnail',
			url: 'https://images.example.test/level.png',
		},
	})
	expectComponentsV2(response)
	expect(displayText(response)).toContain('By Author')
	expect(displayText(response)).toContain('Qualified players\n\nFirst')
	expect(displayText(response)).toContain('Custom footer • Page 1/2')
	expect(JSON.stringify(response)).toContain('Level thumbnail')
	expect(JSON.stringify(response)).toContain('https://frontend.example.test/leaderboard')

	const next = createButtonInteraction('page:session-1:next')
	await paginationHandler(next.interaction, context, 'session-1', 'next')
	expect(next.state.deferUpdate).toBeTrue()
	expectComponentsV2(next.state.edit)
	expect(displayText(next.state.edit)).toContain('Qualified players\n\nSecond')
	expect(JSON.stringify(next.state.edit)).toContain('Level thumbnail')

	const custom = createPages(context, 'owner', 'Empty', [], 10, {
		descriptionPrefix: 'Leaderboard',
		emptyDescription: 'No personal bests yet.',
	})
	expect(displayText(custom)).toContain('Leaderboard\n\nNo personal bests yet.')
})

test('cursor pagination sends exact forward and reverse GraphQL windows', async () => {
	const { context } = createMockContext()
	const loader = mock(async (window: Record<string, unknown>, page: number) => {
		if ('last' in window && !('before' in window)) return result(['Last'], { totalCount: 31 })
		if ('before' in window) return result(['Previous'], { next: true, totalCount: 31 })
		if ('after' in window) return result(['Next'], { next: true, totalCount: 31 })
		return result([`First ${page}`], { next: true, totalCount: 31 })
	})
	const initial = await createCursorPages(
		context,
		'discord-1',
		{ title: 'Cursor leaderboard' },
		loader,
	)
	expectComponentsV2(initial)
	expect(loader.mock.calls[0]?.[0]).toEqual({ first: 10 })

	const next = createButtonInteraction('page:session-1:next')
	await paginationHandler(next.interaction, context, 'session-1', 'next')
	expect(loader.mock.calls[1]?.[0]).toEqual({ after: 'end', first: 10 })
	expect(displayText(next.state.edit)).toContain('Page 2/4')
	expect(buttonDisabled(next.state.edit, 'First')).toBeFalse()
	expect(buttonDisabled(next.state.edit, 'Previous')).toBeFalse()

	const previous = createButtonInteraction('page:session-1:previous')
	await paginationHandler(previous.interaction, context, 'session-1', 'previous')
	expect(loader.mock.calls[2]?.[0]).toEqual({ before: 'start', last: 10 })

	const last = createButtonInteraction('page:session-1:last')
	await paginationHandler(last.interaction, context, 'session-1', 'last')
	expect(loader.mock.calls[3]?.[0]).toEqual({ last: 10 })
	expect(displayText(last.state.edit)).toContain('Page 4/4')
	expect(buttonDisabled(last.state.edit, 'First')).toBeFalse()
	expect(buttonDisabled(last.state.edit, 'Previous')).toBeFalse()
	expect(buttonDisabled(last.state.edit, 'Next')).toBeTrue()
	expect(buttonDisabled(last.state.edit, 'Last')).toBeTrue()

	const first = createButtonInteraction('page:session-1:first')
	await paginationHandler(first.interaction, context, 'session-1', 'first')
	expect(loader.mock.calls[4]?.[0]).toEqual({ first: 10 })
	expect(displayText(first.state.edit)).toContain('Page 1/4')
	expect(buttonDisabled(first.state.edit, 'First')).toBeTrue()
	expect(buttonDisabled(first.state.edit, 'Previous')).toBeTrue()
	expect(buttonDisabled(first.state.edit, 'Next')).toBeFalse()
	expect(buttonDisabled(first.state.edit, 'Last')).toBeFalse()
})

test('cursor pagination recovers to first page after results mutate empty', async () => {
	const { context } = createMockContext()
	const loader = mock(async (window: Record<string, unknown>) => {
		if ('after' in window) return result([], { previous: true, totalCount: 21 })
		return result(['Recovered'], { next: true, totalCount: 21 })
	})
	await createCursorPages(context, 'discord-1', { title: 'Mutable' }, loader)
	const next = createButtonInteraction('page:session-1:next')
	await paginationHandler(next.interaction, context, 'session-1', 'next')
	expect(loader).toHaveBeenCalledTimes(3)
	expect(loader.mock.calls[2]?.[0]).toEqual({ first: 10 })
	expect(displayText(next.state.edit)).toContain('Recovered')
	expect(displayText(next.state.edit)).toContain('Page 1/3')
})

test('pagination serializes concurrent button loads', async () => {
	const { context } = createMockContext()
	let active = 0
	let maximumActive = 0
	const loader = mock(async (_window: Record<string, unknown>, page: number) => {
		active++
		maximumActive = Math.max(maximumActive, active)
		await new Promise((resolve) => setTimeout(resolve, 1))
		active--
		return result([`Page ${page}`], {
			next: page < 2,
			previous: page > 0,
			totalCount: 30,
		})
	})
	await createCursorPages(context, 'discord-1', { title: 'Concurrent' }, loader)
	maximumActive = 0
	const first = createButtonInteraction('page:session-1:next')
	const second = createButtonInteraction('page:session-1:next')
	await Promise.all([
		paginationHandler(first.interaction, context, 'session-1', 'next'),
		paginationHandler(second.interaction, context, 'session-1', 'next'),
	])
	expect(maximumActive).toBe(1)
	expect(displayText(second.state.edit)).toContain('Page 2')
	expect(context.runtime.sessions.page('session-1')?.pending).toBeUndefined()
})

test('pagination continues queued work after an earlier load fails', async () => {
	const { context } = createMockContext()
	let call = 0
	const loader = mock(async (_window: Record<string, unknown>, page: number) => {
		call++
		if (call === 2) {
			await new Promise((resolve) => setTimeout(resolve, 1))
			throw new Error('GraphQL unavailable')
		}
		return result([`Page ${page}`], {
			next: page < 1,
			previous: page > 0,
			totalCount: 20,
		})
	})
	await createCursorPages(context, 'discord-1', { title: 'Recoverable' }, loader)
	const failed = createButtonInteraction('page:session-1:next')
	const recovered = createButtonInteraction('page:session-1:next')
	const outcomes = await Promise.allSettled([
		paginationHandler(failed.interaction, context, 'session-1', 'next'),
		paginationHandler(recovered.interaction, context, 'session-1', 'next'),
	])
	expect(outcomes[0]?.status).toBe('rejected')
	expect(outcomes[1]?.status).toBe('fulfilled')
	expect(displayText(recovered.state.edit)).toContain('Page 1')
	expect(context.runtime.sessions.page('session-1')?.pending).toBeUndefined()
})

test('pagination reports expired, wrong-owner, and invalid controls', async () => {
	const { context } = createMockContext()
	const expired = createButtonInteraction('page:missing:next')
	await paginationHandler(expired.interaction, context, 'missing', 'next')
	expectComponentsV2(expired.state.reply, true)
	expect(displayText(expired.state.reply)).toContain('Pagination expired')

	createPages(context, 'owner', 'Title', ['row'])
	const wrong = createButtonInteraction('page:session-1:next', 'other')
	await paginationHandler(wrong.interaction, context, 'session-1', 'next')
	expectComponentsV2(wrong.state.reply, true)
	expect(displayText(wrong.state.reply)).toContain('Only command owner')

	const invalid = createButtonInteraction('page:session-1:sideways', 'owner')
	expect(
		await paginationHandler(invalid.interaction, context, 'session-1', 'sideways'),
	).toBeFalse()
	expect(invalid.state.deferUpdate).toBeUndefined()
})
