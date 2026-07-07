import axios from "axios";

// En développement : REACT_APP_API_URL=/api/  (proxy setupProxy.js redirige vers localhost:8000)
// En production    : REACT_APP_API_URL=https://votre-domaine.com/api/
const BASE_URL = process.env.REACT_APP_API_URL || "/api/";

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur requête : injecte automatiquement le token JWT
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Flag pour éviter plusieurs refreshes simultanés
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Intercepteur réponse : gère le token expiré (401)
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Ne pas retenter sur : refresh endpoint, arraybuffer (PDF), déjà retentée
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("auth/refresh") &&
      !original.url?.includes("auth/login") &&
      original.responseType !== "arraybuffer" &&
      original.responseType !== "blob"
    ) {
      if (isRefreshing) {
        // Mettre en file d'attente si un refresh est déjà en cours
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return API(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refresh = localStorage.getItem("refresh_token");
        if (!refresh) throw new Error("Pas de refresh token");

        // Appel direct sans intercepteur pour éviter la boucle infinie
        const res = await axios.post(`${BASE_URL}auth/refresh/`, { refresh });

        const newAccess = res.data.access;
        localStorage.setItem("access_token", newAccess);

        if (res.data.refresh) {
          localStorage.setItem("refresh_token", res.data.refresh);
        }

        processQueue(null, newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return API(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh échoué → déconnexion propre sans appel API
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default API;

/**
 * Extrait le tableau de données d'une réponse paginée ou directe.
 * Usage : const docs = getData(await API.get("documents/"));
 */
export const getData = (response) => {
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
};
