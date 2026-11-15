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
  info: 'bg-[var(--color-info-tint)] text-[var(--color-info)] border-[var(--color-info)]',
  success:
    'bg-[var(--color-success-tint)] text-[var(--color-success)] border-[var(--color-success)]',
  warning:
    'bg-[var(--color-warning-tint)] text-[var(--color-warning)] border-[var(--color-warning)]',
  danger:
    'bg-[var(--color-danger-tint)] text-[var(--color-danger)] border-[var(--color-danger)]',
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
