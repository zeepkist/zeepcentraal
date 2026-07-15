import graphql from '@rollup/plugin-graphql'

const productionGraphqlHttpUrl = 'https://graphql.zeepki.st'
const productionGraphqlWsUrl = 'wss://graphql.zeepki.st'
const productionBackendUrl = 'https://backend.zeepki.st'

export default defineNuxtConfig({
	compatibilityDate: '2026-07-06',
	debug: false,
	devtools: { enabled: process.env.NUXT_ENABLE_DEVTOOLS === 'true' },
	ssr: true,
	srcDir: 'app',
	appConfig: {
		ui: {
			colors: {
				primary: 'yellow',
				secondary: 'secondary',
				success: 'green',
				info: 'teal',
				warning: 'orange',
				error: 'red',
				neutral: 'warm-neutral',
			},
		},
	},
	css: ['~/assets/css/tailwind.css'],
	components: [
		{
			path: '~/components',
			pathPrefix: false,
		},
	],
	modules: [
		'@nuxt/ui',
		'@nuxtjs/i18n',
		'@nuxtjs/seo',
		'@nuxt/content',
		'@nuxt/image',
		'@pinia/nuxt',
		'nuxt-charts',
	],
	content: {
		build: {
			markdown: {
				highlight: {
					theme: {
						default: 'github-dark',
						dark: 'github-dark',
						light: 'github-light',
					},
					langs: ['graphql', 'json', 'python'],
				},
			},
		},
	},
	typescript: {
		strict: true,
		typeCheck: process.env.NUXT_ENABLE_TYPECHECK === 'true',
		tsConfig: {
			compilerOptions: {
				noUncheckedIndexedAccess: true,
			},
		},
	},
	runtimeConfig: {
		githubToken: process.env.NUXT_GITHUB_TOKEN ?? '',
		modioApiKey: process.env.NUXT_MODIO_API_KEY ?? '',
		modioApiEndpoint: process.env.NUXT_MODIO_API_ENDPOINT ?? 'https://api.mod.io/',
		public: {
			graphqlHttpUrl: process.env.NUXT_PUBLIC_GRAPHQL_HTTP_URL ?? productionGraphqlHttpUrl,
			graphqlWsUrl: process.env.NUXT_PUBLIC_GRAPHQL_WS_URL ?? productionGraphqlWsUrl,
			backendUrl: process.env.NUXT_PUBLIC_BACKEND_URL ?? productionBackendUrl,
		},
	},
	image: {
		domains: ['assets.modcdn.io'],
	},
	routeRules: {
		'/auth/callback': { redirect: { to: '/?auth=callback', statusCode: 302 } },
	},
	vite: {
		plugins: [graphql()],
		optimizeDeps: {
			include: [
				'@nuxt/content > slugify',
				'@tabler/icons-vue',
				'@unhead/schema-org/vue',
				'@urql/vue',
				'graphql-ws',
			],
		},
	},
	nitro: {
		preset: 'bun',
		compressPublicAssets: true,
		esbuild: {
			options: {
				target: 'esnext',
			},
		},
	},
	colorMode: {
		preference: 'dark',
		fallback: 'dark',
		classSuffix: '',
		storage: 'cookie',
		storageKey: 'colour_mode',
	},
	fonts: {
		providers: {
			adobe: false,
			bunny: false,
			fontshare: false,
			fontsource: false,
			google: false,
			googleicons: false,
			npm: false,
		},
	},
	i18n: {
		baseUrl: 'https://zeepki.st',
		defaultLocale: 'en',
		strategy: 'no_prefix',
		langDir: '../i18n/locales',
		locales: [
			{
				code: 'en',
				language: 'en-GB',
				name: 'English',
				files: ['en.json'],
				isCatchallLocale: true,
			},
			{
				code: 'de',
				language: 'de-DE',
				name: 'Deutsch',
				files: ['en.json', 'de.json'],
			},
			{ code: 'ja', language: 'ja-JP', name: '日本語', files: ['en.json'] },
			{ code: 'nl', language: 'nl-NL', name: 'Nederlands', files: ['en.json'] },
			{ code: 'no', language: 'no-NO', name: 'Norsk', files: ['en.json'] },
		],
		detectBrowserLanguage: {
			useCookie: true,
			cookieKey: 'i18n_redirected',
			redirectOn: 'root',
			alwaysRedirect: false,
		},
	},
	site: {
		url: 'https://zeepki.st',
		name: 'ZeepCentraal',
	},
	seo: {
		enabled: true,
	},
	schemaOrg: {
		enabled: true,
		identity: {
			type: 'Organization',
			name: 'ZeepCentraal',
			url: 'https://zeepki.st',
		},
	},
	ogImage: {
		enabled: true,
	},
	linkChecker: {
		enabled: false,
	},
	robots: {
		enabled: true,
		disallow: ['/settings'],
	},
	sitemap: {
		defaults: {
			changefreq: 'daily',
			priority: 0.7,
		},
		sitemaps: {
			pages: {
				includeAppSources: true,
				chunks: true,
			},
			users: {
				chunks: true,
				sources: ['/api/__sitemap__/users'],
			},
			levels: {
				chunks: true,
				sources: ['/api/__sitemap__/levels'],
			},
			tournaments: {
				chunks: true,
				sources: ['/api/__sitemap__/tournaments'],
			},
		},
	},
	app: {
		head: {
			title: 'ZeepCentraal',
			htmlAttrs: { lang: 'en' },
			link: [
				//{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
				{ rel: 'icon', type: 'image/png', href: '/favicon-32x32.png' },
				{ rel: 'icon', type: 'image/png', href: '/favicon-16x16.png' },
				{ rel: 'mask-icon', href: '/safari-pinned-tab.svg', color: '#5bbad5' },
				{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
				{ rel: 'manifest', href: '/site.webmanifest' },
				{ rel: 'shortcut icon', href: '/favicon.ico' },
			],
		},
	},
})
