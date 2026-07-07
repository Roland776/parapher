import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar" style={{ position: "sticky", top: 0, zIndex: 1000 }}>
      <div className="navbar-brand">🛡️ Parapheur Numérique</div>

      {/* Bouton hamburger — visible uniquement sur mobile */}
      <button
        className="navbar-hamburger"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Menu"
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      {/* Liens — cachés sur mobile sauf si menu ouvert */}
      <div className={`navbar-links ${menuOpen ? "navbar-links--open" : ""}`}>
        {user.role === "ADMIN" ? (
          <>
            <Link to="/admin/upload" className="navbar-link" onClick={() => setMenuOpen(false)}>
              Gestion Documents
            </Link>
            <Link to="/admin/users" className="navbar-link" onClick={() => setMenuOpen(false)}>
              Utilisateurs
            </Link>
            <Link to="/admin/audit" className="navbar-link" onClick={() => setMenuOpen(false)}>
              Registre d'Audit
            </Link>
          </>
        ) : (
          <Link to="/publications" className="navbar-link" onClick={() => setMenuOpen(false)}>
            Mes Paraphes
          </Link>
        )}
        <span style={{ fontSize: "0.9rem", color: "#93c5fd" }}>
          ({user.username} - <strong>{user.role}</strong>)
        </span>
        <button
          onClick={handleLogout}
          className="btn btn-danger"
          style={{ padding: "4px 10px", fontSize: "0.85rem" }}
        >
          Déconnexion
        </button>
      </div>
    </nav>
  );
};

export default Navbar;