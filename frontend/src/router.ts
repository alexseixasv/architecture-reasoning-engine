import { createRouter, createWebHistory } from 'vue-router';
import EvaluationLabView from '@/pages/EvaluationLabView.vue';
import WorkspaceView from '@/pages/WorkspaceView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'workspace',
      component: WorkspaceView,
    },
    {
      path: '/evaluation',
      name: 'evaluation',
      component: EvaluationLabView,
    },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});
