import react from '@vitejs/plugin-react'
import type { UserConfig } from 'vite'
import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin'


export default {
  plugins: [react()],
  optimizeDeps: {
      esbuildOptions: {
        plugins: [
           
          importMetaUrlPlugin]
      }
    }
} satisfies UserConfig