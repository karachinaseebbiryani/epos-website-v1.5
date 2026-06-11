/**
 * CRA setupProxy.js — proxies /api/* to the local backend.
 * Active ONLY when REACT_APP_BACKEND_URL is empty (i.e., on the local
 * Windows install). On Emergent preview the env var is the full preview
 * URL, so frontend bypasses this proxy entirely (calls absolute URL).
 */
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  // Only set up the proxy when running locally (no REACT_APP_BACKEND_URL set).
  // This keeps Emergent preview untouched (it uses absolute backend URL).
  const backend = process.env.REACT_APP_BACKEND_URL;
  if (backend && backend.trim().length > 0) return;

  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:8001",
      changeOrigin: true,
      ws: false,
      logLevel: "warn",
    })
  );
};
