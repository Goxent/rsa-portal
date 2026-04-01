import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react-is': path.resolve(__dirname, 'node_modules/react-is/index.js'),
      }
    },
    esbuild: {
      drop: ['console', 'debugger'],
    },
    build: {
      sourcemap: false, // Prevents readable code in F12
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name]-[hash].js`,
          chunkFileNames: `assets/[name]-[hash].js`,
          assetFileNames: `assets/[name]-[hash].[ext]`,
        },
      },
    },
    optimizeDeps: {
      include: ['react-is']
    }
  };
});
