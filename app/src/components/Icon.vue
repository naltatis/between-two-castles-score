<script setup lang="ts">
import { ICON } from "../icons";

defineProps<{ name: keyof typeof ICON; size?: number; width?: number }>();
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="width ?? 2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="ICON[name]" />
  </svg>
</template>
