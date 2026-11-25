<script setup lang="ts">
import {ref} from 'vue'

type Point = { x: number, y: number, velocity: number }

let count = ref<number>(0),
    points = ref<Point[]>([]),
    animating: boolean = false

function handleClick(ev: MouseEvent): void {
  if (!animating) {
    animating = true
    requestAnimationFrame(updatePoints)
  }
  if (points.value.length < 10) {
    points.value.push({x: 0, y: ev.offsetY, velocity: Math.random()})
  }
}

function updatePoints(): void {
  let i = 0;
  let inTrigger = 0
  while (i < points.value.length) {
    const point = points.value[i]!
    point.x += point.velocity;
    if (point.x > 128) {
      points.value.splice(i, 1);
    } else {
      if (point.x >= 40 && point.x < 88) {
        inTrigger += 1
      }
      ++i
    }
  }
  count.value = inTrigger
  if (points.value.length) {
    requestAnimationFrame(updatePoints)
  } else {
    animating = false
  }
}

function makeTransform(point: Point) {
  return `translate(${point.x},${point.y})`
}
</script>

<template>
  <div class="border p-3 rounded-lg ring ring-inset ring-primary/25 bg-primary/10 border-primary">
    <div class="flex flex-row items-center">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 48" width="128" height="48" class="border bg-default" aria-hidden="true"
           @click.prevent="handleClick" @dblclick.prevent="() => {}">
        <rect width="48" height="48" x="40" fill="darkgreen"/>
        <path d="M64 16a8 8 0 1 1-8 8M64 10a14 14 0 1 1-14 14M54 10h2l5 5v4l3 3a2 2 0 1 1-2 2l-3-3h-4l-5-5v-2h4v-4z"
              stroke="green" stroke-width="4" fill="none"/>
        <circle cx="0" cy="0" r="2" fill="white" v-for="point in points" :transform="makeTransform(point)"/>
        />
      </svg>
      <div class="p-3">{{ count }}</div>
    </div>
    <p class="text-muted text-sm">Click on the drawing to generate an object to pass through the trigger. Its speed will
      be randomized.</p>
  </div>
</template>
