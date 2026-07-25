<template>
	<section>
		<SectionHeader :title="title" />
		<div
			v-if="descriptionHtml"
			class="mod-description rounded-xl border border-border bg-card/60 p-5 text-foreground sm:p-7"
			v-html="descriptionHtml"
		/>
		<div v-else class="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
			{{ emptyLabel }}
		</div>
	</section>
</template>

<script setup vapor lang="ts">
defineProps<{ title: string; emptyLabel: string; descriptionHtml: string }>()
</script>

<style>
.mod-description h2,
.mod-description h3,
.mod-description h4 {
	margin-block: 1.5rem 0.65rem;
	font-weight: 700;
	color: var(--ui-text-highlighted);
}

.mod-description h2 { font-size: 1.5rem; }
.mod-description h3 { font-size: 1.25rem; }
.mod-description p,
.mod-description ul,
.mod-description ol,
.mod-description blockquote,
.mod-description pre { margin-block: 0.85rem; }
.mod-description ul { list-style: disc; padding-left: 1.5rem; }
.mod-description ol { list-style: decimal; padding-left: 1.5rem; }
.mod-description a { color: var(--ui-primary); text-decoration: underline; }
.mod-description blockquote { border-left: 3px solid var(--ui-primary); padding-left: 1rem; color: var(--ui-text-muted); }
.mod-description code,
.mod-description pre { border-radius: 0.5rem; background: var(--ui-bg-muted); }
.mod-description code { padding: 0.1rem 0.3rem; }
.mod-description pre { overflow-x: auto; padding: 1rem; }
</style>
