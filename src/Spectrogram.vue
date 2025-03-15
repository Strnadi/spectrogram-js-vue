<template>
  <div id="vis" class="spectrogram"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import Spectrogram from './spectrogram.js';

interface SpectrogramProps {
  audioSrc: string;
  width: number;
  height: number;
  sampleSize: number;
  maxFrequency: number;
  minFrequency: number;
  colorScheme: string[];
}

const props = defineProps<SpectrogramProps>();

onMounted(() => {
  const spectrogram = new Spectrogram(props.audioSrc, '#vis', {
    width: props.width,
    height: props.height,
    sampleSize: props.sampleSize,
    maxFrequency: props.maxFrequency,
    minFrequency: props.minFrequency,
    colorScheme: props.colorScheme
  });
});
</script>

<style scoped>
:deep(canvas), :deep(svg) {
  position: absolute;
  top: 0;
  left: 0;
}

:deep(.spectrogram) {
  position: relative;
}

:deep(.axis) {
  font: 14px sans-serif;
}

:deep(.axis path), :deep(.axis line) {
  fill: none;
}

:deep(.axis line) {
  shape-rendering: crispEdges;
  stroke: #444;
  stroke-width: 1.0px;
  stroke-dasharray: 2, 4;
}

:deep(#progress-line) {
  stroke: #a50f15;
  stroke-width: 4px;
}
</style>
