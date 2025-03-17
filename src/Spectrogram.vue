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
