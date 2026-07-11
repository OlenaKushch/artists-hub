// Vercel serverless function - catch-all для всіх API маршрутів
import app from '../server.js';

export default (req, res) => {
  // Відновлюємо правильний URL для Express
  // Vercel передає path в req.url без префіксу /api
  const path = req.url || '';
  const apiPath = path.startsWith('/api') ? path : '/api' + (path.startsWith('/') ? path : '/' + path);
  
  // Зберігаємо оригінальний URL
  const originalUrl = req.url;
  const originalBaseUrl = req.baseUrl;
  
  // Встановлюємо правильний URL для Express
  req.url = apiPath;
  req.baseUrl = '/api';
  req.originalUrl = apiPath;
  
  // Express app обробляє всі маршрути
  return app(req, res);
};

