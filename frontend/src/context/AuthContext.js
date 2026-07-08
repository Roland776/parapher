import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import API from "../api";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  // Ref pour éviter un double-appel logout pendant le montage
  const loggingOut = useRef(false);

  const decodeToken = (token) => {
    try {
      const base64Url = token.split(".")[1];
      const base64    = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(window.atob(base64));
    } catch {
      return null;
    }
  };

  // logout : blackliste le refresh token PUIS vide le localStorage
  // Ne fait PAS l'appel API si les tokens sont déjà absents (évite les boucles)
  const logout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;

    const refresh = localStorage.getItem("refresh_token");

    // Nettoyer localStorage en premier — même si l'appel API échoue,
    // l'utilisateur est déconnecté localement
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);

    // Blacklister le refresh token côté serveur (best-effort)
    if (refresh) {
      try {
        await API.post("auth/logout/", { refresh });
      } catch {
        // Ignorer — l'utilisateur est déjà déconnecté localement
      }
    }

    loggingOut.current = false;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      const decoded = decodeToken(token);
      const now = Math.floor(Date.now() / 1000);

      if (!decoded || (decoded.exp && decoded.exp < now)) {
        // Token absent ou expiré : nettoyer localement sans appel API
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
      } else {
        setUser({
          username: decoded.username,
          email:    decoded.email,
          role:     decoded.role,
        });
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await API.post("auth/login/", { username, password });
    const { access, refresh } = response.data;

    if (!access || !refresh) {
      throw new Error(
        "Réponse du serveur invalide (pas de token reçu). " +
        "Vérifiez que REACT_APP_API_URL pointe bien vers le backend Django."
      );
    }

    localStorage.setItem("access_token",  access);
    localStorage.setItem("refresh_token", refresh);

    const decoded = decodeToken(access);
    if (!decoded) {
      throw new Error("Le token reçu n'a pas pu être décodé (format JWT invalide).");
    }

    const loggedUser = {
      username: decoded.username,
      email:    decoded.email,
      role:     decoded.role,
    };

    setUser(loggedUser);
    return loggedUser;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
