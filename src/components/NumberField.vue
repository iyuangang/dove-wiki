<script setup lang="ts">
import { computed, useId } from 'vue'
import { numberError } from '../lib/input-validation'
const props = withDefaults(defineProps<{ modelValue: number; label: string; min: number; max?: number; step?: number; integer?: boolean; disabled?: boolean; error?: string }>(), { max: Infinity, step: 1 })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const errorId = useId()
const message = computed(() => props.error || numberError(props.modelValue, props.min, props.max, props.integer))
</script>

<template>
  <label class="number-field">
    <span>{{ label }}</span>
    <input type="number" :aria-label="label" :value="Number.isFinite(modelValue) ? modelValue : ''" :min="min" :max="Number.isFinite(max) ? max : undefined" :step="step" :disabled="disabled" :aria-invalid="message ? 'true' : undefined" :aria-describedby="message ? errorId : undefined" @input="emit('update:modelValue', ($event.target as HTMLInputElement).valueAsNumber)" />
    <small v-if="message && !disabled" :id="errorId" class="field-error">{{ message }}</small>
  </label>
</template>
