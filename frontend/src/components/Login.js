import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(username, password);
      if (user.role === "ADMIN") navigate("/admin/upload");
      else navigate("/publications");
    } catch (err) {
      // axios encapsule l'erreur dans err.response.data
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        err.message ||
        "Identifiants incorrects.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: "420px", padding: "2.5rem" }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          Connexion
        </h2>

        {error && (
          <div
            className="card"
            style={{
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              padding: "10px",
              marginBottom: "15px",
              border: "none",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Identifiant utilisateur</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={loading}
          >
            {loading ? "Connexion en cours…" : "Accéder au Parapheur"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
