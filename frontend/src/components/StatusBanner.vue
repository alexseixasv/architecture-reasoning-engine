<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'info' | 'success' | 'warning' | 'danger';
    title: string;
    message?: string | null;
  }>(),
  { tone: 'info', message: null },
);

const toneClass: Record<string, string> = {
  info: 'bg-info-tint text-info border-info',
  success:
    'bg-success-tint text-success border-success',
  warning:
    'bg-warning-tint text-warning border-warning',
  danger:
    'bg-danger-tint text-danger border-danger',
};
</script>

<template>
  <div
    class="rounded-lg border px-3 py-2 text-sm"
    :class="toneClass[tone]"
    role="status"
  >
    <p class="font-semibold">{{ title }}</p>
    <p v-if="message" class="mt-1 text-[0.95em] opacity-90">{{ message }}</p>
  </div>
</template>
