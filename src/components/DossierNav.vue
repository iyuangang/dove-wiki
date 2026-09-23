<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { BookOpen, X } from '@lucide/vue'

const props = defineProps<{ title: string; closeLabel: string; sections: { id: string; label: string }[] }>()
defineEmits<{ close: [] }>()
const bar = ref<HTMLElement | null>(null)
const active = ref(props.sections[0]?.id)
let panel: HTMLElement | null = null
let previousFocus: HTMLElement | null = null

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

function keepFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !panel) return
  const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')).filter((element) => element.getClientRects().length)
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

onMounted(async () => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  panel = bar.value?.closest<HTMLElement>('[role="dialog"]') ?? null
  panel?.addEventListener('scroll', trackSection, { passive: true })
  panel?.addEventListener('keydown', keepFocus)
  window.addEventListener('resize', trackSection)
  await nextTick()
  panel?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  panel?.removeEventListener('scroll', trackSection)
  panel?.removeEventListener('keydown', keepFocus)
  window.removeEventListener('resize', trackSection)
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
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
