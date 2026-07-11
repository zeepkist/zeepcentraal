import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
	schema: '../graphql/schema.graphql',
	documents: ['app/graphql/**/*.graphql'],
	generates: {
		'app/graphql/generated/': {
			preset: 'client',
			presetConfig: { fragmentMasking: false },
			config: {
				useTypeImports: true,
			},
		},
	},
	ignoreNoDocuments: true,
}

export default config
