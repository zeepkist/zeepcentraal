import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
	collections: {
		developer: defineCollection({
			type: 'page',
			source: 'developer/**/*.md',
			schema: z.object({
				description: z.string(),
				title: z.string(),
			}),
		}),
		guides: defineCollection({
			type: 'page',
			source: 'guides/**/*.md',
			schema: z.object({
				description: z.string(),
				title: z.string(),
			}),
		}),
		legal: defineCollection({
			type: 'page',
			source: 'legal/**/*.md',
			schema: z.object({
				description: z.string(),
				title: z.string(),
			}),
		}),
		news: defineCollection({
			type: 'page',
			source: 'news/**/*.md',
			schema: z.object({
				description: z.string(),
				title: z.string(),
			}),
		}),
		wiki: defineCollection({
			type: 'page',
			source: 'wiki/**/*.md',
			schema: z.object({
				description: z.string(),
				title: z.string(),
			}),
		}),
	},
})
