<script setup lang="ts">
import {ref} from 'vue'

const tick = ref<number>(0)
let interval: number | undefined

onMounted(() => {
  interval = window.setInterval(() => tick.value++, 1000)
})
onBeforeUnmount(() => {
  window.clearInterval(interval)
  interval = undefined
})
</script>

<template>
  <div class="border p-3 rounded-lg ring ring-inset ring-primary/25 bg-primary/10 border-primary">
    {{ tick }}
  </div>
</template>
