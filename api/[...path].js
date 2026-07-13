// Vercel serverless function - catch-all for API routes
import app from "../server.js";

export default (req, res) => {
  const path = req.url || "";
  const apiPath = path.startsWith("/api")
    ? path
    : "/api" + (path.startsWith("/") ? path : "/" + path);

  req.url = apiPath;
  req.baseUrl = "/api";
  req.originalUrl = apiPath;

  return app(req, res);
};
