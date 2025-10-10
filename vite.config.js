import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This securely exposes the environment variable to the client code.
    // Vercel provides the process.env.API_KEY during the build process.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
