import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['55c64c065964.ngrok-free.app'], // 👈 your actual ngrok domain
  },
});
