<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import {
  getGlossaryEntry,
  type GlossaryTermId,
} from '@/lib/glossary';

const props = defineProps<{
  term: GlossaryTermId;
}>();

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLDivElement | null>(null);
const coords = ref({ top: 0, left: 0, width: 280 });

const entry = computed(() => getGlossaryEntry(props.term));
const tipId = computed(() => `info-tooltip-${props.term}`);
const labelId = computed(() => `${tipId.value}-label`);

let leaveTimer: ReturnType<typeof setTimeout> | undefined;
/** Suppress reopen when Escape restores focus to the trigger. */
let suppressFocusOpen = false;

function clearLeaveTimer(): void {
  if (leaveTimer !== undefined) {
    clearTimeout(leaveTimer);
    leaveTimer = undefined;
  }
}

function scheduleHide(): void {
  clearLeaveTimer();
  leaveTimer = setTimeout(() => {
    open.value = false;
  }, 160);
}

function show(): void {
  if (suppressFocusOpen) return;
  clearLeaveTimer();
  open.value = true;
  void nextTick(() => updatePosition());
}

function onTriggerFocus(): void {
  if (suppressFocusOpen) return;
  show();
}

function hide(): void {
  clearLeaveTimer();
  open.value = false;
}

function toggle(): void {
  if (open.value) hide();
  else show();
}

function onTriggerBlur(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null;
  if (panelRef.value?.contains(next)) {
    clearLeaveTimer();
    return;
  }
  scheduleHide();
}

function updatePosition(): void {
  const trigger = triggerRef.value;
  const panel = panelRef.value;
  if (!trigger || !panel) return;

  const margin = 8;
  const rect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const width = Math.min(320, Math.max(240, window.innerWidth - margin * 2));

  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

  const belowTop = rect.bottom + margin;
  const aboveTop = rect.top - panelRect.height - margin;
  const fitsBelow = belowTop + panelRect.height <= window.innerHeight - margin;
  const top = fitsBelow
    ? belowTop
    : Math.max(margin, aboveTop);

  coords.value = { top, left, width };
}

function onDocPointerDown(e: PointerEvent): void {
  if (!open.value) return;
  const t = e.target as Node | null;
  if (triggerRef.value?.contains(t) || panelRef.value?.contains(t)) return;
  hide();
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation();
    hide();
    suppressFocusOpen = true;
    triggerRef.value?.focus();
    window.setTimeout(() => {
      suppressFocusOpen = false;
    }, 0);
  }
}

function onViewportChange(): void {
  if (open.value) updatePosition();
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('keydown', onKeydown, true);
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('scroll', onViewportChange, true);
});

onUnmounted(() => {
  clearLeaveTimer();
  document.removeEventListener('pointerdown', onDocPointerDown, true);
  document.removeEventListener('keydown', onKeydown, true);
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, true);
});

watch(open, (isOpen) => {
  if (isOpen) void nextTick(() => updatePosition());
});
</script>

<template>
  <span class="info-tooltip print:hidden inline-flex align-middle">
    <button
      ref="triggerRef"
      type="button"
      class="info-tooltip__trigger inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-panel text-[0.65rem] font-semibold leading-none text-ink-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-accent"
      :aria-label="`About: ${entry.title}`"
      :aria-expanded="open"
      :aria-controls="tipId"
      :aria-describedby="open ? tipId : undefined"
      @mouseenter="show"
      @mouseleave="scheduleHide"
      @focus="onTriggerFocus"
      @blur="onTriggerBlur"
      @click.stop.prevent="toggle"
    >
      <span aria-hidden="true">i</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        :id="tipId"
        ref="panelRef"
        role="tooltip"
        class="info-tooltip__panel fixed z-80 rounded-lg border border-border bg-panel p-3 text-left shadow-md"
        :style="{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: `${coords.width}px`,
        }"
        @mouseenter="show"
        @mouseleave="scheduleHide"
      >
        <p :id="labelId" class="text-xs font-semibold text-ink">
          {{ entry.title }}
        </p>
        <p class="mt-1 text-xs leading-relaxed text-ink-muted">
          {{ entry.body }}
        </p>
      </div>
    </Teleport>
  </span>
</template>
