import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from "vite-plugin-dts";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "Vue Spectrogram.JS",
      fileName: (format) => `spectrogram-vue.${format}.js`,
    },
    sourcemap: true,
    rollupOptions: {
      external: ['vue', 'd3'],
      output: {
        globals: {
          'vue': 'Vue',
          'd3': 'd3'
        },
      },
    },
  },
  plugins: [vue(), dts()]
});
