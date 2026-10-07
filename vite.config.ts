import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/**
 * Runs the `api/*.ts` Vercel functions inside `vite dev` so the AI endpoints can
 * be exercised locally without the Vercel CLI. Dev only — in production Vercel
 * runs these files itself. Secrets come from .env.local into process.env (the
 * node process, not the client bundle, which stays governed by envPrefix).
 */
function localApi(mode: string): Plugin {
  return {
    name: 'local-vercel-api',
    apply: 'serve',
    // `../_lib/verifyUser.js` is a TS-style extension: the file on disk is .ts.
    resolveId(source, importer) {
      if (!importer?.includes('/api/') || !source.endsWith('.js')) return null;
      return path.resolve(path.dirname(importer), source.replace(/\.js$/, '.ts'));
    },
    configureServer(server) {
      Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();

        const file = path.join(process.cwd(), `${url.pathname.slice(1)}.ts`);
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString();

          const mod = await server.ssrLoadModule(file);
          // Minimal VercelRequest/VercelResponse shim — parsed body, query,
          // and the status()/json() chaining the handlers actually use.
          const vreq = Object.assign(req, {
            body: raw ? JSON.parse(raw) : {},
            query: Object.fromEntries(url.searchParams),
          });
          const vres = Object.assign(res, {
            status(code: number) { res.statusCode = code; return vres; },
            json(payload: unknown) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(payload));
              return vres;
            },
            send(payload: string) { res.end(payload); return vres; },
          });
          await mod.default(vreq, vres);
        } catch (err: any) {
          server.config.logger.error(`[local-api] ${url.pathname}: ${err.stack || err}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Local API error: ${err.message}` }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isNativeBuild = mode === 'native';

  return {
    // Vercel's Supabase Marketplace integration injects NEXT_PUBLIC_-prefixed
    // vars; expose those to the client bundle alongside Vite's own VITE_ prefix.
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [
      localApi(mode),
      react(),
      tailwindcss(),
      ...(!isNativeBuild ? [VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000,
          // Never let the SPA navigation fallback swallow serverless API calls.
          navigateFallbackDenylist: [/^\/api\//]
        },
        manifest: {
          name: 'Aziz',
          short_name: 'Aziz',
          description: 'Personal Finance Expert App',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          icons: [
            {
              src: '/logo-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/logo-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })] : [])
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
