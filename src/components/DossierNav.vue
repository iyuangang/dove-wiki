<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useDialogFocus } from '../composables/useDialogFocus'
import { BookOpen, X } from '@lucide/vue'

const props = defineProps<{ title: string; closeLabel: string; sections: { id: string; label: string }[] }>()
defineEmits<{ close: [] }>()
const bar = ref<HTMLElement | null>(null)
const active = ref(props.sections[0]?.id)
let panel: HTMLElement | null = null
const focusPanel = ref<HTMLElement | null>(null)
useDialogFocus(focusPanel)

function section(id: string) {
  return panel?.querySelector<HTMLElement>(`[data-section="${id}"]`)
}

function jump(id: string) {
  const target = section(id)
  if (!target || !panel) return
  const top = target.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - (bar.value?.offsetHeight ?? 90) - 20
  panel.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
}

function trackSection() {
  if (!panel) return
  if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2) {
    active.value = props.sections[props.sections.length - 1]?.id
    return
  }
  const threshold = panel.getBoundingClientRect().top + (bar.value?.offsetHeight ?? 90) + 45
  active.value = [...props.sections].reverse().find((item) => (section(item.id)?.getBoundingClientRect().top ?? Infinity) <= threshold)?.id ?? props.sections[0]?.id
}

onMounted(() => {
  panel = bar.value?.closest<HTMLElement>('[role="dialog"]') ?? null
  panel?.addEventListener('scroll', trackSection, { passive: true })
  focusPanel.value = panel
  window.addEventListener('resize', trackSection)
})

onBeforeUnmount(() => {
  panel?.removeEventListener('scroll', trackSection)
  window.removeEventListener('resize', trackSection)
})
</script>

<template>
  <div ref="bar" class="dossier-bar">
    <div class="dossier-bar-heading">
      <span><BookOpen :size="15" aria-hidden="true" />{{ title }}<small>档案</small></span>
      <button type="button" class="dossier-close" :aria-label="closeLabel" @click="$emit('close')"><X :size="18" aria-hidden="true" /></button>
    </div>
    <nav class="dossier-nav" aria-label="档案章节">
      <button v-for="item in sections" :key="item.id" type="button" :class="{ active: active === item.id }" :aria-current="active === item.id ? 'location' : undefined" @click="jump(item.id)">{{ item.label }}</button>
    </nav>
  </div>
</template>
