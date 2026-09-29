import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // If 5173 is taken, fail loudly instead of quietly hopping to 5174 -
    // the backend's CORS_ORIGIN allowlist names localhost:5173 exactly, so a
    // silent port change would make every API call fail with a confusing
    // CORS error (most likely to bite when the backend is on Render).
    strictPort: true,
  },
});
