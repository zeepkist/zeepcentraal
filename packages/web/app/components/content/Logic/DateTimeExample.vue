<script setup lang="ts">
import {ref} from 'vue'

const date = ref<{ Y: string, M: string, D: string, h: string, m: string, s: string }>({
      Y: '0',
      M: '0',
      D: '0',
      h: '0',
      m: '0',
      s: '0'
    }),
    utc = ref<HTMLInputElement | null>(null)
let interval: number | undefined

onMounted(() => {
  const numberFormat = Intl.NumberFormat(navigator.languages ?? navigator.language ?? 'en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false
  })
  interval = window.setInterval(() => {
    const now = new Date()
    const useUtc = utc.value!.checked
    date.value = {
      Y: numberFormat.format(useUtc ? now.getUTCFullYear() : now.getFullYear()),
      M: numberFormat.format((useUtc ? now.getUTCMonth() : now.getMonth()) + 1),
      D: numberFormat.format(useUtc ? now.getUTCDate() : now.getDate()),
      h: numberFormat.format(useUtc ? now.getUTCHours() : now.getHours()),
      m: numberFormat.format(useUtc ? now.getUTCMinutes() : now.getMinutes()),
      s: numberFormat.format(useUtc ? now.getUTCSeconds() : now.getSeconds()),
    }
  }, 1000)
})
onBeforeUnmount(() => {
  window.clearInterval(interval)
  interval = undefined
})
</script>

<template>
  <div class="border p-3 rounded-lg ring ring-inset ring-primary/25 bg-primary/10 border-primary">
    <div class="flex flex-row items-center">
      <span>{{ date.Y }}</span>
      <span class="ng-gray-800">/</span>
      <span>{{ date.M }}</span>
      <span class="ng-gray-800">/</span>
      <span>{{ date.D }}</span>
      <span class="ng-gray-800">&nbsp;</span>
      <span>{{ date.h }}</span>
      <span class="ng-gray-800">:</span>
      <span>{{ date.m }}</span>
      <span class="ng-gray-800">:</span>
      <span>{{ date.s }}</span>
    </div>
    <label>
      <input type="checkbox" ref="utc"/><span class="inline-block ps-1">UTC Time</span>
    </label>
  </div>
</template>
