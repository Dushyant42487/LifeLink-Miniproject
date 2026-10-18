/**
 * LifeLink Unified Gateway Server
 * Blends LifeLink Main Platform (Vite + Express Backend + FastAPI ML) and
 * LifeLink Chatbot ("chatboot") into a single, unified HTTP/WebSocket entrypoint.
 *
 * Routing Rules:
 *   - /              -> Vite Frontend dev server (http://localhost:5173, with WebSocket HMR)
 *   - /api           -> LifeLink Express Backend API (http://localhost:5001)
 *   - /predict       -> FastAPI AI/ML Microservice (http://localhost:8000)
 *   - /chat          -> LifeLink Chatbot & Knowledge Assistant (http://localhost:3000)
 *   - Chatbot /api/* -> Chatbot API & SSE endpoints (/api/chat, /api/camps, /api/status, etc.)
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration from .env
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Gateway Port (defaults to 8090, can be customized via GATEWAY_PORT)
const PORT = process.env.GATEWAY_PORT || 8090;

// Upstream service ports (read from env or fallback to defaults)
const VITE_PORT = process.env.VITE_PORT || 5173;
const BACKEND_PORT = process.env.BACKEND_PORT || 5001;
const ML_PORT = process.env.ML_PORT || 8000;
const CHATBOT_PORT = process.env.CHATBOT_PORT || 3000;

const VITE_TARGET = `http://localhost:${VITE_PORT}`;
const BACKEND_TARGET = `http://localhost:${BACKEND_PORT}`;
const ML_TARGET = `http://localhost:${ML_PORT}`;
const CHATBOT_TARGET = `http://localhost:${CHATBOT_PORT}`;

// =============================================================================
// Helper: SSE & Streaming Optimization Handlers
// =============================================================================
const handleSseProxyReq = (proxyReq, req, res) => {
  if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
    proxyReq.setHeader('Cache-Control', 'no-cache');
    proxyReq.setHeader('X-Accel-Buffering', 'no');
  }
};

const handleSseProxyRes = (proxyRes, req, res) => {
  // Ensure unbuffered streaming for Server-Sent Events (SSE)
  if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/event-stream')) {
    proxyRes.headers['x-accel-buffering'] = 'no';
    proxyRes.headers['cache-control'] = 'no-cache, no-transform';
  }
};

const createErrorHandler = (serviceName) => (err, req, res) => {
  console.error(`[Gateway Error] ${serviceName} service unreachable:`, err.message);
  if (!res.headersSent) {
    res.status(502).json({
      error: `Gateway Error: ${serviceName} is unavailable.`,
      target: req.originalUrl,
      details: err.message
    });
  }
};

// =============================================================================
// 1. Trailing-slash normalization for Chatbot frontend (/chat -> /chat/)
// =============================================================================
// Crucial: Chatbot's index.html loads relative assets ('style.css', 'app.js').
// Visiting /chat without trailing slash resolves them to /style.css (Vite).
// Redirecting to /chat/ ensures browser resolves them to /chat/style.css!
app.use((req, res, next) => {
  if (req.path === '/chat') {
    const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    return res.redirect(302, `/chat/${query}`);
  }
  next();
});

// =============================================================================
// 2. Chatbot Service Proxy (/chat)
// =============================================================================
// Proxies both static assets and API/SSE endpoints under /chat
app.use(
  '/chat',
  createProxyMiddleware({
    target: CHATBOT_TARGET,
    changeOrigin: true,
    pathRewrite: {
      '^/chat': '' // Strips /chat prefix when forwarding to chatbot server
    },
    timeout: 0, // Disable socket timeout for long-running LLM stream generations
    proxyTimeout: 0,
    buffer: false, // Do not buffer chunks (vital for SSE)
    onProxyReq: handleSseProxyReq,
    onProxyRes: handleSseProxyRes,
    onError: createErrorHandler('Chatbot (/chat)'),
    on: {
      proxyReq: handleSseProxyReq,
      proxyRes: handleSseProxyRes,
      error: createErrorHandler('Chatbot (/chat)')
    }
  })
);

// =============================================================================
// 3. Chatbot Dedicated API Proxy (Zero-Modification Bridge)
// =============================================================================
// The chatbot's public/app.js makes origin-relative calls to /api/*:
// - /api/chat/stream (SSE)
// - /api/camps (eRaktKosh proxy)
// - /api/districts & /api/blood-groups
// - /api/blood-availability
// - /api/upload-pdf (Unstructured/PyMuPDF ingestion)
// - /api/documents (Atomic atoms)
// - /api/status (Atomic MCP + Ollama check)
//
// By intercepting these exact paths before the general /api proxy, the chatbot
// functions 100% correctly with ZERO modifications to its internal frontend logic.
const CHATBOT_API_ROUTES = [
  '/api/chat',
  '/api/camps',
  '/api/districts',
  '/api/blood-groups',
  '/api/blood-availability',
  '/api/upload-pdf',
  '/api/documents',
  '/api/status'
];

app.use(
  CHATBOT_API_ROUTES,
  createProxyMiddleware({
    target: CHATBOT_TARGET,
    changeOrigin: true,
    timeout: 0,
    proxyTimeout: 0,
    buffer: false,
    onProxyReq: handleSseProxyReq,
    onProxyRes: handleSseProxyRes,
    onError: createErrorHandler('Chatbot API'),
    on: {
      proxyReq: handleSseProxyReq,
      proxyRes: handleSseProxyRes,
      error: createErrorHandler('Chatbot API')
    }
  })
);

// =============================================================================
// 4. AI / ML Microservice Proxy (/predict)
// =============================================================================
// FastAPI microservice running on port 8000
app.use(
  '/predict',
  createProxyMiddleware({
    target: ML_TARGET,
    changeOrigin: true,
    onError: createErrorHandler('FastAPI ML Service (/predict)'),
    on: {
      error: createErrorHandler('FastAPI ML Service (/predict)')
    }
  })
);

// =============================================================================
// 5. Main Backend Express API Proxy (/api)
// =============================================================================
// Routes all remaining /api/* endpoints to LifeLink Express Backend on port 5001.
// Note: In http-proxy-middleware v3, when mounted with app.use('/api', ...),
// the mount path ('/api') is stripped by Express before passing to middleware,
// resulting in req.url becoming '/auth/register' instead of '/api/auth/register'.
// We explicitly use a filter or pathRewrite so the backend receives the full '/api' path.
app.use(
  '/api',
  createProxyMiddleware({
    target: BACKEND_TARGET,
    changeOrigin: true,
    pathRewrite: (path) => `/api${path}`,
    onError: createErrorHandler('Backend API (/api)'),
    on: {
      error: createErrorHandler('Backend API (/api)')
    }
  })
);

// =============================================================================
// 6. Vite Frontend SPA Fallback Proxy (/)
// =============================================================================
// Mounted last as catch-all. Includes WebSocket support (ws: true) for HMR.
const viteProxy = createProxyMiddleware({
  target: VITE_TARGET,
  changeOrigin: true,
  ws: true, // Enables Vite Hot Module Replacement (HMR) WebSocket
  onError: createErrorHandler('Vite Frontend (/)'),
  on: {
    error: createErrorHandler('Vite Frontend (/)')
  }
});

app.use('/', viteProxy);

// =============================================================================
// 7. Start HTTP Server & Attach WebSocket Upgrade for Vite HMR
// =============================================================================
const server = app.listen(PORT, () => {
  console.log(`==================================================================`);
  console.log(`  LifeLink Unified Gateway Server running on port ${PORT}`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`------------------------------------------------------------------`);
  console.log(`  - [Frontend]  /        -> ${VITE_TARGET} (with HMR WebSockets)`);
  console.log(`  - [Backend]   /api     -> ${BACKEND_TARGET}`);
  console.log(`  - [AI/ML]     /predict -> ${ML_TARGET}`);
  console.log(`  - [Chatbot]   /chat    -> ${CHATBOT_TARGET}`);
  console.log(`==================================================================`);
});

// Explicitly delegate WebSocket upgrades to Vite Proxy for instant HMR
server.on('upgrade', (req, socket, head) => {
  if (viteProxy.upgrade) {
    viteProxy.upgrade(req, socket, head);
  }
});
