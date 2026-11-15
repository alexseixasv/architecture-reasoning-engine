<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <div class="min-h-screen bg-canvas text-ink">
    <header
      class="print:hidden border-b border-black/20 bg-header text-ink-on-dark"
    >
      <div
        class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4"
      >
        <div>
          <p class="text-xs uppercase tracking-wide text-ink-on-dark-muted">
            Architecture Reasoning Engine
          </p>
          <h1 class="text-xl font-semibold">
            {{
              route.name === 'evaluation'
                ? 'Evaluation Lab'
                : 'Deterministic analysis workspace'
            }}
          </h1>
        </div>
        <nav
          class="flex items-center gap-1 text-sm"
          aria-label="Primary"
        >
          <RouterLink
            to="/"
            class="rounded-md px-3 py-1.5 transition-colors"
            :class="
              route.name === 'workspace'
                ? 'bg-accent/20 text-ink-on-dark font-semibold'
                : 'text-ink-on-dark-muted hover:text-ink-on-dark'
            "
          >
            Workspace
          </RouterLink>
          <span class="text-ink-on-dark-muted" aria-hidden="true">|</span>
          <RouterLink
            to="/evaluation"
            class="rounded-md px-3 py-1.5 transition-colors"
            :class="
              route.name === 'evaluation'
                ? 'bg-accent/20 text-ink-on-dark font-semibold'
                : 'text-ink-on-dark-muted hover:text-ink-on-dark'
            "
          >
            Evaluation Lab
          </RouterLink>
        </nav>
      </div>
    </header>
    <RouterView />
  </div>
</template>
