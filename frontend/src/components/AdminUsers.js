import React, { useState, useEffect, useCallback } from "react";
import API, { getData } from "../api";

const EMPTY_FORM = {
  username: "",
  email: "",
  password: "",
  role: "MEMBER",
  is_active: true,
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("");
  const [search, setSearch] = useState("");

  // Formulaire création / édition
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formMsg, setFormMsg] = useState({ text: "", error: false });
  const [showForm, setShowForm] = useState(false);

  // Modale suppression
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionMsg, setActionMsg] = useState({ text: "", error: false });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterRole ? { role: filterRole } : {};
      const res = await API.get("users/", { params });
      setUsers(getData(res));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Auto-clear messages
  useEffect(() => {
    if (!formMsg.text || formMsg.text.includes("✅")) return;
    const t = setTimeout(() => setFormMsg({ text: "", error: false }), 5000);
    return () => clearTimeout(t);
  }, [formMsg]);
  useEffect(() => {
    if (!actionMsg.text || actionMsg.text.includes("✅")) return;
    const t = setTimeout(() => setActionMsg({ text: "", error: false }), 5000);
    return () => clearTimeout(t);
  }, [actionMsg]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormMsg({ text: "", error: false });
    setShowForm(true);
  };

  const openEdit = (user) => {
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
      is_active: user.is_active,
    });
    setEditingId(user.id);
    setFormMsg({ text: "", error: false });
    setShowForm(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormMsg({ text: "", error: false });
    const payload = { ...form };
    if (editingId && !payload.password) delete payload.password;

    try {
      if (editingId) {
        await API.patch(`users/${editingId}/`, payload);
        setFormMsg({ text: "✅ Utilisateur mis à jour.", error: false });
      } else {
        await API.post("users/", payload);
        setFormMsg({ text: "✅ Utilisateur créé avec succès.", error: false });
        setForm(EMPTY_FORM);
      }
      fetchUsers();
    } catch (err) {
      console.error("Erreur création/édition user:", err.response?.data);
      const d = err.response?.data;
      let msg = "Erreur lors de la sauvegarde.";
      if (d) {
        if (typeof d === "string") {
          msg = d;
        } else if (typeof d === "object") {
          msg = Object.entries(d)
            .map(([k, v]) => {
              const label =
                k === "username"
                  ? "Nom d'utilisateur"
                  : k === "email"
                    ? "E-mail"
                    : k === "password"
                      ? "Mot de passe"
                      : k === "detail"
                        ? ""
                        : k;
              const val = Array.isArray(v) ? v.join(", ") : String(v);
              return label ? `${label} : ${val}` : val;
            })
            .filter(Boolean)
            .join(" | ");
        }
      }
      setFormMsg({ text: msg, error: true });
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`users/${id}/`);
      setActionMsg({ text: "✅ Utilisateur supprimé.", error: false });
      fetchUsers();
    } catch (err) {
      setActionMsg({
        text: err.response?.data?.detail || "Erreur lors de la suppression.",
        error: true,
      });
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const res = await API.post(`users/${user.id}/toggle-active/`);
      setActionMsg({ text: `✅ ${res.data.detail}`, error: false });
      fetchUsers();
    } catch (err) {
      setActionMsg({
        text: err.response?.data?.detail || "Erreur.",
        error: true,
      });
    }
  };

  const msgStyle = (error) => ({
    padding: "10px 14px",
    borderRadius: "6px",
    marginBottom: "12px",
    fontWeight: "500",
    backgroundColor: error ? "#fee2e2" : "#dcfce7",
    color: error ? "#b91c1c" : "#166534",
    border: `1px solid ${error ? "#fecaca" : "#bbf7d0"}`,
  });

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  const admins = filtered.filter((u) => u.role === "ADMIN");
  const members = filtered.filter((u) => u.role === "MEMBER");

  return (
    <div className="container">
      <h1>Gestion des Utilisateurs</h1>
      <p style={{ color: "#6b7280" }}>
        Créez, modifiez ou supprimez les comptes administrateurs et membres.
      </p>
      <hr />

      {/* Modale suppression */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                fontSize: "2.5rem",
                textAlign: "center",
                marginBottom: "12px",
              }}
            >
              ⚠️
            </div>
            <h3
              style={{
                textAlign: "center",
                marginBottom: "8px",
                color: "#b91c1c",
              }}
            >
              Confirmer la suppression
            </h3>
            <p
              style={{
                textAlign: "center",
                color: "#374151",
                marginBottom: "24px",
              }}
            >
              Supprimer le compte de <strong>{confirmDelete.username}</strong> ?
              Cette action est irréversible.
            </p>
            <div
              style={{ display: "flex", gap: "12px", justifyContent: "center" }}
            >
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn btn-secondary"
                style={{ minWidth: "120px" }}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="btn btn-danger"
                style={{ minWidth: "120px" }}
              >
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistiques */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            flex: "1 1 160px",
            padding: "16px",
            borderRadius: "10px",
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: "2rem", fontWeight: "800", color: "#1d4ed8" }}
          >
            {users.filter((u) => u.role === "ADMIN").length}
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
            Administrateurs
          </div>
        </div>
        <div
          style={{
            flex: "1 1 160px",
            padding: "16px",
            borderRadius: "10px",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: "2rem", fontWeight: "800", color: "#166534" }}
          >
            {users.filter((u) => u.role === "MEMBER").length}
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>Membres</div>
        </div>
        <div
          style={{
            flex: "1 1 160px",
            padding: "16px",
            borderRadius: "10px",
            backgroundColor: "#fef9f0",
            border: "1px solid #fde68a",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: "2rem", fontWeight: "800", color: "#92400e" }}
          >
            {users.filter((u) => !u.is_active).length}
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
            Comptes désactivés
          </div>
        </div>
        <div
          style={{
            flex: "1 1 160px",
            padding: "16px",
            borderRadius: "10px",
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: "2rem", fontWeight: "800", color: "#374151" }}
          >
            {users.length}
          </div>
          <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
            Total utilisateurs
          </div>
        </div>
      </div>

      {/* Barre d'outils */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="🔍 Rechercher un utilisateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 200px", maxWidth: "300px" }}
        />
        <select
          className="form-control"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{ flex: "0 0 180px" }}
        >
          <option value="">Tous les rôles</option>
          <option value="ADMIN">Administrateurs</option>
          <option value="MEMBER">Membres</option>
        </select>
        <button
          onClick={fetchUsers}
          className="btn btn-secondary"
          style={{ padding: "8px 14px" }}
        >
          🔄 Actualiser
        </button>
        <button
          onClick={openCreate}
          className="btn btn-success"
          style={{ padding: "8px 16px", fontWeight: "600", marginLeft: "auto" }}
        >
          ➕ Nouvel utilisateur
        </button>
      </div>

      {actionMsg.text && (
        <p style={msgStyle(actionMsg.error)}>{actionMsg.text}</p>
      )}

      {/* Formulaire création / édition */}
      {showForm && (
        <div
          className="card"
          style={{ marginBottom: "24px", border: "2px solid #3b82f6" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3 style={{ margin: 0 }}>
              {editingId
                ? "✏️ Modifier l'utilisateur"
                : "➕ Créer un utilisateur"}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.3rem",
                cursor: "pointer",
                color: "#6b7280",
              }}
            >
              ✕
            </button>
          </div>

          {formMsg.text && (
            <p style={msgStyle(formMsg.error)}>{formMsg.text}</p>
          )}

          <form onSubmit={handleFormSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
              }}
            >
              <div className="form-group">
                <label>Nom d'utilisateur *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  placeholder="ex: jean.dupont"
                />
              </div>
              <div className="form-group">
                <label>Adresse e-mail *</label>
                <input
                  type="email"
                  className="form-control"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ex: jean.dupont@entreprise.com"
                />
              </div>
              <div className="form-group">
                <label>
                  {editingId ? "Nouveau mot de passe" : "Mot de passe *"}{" "}
                  {editingId && (
                    <span style={{ color: "#6b7280", fontSize: "0.82rem" }}>
                      (laisser vide pour ne pas changer)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="form-control"
                  required={!editingId}
                  minLength={8}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="8 caractères minimum"
                />
              </div>
              <div className="form-group">
                <label>Rôle *</label>
                <select
                  className="form-control"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="MEMBER">Membre</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: "8px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
                Compte actif (peut se connecter)
              </label>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="submit" className="btn btn-primary">
                {editingId
                  ? "💾 Enregistrer les modifications"
                  : "✅ Créer le compte"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tables utilisateurs */}
      {loading && <p style={{ color: "#6b7280" }}>Chargement...</p>}

      {!loading &&
        [
          {
            title: "👤 Administrateurs",
            list: admins,
            color: "#1d4ed8",
            bg: "#eff6ff",
            border: "#bfdbfe",
          },
          {
            title: "👥 Membres",
            list: members,
            color: "#166534",
            bg: "#f0fdf4",
            border: "#bbf7d0",
          },
        ].map(
          ({ title, list, color, bg, border }) =>
            (filterRole === "" ||
              (filterRole === "ADMIN" && title.includes("Admin")) ||
              (filterRole === "MEMBER" && title.includes("Membre"))) && (
              <div key={title} style={{ marginBottom: "28px" }}>
                <div
                  style={{
                    padding: "8px 14px",
                    backgroundColor: bg,
                    border: `1px solid ${border}`,
                    borderRadius: "8px 8px 0 0",
                    fontWeight: "700",
                    fontSize: "0.9rem",
                    color,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {title}
                  <span
                    style={{
                      marginLeft: "auto",
                      backgroundColor: border,
                      color,
                      borderRadius: "12px",
                      padding: "1px 10px",
                      fontSize: "0.78rem",
                    }}
                  >
                    {list.length} compte{list.length > 1 ? "s" : ""}
                  </span>
                </div>
                <table
                  className="table"
                  style={{
                    margin: 0,
                    border: `1px solid ${border}`,
                    borderTop: "none",
                    borderRadius: "0 0 8px 8px",
                    overflow: "hidden",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: bg }}>
                      <th>Utilisateur</th>
                      <th>E-mail</th>
                      <th style={{ textAlign: "center" }}>Statut</th>
                      <th style={{ textAlign: "center" }}>Membre depuis</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 && (
                      <tr>
                        <td
                          colSpan="5"
                          style={{
                            textAlign: "center",
                            color: "#6b7280",
                            padding: "20px",
                          }}
                        >
                          Aucun compte dans cette catégorie.
                        </td>
                      </tr>
                    )}
                    {list.map((u) => (
                      <tr
                        key={u.id}
                        style={{
                          backgroundColor: !u.is_active ? "#fafafa" : "",
                          opacity: u.is_active ? 1 : 0.65,
                        }}
                      >
                        <td style={{ fontWeight: "600" }}>
                          {u.username}
                          {!u.is_active && (
                            <span
                              style={{
                                marginLeft: "8px",
                                fontSize: "0.75rem",
                                color: "#ef4444",
                                fontWeight: "500",
                              }}
                            >
                              désactivé
                            </span>
                          )}
                        </td>
                        <td style={{ color: "#6b7280" }}>{u.email}</td>
                        <td style={{ textAlign: "center" }}>
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: "20px",
                              fontSize: "0.78rem",
                              fontWeight: "600",
                              backgroundColor: u.is_active
                                ? "#dcfce7"
                                : "#fee2e2",
                              color: u.is_active ? "#166534" : "#b91c1c",
                            }}
                          >
                            {u.is_active ? "✅ Actif" : "🔴 Inactif"}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: "center",
                            fontSize: "0.85rem",
                            color: "#6b7280",
                          }}
                        >
                          {new Date(u.date_joined).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              onClick={() => openEdit(u)}
                              className="btn btn-secondary"
                              style={{
                                fontSize: "0.8rem",
                                padding: "4px 10px",
                              }}
                            >
                              ✏️ Modifier
                            </button>
                            <button
                              onClick={() => handleToggleActive(u)}
                              className="btn btn-secondary"
                              style={{
                                fontSize: "0.8rem",
                                padding: "4px 10px",
                                color: u.is_active ? "#d97706" : "#059669",
                              }}
                            >
                              {u.is_active ? "🔴 Désactiver" : "✅ Activer"}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(u)}
                              className="btn btn-danger"
                              style={{
                                fontSize: "0.8rem",
                                padding: "4px 10px",
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
        )}
    </div>
  );
};

export default AdminUsers;
