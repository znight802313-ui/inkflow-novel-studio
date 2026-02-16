import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
        proxy: {
          '/api/anthropic': {
            target: 'https://mixai.cc',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/anthropic/, '/v1'),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
        'process.env.CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY),
        'process.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL),
        'process.env.ANTHROPIC_BASE_URL': JSON.stringify('/api/anthropic'),
        'process.env.ANTHROPIC_AUTH_TOKEN': JSON.stringify(env.ANTHROPIC_AUTH_TOKEN),
        'process.env.ANTHROPIC_MODEL': JSON.stringify(env.ANTHROPIC_MODEL),
        'process.env.AVAILABLE_MODELS': JSON.stringify(env.AVAILABLE_MODELS),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
