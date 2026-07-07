const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    createProxyMiddleware({
      // Intercepte TOUTES les requêtes commençant par /api
      pathFilter: "/api",
      target: "http://127.0.0.1:8000",
      changeOrigin: true,
      secure: false,
      // Pas de pathRewrite : /api/auth/login/ reste /api/auth/login/ côté Django
    }),
  );
};
