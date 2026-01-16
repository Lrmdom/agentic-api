import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Skip declaration files for production
  clean: true, // Clean dist folder before build
  minify: false, // Disable minification to avoid bundling issues
  sourcemap: false, // Disable sourcemaps in production
  target: 'node18', // Target Node.js 18+ for Cloud Run
  external: [
    // Keep these as external dependencies (not bundled)
    '@genkit-ai/*',
    '@google-cloud/*',
    '@hono/*',
    '@modelcontextprotocol/*',
    'google-auth-library',
    'genkit',
    'dotenv',
    'child_process',
    './src/mcp/**/*',
    // Add other large dependencies that should remain external
  ],
  banner: {
    js: '// Production build - optimized for memory usage',
  },
});
