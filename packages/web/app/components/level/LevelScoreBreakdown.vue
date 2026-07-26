<template>
	<section
		ref="reactor"
		class="points-reactor relative isolate overflow-hidden px-3 py-6 sm:px-6 sm:py-8 lg:px-8"
		:class="{ 'is-visible': entered }"
		:aria-label="accessibleSummary"
	>
		<div
			class="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_12%,color-mix(in_oklab,var(--ui-primary)_8%,transparent),transparent_28%),radial-gradient(circle_at_82%_72%,color-mix(in_oklab,var(--ui-primary)_5%,transparent),transparent_32%)]"
		/>
		<div class="reactor-grid pointer-events-none absolute inset-0 -z-10 opacity-35" />

		<p class="sr-only">{{ accessibleSummary }}</p>

		<div class="reactor-map">
			<svg
				class="reactor-connections pointer-events-none absolute inset-0 hidden size-full lg:block"
				viewBox="0 0 1200 430"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<defs>
					<linearGradient id="reactor-line-gradient" x1="0" x2="1">
						<stop offset="0" stop-color="var(--ui-border)" />
						<stop offset="0.45" stop-color="var(--ui-primary)" />
						<stop offset="1" stop-color="var(--ui-primary)" stop-opacity="0.3" />
					</linearGradient>
				</defs>
				<path
					class="reactor-path"
					pathLength="1"
					d="M100 92 C100 196 300 190 300 310"
				/>
				<path class="reactor-path" pathLength="1" d="M300 92 L300 310" />
				<path class="reactor-path" pathLength="1" d="M100 310 H1100" />
			</svg>

			<div class="reactor-gauge-rail">
				<button
					v-for="gauge in gauges"
					:key="gauge.key"
					type="button"
					class="reactor-gauge group"
					:class="[
						`reactor-${gauge.key}`,
						{
							'is-active': activeStage === gauge.key,
							'is-hovered': hoveredStage === gauge.key,
						},
					]"
					:aria-pressed="activeStage === gauge.key"
					:aria-controls="inspectorId"
					:aria-label="stageAriaLabel(gauge)"
					@click="selectStage(gauge.key)"
					@focus="selectStage(gauge.key)"
					@pointerenter="hoveredStage = gauge.key"
					@pointerleave="hoveredStage = null"
				>
					<span class="reactor-gauge-visual">
						<svg viewBox="0 0 120 120" class="size-full -rotate-90" aria-hidden="true">
							<circle class="gauge-track" cx="60" cy="60" r="45" pathLength="100" />
							<circle
								class="gauge-confidence"
								cx="60"
								cy="60"
								r="52"
								pathLength="100"
								:style="{ strokeDasharray: gaugeDash(gauge.confidence) }"
							/>
							<circle
								class="gauge-score"
								cx="60"
								cy="60"
								r="45"
								pathLength="100"
								:style="{ strokeDasharray: gaugeDash(gauge.value) }"
							/>
						</svg>
						<span class="absolute inset-0 flex flex-col items-center justify-center">
							<TablerIcon :name="gauge.icon" class="mb-1 size-5 text-primary" />
							<strong class="text-xl font-black tabular-nums text-highlighted">
								{{ formatPercentage(gauge.value) }}
							</strong>
						</span>
					</span>
					<span class="mt-2 font-bold text-highlighted">{{ gauge.title }}</span>
					<span class="mt-0.5 text-xs text-muted-foreground">
						{{ labels.confidence }} {{ formatPercentage(gauge.confidence) }}
					</span>
				</button>
			</div>

			<div class="reactor-factor-rail">
				<div class="reactor-base reactor-node" aria-hidden="true">
					<span class="reactor-node-orb">
						<TablerIcon name="sparkles" class="size-5 text-primary" />
						<strong class="mt-1 text-xl font-black tabular-nums text-highlighted">
							{{ integerFormat.format(MAX_LEVEL_POINTS) }}
						</strong>
					</span>
					<span class="reactor-node-label">{{ labels.formula.base }}</span>
				</div>

				<template v-for="stage in factorStages" :key="stage.key">
					<span class="reactor-operator" aria-hidden="true">×</span>
					<button
						type="button"
						class="reactor-factor reactor-node group"
						:class="[
							`reactor-${stage.key}`,
							{
								'is-active': activeStage === stage.key,
								'is-hovered': hoveredStage === stage.key,
							},
						]"
						:aria-pressed="activeStage === stage.key"
						:aria-controls="inspectorId"
						:aria-label="stageAriaLabel(stage)"
						@click="selectStage(stage.key)"
						@focus="selectStage(stage.key)"
						@pointerenter="hoveredStage = stage.key"
						@pointerleave="hoveredStage = null"
					>
						<span class="reactor-node-orb">
							<TablerIcon :name="stage.icon" class="size-5 text-primary" />
							<strong class="mt-1 text-lg font-black tabular-nums text-highlighted">
								{{ formatFactor(stage.value) }}
							</strong>
						</span>
						<span class="reactor-node-label">{{ stage.title }}</span>
					</button>
				</template>

				<span class="reactor-equals" aria-hidden="true">=</span>
				<div class="reactor-result reactor-node">
					<span class="reactor-output-core">
						<span
							class="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-stone-950/65"
						>
							{{ labels.formula.result }}
						</span>
						<strong class="mt-1 text-3xl font-black tabular-nums text-stone-950">
							{{ formattedPoints }}
						</strong>
						<span class="text-xs font-bold text-stone-950/70">
							{{ labels.formula.points }}
						</span>
					</span>
				</div>
			</div>
		</div>

		<section
			:id="inspectorId"
			class="reactor-inspector mt-7 border-y border-border/70 py-4 sm:px-3"
			:aria-labelledby="`${inspectorId}-title`"
			aria-live="polite"
		>
			<div class="grid gap-4 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,2fr)] lg:items-center">
				<div>
					<p class="text-xs font-bold uppercase tracking-[0.2em] text-primary">
						{{ labels.inspector }}
					</p>
					<h3 :id="`${inspectorId}-title`" class="mt-1 text-lg font-black text-highlighted">
						{{ selectedStage.title }}
					</h3>
					<p class="mt-1 text-sm text-muted-foreground">{{ selectedStage.description }}</p>
				</div>
				<dl
					v-if="hasAvailableMetric(selectedStage.metrics)"
					class="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 xl:grid-cols-4"
				>
					<div
						v-for="metric in selectedStage.metrics"
						:key="metric.key"
						class="border-l-2 border-primary/25 pl-3"
					>
						<dt class="text-xs font-medium text-muted-foreground">{{ metric.label }}</dt>
						<dd class="mt-0.5 font-black tabular-nums text-highlighted">
							{{ formatMetric(metric) }}
						</dd>
					</div>
				</dl>
				<p v-else class="font-medium text-muted-foreground">{{ labels.notAvailable }}</p>
			</div>
		</section>

		<div class="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
			<section class="vote-branch relative lg:pr-6" :aria-labelledby="`${inspectorId}-votes`">
				<div class="flex items-start gap-3">
					<span class="rounded-full bg-primary/10 p-2 text-primary">
						<TablerIcon name="chart-donut-4" class="size-5" />
					</span>
					<div>
						<h3 :id="`${inspectorId}-votes`" class="font-black text-highlighted">
							{{ labels.votes.title }}
						</h3>
						<p class="mt-1 text-sm text-muted-foreground">{{ labels.votes.description }}</p>
					</div>
				</div>
				<div class="mt-3">
					<VoteDistributionChart :counts="voteCounts" :labels="labels.voteDistribution" />
				</div>
			</section>

			<aside
				class="diagnostic-lane self-start border-l-2 border-dashed border-border/80 pl-5"
				:aria-labelledby="`${inspectorId}-diagnostics`"
			>
				<div class="flex items-center gap-2">
					<TablerIcon name="microscope" class="size-5 text-muted-foreground" />
					<h3 :id="`${inspectorId}-diagnostics`" class="font-black text-highlighted">
						{{ labels.diagnostics.title }}
					</h3>
					<span
						class="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wide text-muted-foreground"
					>
						{{ labels.diagnostics.observationOnly }}
					</span>
				</div>
				<p class="mt-2 text-sm text-muted-foreground">
					{{ labels.diagnostics.description }}
				</p>
				<dl class="mt-4 space-y-3">
					<div
						v-for="metric in diagnosticMetrics"
						:key="metric.key"
						class="flex items-baseline justify-between gap-4 border-b border-border/50 pb-2"
					>
						<dt class="text-sm text-muted-foreground">{{ metric.label }}</dt>
						<dd class="font-black tabular-nums text-highlighted">{{ formatMetric(metric) }}</dd>
					</div>
				</dl>
			</aside>
		</div>
	</section>
</template>

<script setup vapor lang="ts">
import { MAX_LEVEL_POINTS } from '@zeepkist/core/score'
import type { LevelScoreInsights } from '~/types/app'
import type { TablerIconName } from '~/utils/icons'
import type { VoteDistributionCounts } from '~/utils/voteDistribution'

type MetricKey = keyof LevelScoreInsights
type MetricFormat = 'boolean' | 'decimal' | 'integer' | 'percentage'
type StageKey = 'complexity' | 'skill' | 'quality' | 'evidence' | 'length' | 'votes'

type MetricDefinition = {
	key: MetricKey
	label: string
	format: MetricFormat
}

type StageDefinition = {
	key: StageKey
	title: string
	description: string
	icon: TablerIconName
	value: number | null | undefined
	confidence?: number | null
	metrics: MetricDefinition[]
}

const props = defineProps<{
	model: LevelScoreInsights
	points?: number | null
	voteCounts: VoteDistributionCounts
	labels: {
		stages: Record<StageKey, { title: string; description: string }>
		metrics: Record<MetricKey, string>
		formula: {
			base: string
			result: string
			points: string
			summary: (values: {
				base: string
				quality: string
				evidence: string
				length: string
				votes: string
				result: string
			}) => string
		}
		votes: { title: string; description: string }
		diagnostics: { title: string; description: string; observationOnly: string }
		voteDistribution: {
			ariaLabel: string
			empty: string
			total: (count: number) => string
		}
		confidence: string
		inspector: string
		unavailable: string
		notAvailable: string
		included: string
		excluded: string
	}
}>()

const reactor = ref<HTMLElement | null>(null)
const entered = ref(false)
const activeStage = ref<StageKey>('quality')
const hoveredStage = ref<StageKey | null>(null)
const inspectorId = useId()
let observer: IntersectionObserver | undefined

const { locale } = useI18n()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }))
const factorFormat = computed(
	() => new Intl.NumberFormat(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: 3 }),
)
const integerFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }))
const percentageFormat = computed(
	() => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }),
)

const metric = (key: MetricKey, format: MetricFormat): MetricDefinition => ({
	key,
	format,
	label: props.labels.metrics[key],
})

const stages = computed<StageDefinition[]>(() => [
	{
		key: 'complexity',
		icon: 'route',
		...props.labels.stages.complexity,
		value: props.model.complexityScore,
		confidence: props.model.complexityConfidence,
		metrics: [
			metric('complexityScore', 'percentage'),
			metric('complexityConfidence', 'percentage'),
		],
	},
	{
		key: 'skill',
		icon: 'trophy',
		...props.labels.stages.skill,
		value: props.model.skillScore,
		confidence: props.model.skillConfidence,
		metrics: [
			metric('skillScore', 'percentage'),
			metric('skillConfidence', 'percentage'),
			metric('skillSampleSize', 'integer'),
			metric('skillAlignment', 'percentage'),
			metric('skillSeparation', 'percentage'),
			metric('fieldStrength', 'percentage'),
		],
	},
	{
		key: 'quality',
		icon: 'diamond',
		...props.labels.stages.quality,
		value: props.model.qualityModifier,
		metrics: [
			metric('qualityModifier', 'percentage'),
			metric('qualityScore', 'percentage'),
			metric('complexityScore', 'percentage'),
			metric('skillScore', 'percentage'),
		],
	},
	{
		key: 'evidence',
		icon: 'database-search',
		...props.labels.stages.evidence,
		value: props.model.evidenceModifier,
		metrics: [
			metric('evidenceModifier', 'percentage'),
			metric('complexityConfidence', 'percentage'),
			metric('skillConfidence', 'percentage'),
			metric('skillSampleSize', 'integer'),
		],
	},
	{
		key: 'length',
		icon: 'ruler-measure',
		...props.labels.stages.length,
		value: props.model.lengthModifier,
		metrics: [metric('lengthModifier', 'percentage')],
	},
	{
		key: 'votes',
		icon: 'thumb-up',
		...props.labels.stages.votes,
		value: props.model.voteAdjustment,
		metrics: [metric('voteAdjustment', 'percentage')],
	},
])

const gauges = computed(() =>
	stages.value.filter(
		(stage): stage is StageDefinition & { key: 'complexity' | 'skill' } =>
			stage.key === 'complexity' || stage.key === 'skill',
	),
)
const factorStages = computed(() =>
	stages.value.filter(
		(stage) =>
			stage.key === 'quality' ||
			stage.key === 'evidence' ||
			stage.key === 'length' ||
			stage.key === 'votes',
	),
)
const selectedStage = computed(() => findStage(activeStage.value))
const diagnosticMetrics = computed(() => [
	metric('competitiveMerit', 'percentage'),
	metric('worldRecordExcluded', 'boolean'),
])
const formattedPoints = computed(() =>
	isAvailable(props.points) && typeof props.points === 'number'
		? integerFormat.value.format(props.points)
		: props.labels.unavailable,
)
const accessibleSummary = computed(() =>
	props.labels.formula.summary({
		base: integerFormat.value.format(MAX_LEVEL_POINTS),
		quality: formatFactor(props.model.qualityModifier),
		evidence: formatFactor(props.model.evidenceModifier),
		length: formatFactor(props.model.lengthModifier),
		votes: formatFactor(props.model.voteAdjustment),
		result: formattedPoints.value,
	}),
)

onMounted(() => {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		entered.value = true
		return
	}
	if (!('IntersectionObserver' in window)) {
		entered.value = true
		return
	}
	observer = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return
			entered.value = true
			observer?.disconnect()
		},
		{ threshold: 0.2 },
	)
	if (reactor.value) observer.observe(reactor.value)
})

onBeforeUnmount(() => observer?.disconnect())

function selectStage(stage: StageKey) {
	activeStage.value = stage
}

function findStage(key: StageKey) {
	const stage = stages.value.find((candidate) => candidate.key === key)
	if (!stage) throw new Error(`Unknown level score stage: ${key}`)
	return stage
}

function isAvailable(
	value: number | boolean | null | undefined,
): value is number | boolean {
	return typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
}

function hasAvailableMetric(metrics: MetricDefinition[]) {
	return metrics.some((item) => isAvailable(props.model[item.key]))
}

function formatPercentage(value: number | null | undefined) {
	return typeof value === 'number' && Number.isFinite(value)
		? percentageFormat.value.format(value)
		: props.labels.unavailable
}

function formatFactor(value: number | null | undefined) {
	return typeof value === 'number' && Number.isFinite(value)
		? factorFormat.value.format(value)
		: props.labels.unavailable
}

function gaugeDash(value: number | null | undefined) {
	const percentage =
		typeof value === 'number' && Number.isFinite(value)
			? Math.max(0, Math.min(100, value * 100))
			: 0
	return `${percentage} 100`
}

function stageAriaLabel(stage: StageDefinition) {
	return `${stage.title}: ${formatPercentage(stage.value)}. ${stage.description}`
}

function formatMetric(metric: MetricDefinition) {
	const value = props.model[metric.key]
	if (!isAvailable(value)) return props.labels.unavailable
	if (typeof value === 'boolean') return value ? props.labels.excluded : props.labels.included

	switch (metric.format) {
		case 'percentage':
			return percentageFormat.value.format(value)
		case 'integer':
			return integerFormat.value.format(value)
		default:
			return numberFormat.value.format(value)
	}
}
</script>

<style scoped>
.points-reactor {
	background: transparent;
}

.reactor-grid {
	background-image:
		linear-gradient(to right, color-mix(in oklab, var(--ui-border) 45%, transparent) 1px, transparent 1px),
		linear-gradient(to bottom, color-mix(in oklab, var(--ui-border) 45%, transparent) 1px, transparent 1px);
	background-size: 2.5rem 2.5rem;
	mask-image: linear-gradient(to bottom, black, transparent 78%);
}

.reactor-map {
	position: relative;
}

.reactor-gauge-rail {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	align-items: center;
	gap: 0.75rem;
}

.reactor-factor-rail {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	margin-top: 1.25rem;
}

.reactor-gauge,
.reactor-node {
	position: relative;
	z-index: 10;
	display: flex;
	min-width: 0;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
}

.reactor-gauge {
	border-radius: 9999px;
	padding: 0.35rem;
	transition:
		transform 180ms ease,
		filter 180ms ease;
}

.reactor-gauge:is(:hover, :focus-visible, .is-active, .is-hovered) {
	transform: translateY(-0.2rem);
	outline: none;
}

.reactor-gauge-visual {
	position: relative;
	display: block;
	width: clamp(6.5rem, 17vw, 8rem);
	aspect-ratio: 1;
	border-radius: 9999px;
	background: radial-gradient(circle, var(--ui-bg-elevated), color-mix(in oklab, var(--ui-bg) 88%, transparent));
	transition: box-shadow 180ms ease;
}

.reactor-gauge:focus-visible .reactor-gauge-visual,
.reactor-gauge.is-active .reactor-gauge-visual {
	box-shadow:
		0 0 0 2px var(--ui-bg),
		0 0 0 4px color-mix(in oklab, var(--ui-primary) 65%, transparent);
}

.gauge-track,
.gauge-score,
.gauge-confidence {
	fill: none;
	stroke-linecap: round;
}

.gauge-track {
	stroke: color-mix(in oklab, var(--ui-border) 65%, transparent);
	stroke-width: 8;
}

.gauge-score {
	stroke: var(--ui-primary);
	stroke-width: 8;
	stroke-dashoffset: 100;
	transition: stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1) 250ms;
}

.gauge-confidence {
	stroke: color-mix(in oklab, var(--ui-primary) 42%, transparent);
	stroke-width: 2;
	stroke-dashoffset: 100;
	transition: stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1) 400ms;
}

.is-visible .gauge-score,
.is-visible .gauge-confidence {
	stroke-dashoffset: 0;
}

.reactor-node {
	min-height: 9rem;
}

.reactor-node-orb {
	display: flex;
	width: 6.75rem;
	aspect-ratio: 1;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border: 1px solid color-mix(in oklab, var(--ui-primary) 35%, var(--ui-border));
	border-radius: 9999px;
	background:
		radial-gradient(circle at 50% 28%, color-mix(in oklab, var(--ui-primary) 15%, transparent), transparent 55%),
		var(--ui-bg-elevated);
	box-shadow:
		inset 0 0 1.5rem color-mix(in oklab, var(--ui-primary) 8%, transparent),
		0 0 0 1px color-mix(in oklab, var(--ui-bg) 70%, transparent);
	transition:
		transform 180ms ease,
		border-color 180ms ease,
		box-shadow 180ms ease;
}

.reactor-factor {
	width: 100%;
	border-radius: 1rem;
}

.reactor-factor:is(:hover, :focus-visible, .is-active, .is-hovered) {
	outline: none;
}

.reactor-factor:is(:hover, :focus-visible, .is-active, .is-hovered) .reactor-node-orb {
	transform: translateY(-0.2rem) scale(1.035);
	border-color: var(--ui-primary);
	box-shadow:
		inset 0 0 1.5rem color-mix(in oklab, var(--ui-primary) 12%, transparent),
		0 0 0 3px color-mix(in oklab, var(--ui-primary) 12%, transparent);
}

.reactor-node-label {
	margin-top: 0.55rem;
	max-width: 9rem;
	font-size: 0.75rem;
	font-weight: 800;
	line-height: 1.1;
	color: var(--ui-text-highlighted);
}

.reactor-operator,
.reactor-equals {
	display: flex;
	flex: none;
	width: 2rem;
	height: 2rem;
	align-items: center;
	justify-content: center;
	border-radius: 9999px;
	background: var(--ui-bg);
	font-size: 1.2rem;
	font-weight: 900;
	color: var(--ui-primary);
}

.reactor-output-core {
	display: flex;
	width: 9.25rem;
	aspect-ratio: 1;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border: 2px solid color-mix(in oklab, var(--ui-primary) 75%, white);
	border-radius: 9999px;
	background:
		radial-gradient(circle at 35% 25%, rgb(254 240 138), transparent 30%),
		linear-gradient(145deg, rgb(250 204 21), rgb(202 138 4));
	box-shadow:
		inset 0 0 1.5rem rgb(255 255 255 / 25%),
		0 0 0 0.5rem color-mix(in oklab, var(--ui-primary) 8%, transparent),
		0 0 1rem color-mix(in oklab, var(--ui-primary) 15%, transparent);
	opacity: 0;
	transform: scale(0.78);
	transition:
		opacity 500ms ease 900ms,
		transform 700ms cubic-bezier(0.22, 1, 0.36, 1) 900ms;
}

.is-visible .reactor-output-core {
	opacity: 1;
	transform: scale(1);
}

.reactor-path {
	fill: none;
	stroke: url("#reactor-line-gradient");
	stroke-width: 2;
	stroke-dasharray: 1;
	stroke-dashoffset: 1;
	transition: stroke-dashoffset 900ms ease 100ms;
}

.is-visible .reactor-path {
	stroke-dashoffset: 0;
}

.reactor-inspector {
	background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--ui-primary) 5%, transparent), transparent);
}

.vote-branch::before {
	content: "";
	position: absolute;
	top: -1.75rem;
	left: 1.15rem;
	height: 1.25rem;
	border-left: 2px dotted color-mix(in oklab, var(--ui-primary) 35%, transparent);
}

@media (min-width: 64rem) {
	.reactor-map {
		min-height: 26.875rem;
	}

	.reactor-gauge-rail {
		grid-template-columns: repeat(6, minmax(0, 1fr));
		min-height: 11.5rem;
	}

	.reactor-factor-rail {
		min-height: 12rem;
		flex-direction: row;
		align-items: center;
		gap: 0;
		margin-top: 1.5rem;
	}

	.reactor-factor-rail > .reactor-node {
		flex: 1 1 0;
		width: auto;
	}

	.reactor-quality::before {
		content: "";
		position: absolute;
		top: -2.75rem;
		left: 50%;
		height: 2rem;
		border-left: 2px solid color-mix(in oklab, var(--ui-primary) 45%, transparent);
	}

	.reactor-quality .reactor-node-orb {
		width: 7.5rem;
		border-width: 2px;
	}
}

@media (max-width: 63.999rem) {
	.reactor-factor-rail::before {
		content: "";
		position: absolute;
		top: 4.5rem;
		bottom: 5rem;
		left: 50%;
		z-index: 0;
		border-left: 2px solid color-mix(in oklab, var(--ui-primary) 25%, transparent);
	}
}

@media (prefers-reduced-motion: reduce) {
	.gauge-score,
	.gauge-confidence,
	.reactor-path,
	.reactor-output-core {
		transition: none;
	}
}
</style>
