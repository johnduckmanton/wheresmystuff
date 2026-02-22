import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    css: true,
    // Property-based testing configuration
    // Minimum 100 iterations per property test as per design spec
    testTimeout: 10000, // Increased timeout for property-based tests
  },
});
