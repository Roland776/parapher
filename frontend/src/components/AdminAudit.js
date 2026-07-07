import React, { useState, useEffect, useCallback } from "react";
import API, { getData } from "../api";

const ACTION_LABELS = {
  UPLOAD:   { label: "Upload",          icon: "⬆️", color: "#2563eb", bg: "#eff6ff" },
  VIEW:     { label: "Consultation",    icon: "👁️", color: "#059669", bg: "#f0fdf4" },
  DOWNLOAD: { label: "Téléchargement",  icon: "📥", color: "#7c3aed", bg: "#f5f3ff" },
  SIGN:     { label: "Signature",       icon: "✍️", color: "#d97706", bg: "#fffbeb" },
  DELETE:   { label: "Suppression",     icon: "🗑️", color: "#dc2626", bg: "#fef2f2" },
};

const AdminAudit = () => {
  const [logs, setLogs]           = useState([]);
  const [members, setMembers]     = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [actionMsg, setActionMsg] = useState({ text: "", error: false });

  // Filtres
  const [filterUser,   setFilterUser]   = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterDoc,    setFilterDoc]    = useState("");
  const [filterDate,   setFilterDate]   = useState("");
  const [search,       setSearch]       = useState("");

  // Sélection
  const [checkedLogs, setCheckedLogs] = useState([]);

  // Modales
  const [confirmClear,  setConfirmClear]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // 'bulk' | log id

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filterUser)   params.user_id = filterUser;
      if (filterAction) params.action  = filterAction;
      const res = await API.get("audit/", { params });
      setLogs(getData(res));
      setCheckedLogs([]);
      setPage(1);
    } catch (e) {
      setError("Erreur lors du chargement des journaux.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterUser, filterAction]);

  const fetchMeta = useCallback(async () => {
    try {
      const [mRes, dRes] = await Promise.all([API.get("members/"), API.get("documents/")]);
      setMembers(getData(mRes));
      setDocuments(getData(dRes));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!actionMsg.text || actionMsg.text.includes("✅")) return;
    const t = setTimeout(() => setActionMsg({ text: "", error: false }), 5000);
    return () => clearTimeout(t);
  }, [actionMsg]);

  // Maps
  const docMap = documents.reduce((acc, d) => { acc[d.id] = d.title; return acc; }, {});

  // Filtrage client
  const filtered = logs.filter((log) => {
    if (filterDate && log.timestamp.substring(0, 10) !== filterDate) return false;
    if (filterDoc  && log.target_id !== filterDoc) return false;
    if (search) {
      const q = search.toLowerCase();
      const u = `${log.user_username || ""} ${log.user_email || ""}`.toLowerCase();
      const d = (docMap[log.target_id] || "").toLowerCase();
      const a = (ACTION_LABELS[log.action]?.label || log.action).toLowerCase();
      if (!u.includes(q) && !d.includes(q) && !a.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const stats = Object.keys(ACTION_LABELS).reduce((acc, key) => {
    acc[key] = logs.filter((l) => l.action === key).length;
    return acc;
  }, {});

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
      + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const resetFilters = () => {
    setFilterUser(""); setFilterAction(""); setFilterDoc("");
    setFilterDate(""); setSearch(""); setPage(1);
  };

  // Sélection
  const toggleLog = (id) =>
    setCheckedLogs((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAllPage = () => {
    const pageIds = paginated.map((l) => l.id);
    const allChecked = pageIds.every((id) => checkedLogs.includes(id));
    if (allChecked) setCheckedLogs((p) => p.filter((id) => !pageIds.includes(id)));
    else setCheckedLogs((p) => [...new Set([...p, ...pageIds])]);
  };
  const pageIds    = paginated.map((l) => l.id);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => checkedLogs.includes(id));

  // Suppression
  const handleBulkDelete = async () => {
    try {
      await API.delete("audit/bulk-delete/", { data: { ids: checkedLogs } });
      const n = checkedLogs.length;
      setActionMsg({ text: `✅ ${n} entrée${n > 1 ? "s" : ""} supprimée${n > 1 ? "s" : ""}.`, error: false });
      setCheckedLogs([]);
      fetchLogs();
    } catch (e) {
      setActionMsg({ text: "Erreur lors de la suppression.", error: true });
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleDeleteOne = async (id) => {
    try {
      await API.delete(`audit/${id}/`);
      setActionMsg({ text: "✅ Entrée supprimée.", error: false });
      fetchLogs();
    } catch (e) {
      setActionMsg({ text: "Erreur lors de la suppression.", error: true });
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleClearAll = async () => {
    try {
      await API.delete("audit/clear-all/");
      setActionMsg({ text: "✅ Historique entièrement effacé.", error: false });
      fetchLogs();
    } catch (e) {
      setActionMsg({ text: "Erreur lors de l'effacement.", error: true });
    } finally {
      setConfirmClear(false);
    }
  };

  const msgStyle = (err) => ({
    padding: "10px 14px", borderRadius: "6px", marginBottom: "12px", fontWeight: "500",
    backgroundColor: err ? "#fee2e2" : "#dcfce7",
    color: err ? "#b91c1c" : "#166534",
    border: `1px solid ${err ? "#fecaca" : "#bbf7d0"}`,
  });

  return (
    <div className="container">
      <h1>Journal d'Audit</h1>
      <p style={{ color: "#6b7280" }}>Traçabilité complète des actions sur les documents.</p>
      <hr />

      {/* Modale suppression sélection */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "32px", maxWidth: "420px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: "12px" }}>⚠️</div>
            <h3 style={{ textAlign: "center", color: "#b91c1c", marginBottom: "8px" }}>Confirmer la suppression</h3>
            <p style={{ textAlign: "center", color: "#374151", marginBottom: "24px" }}>
              {confirmDelete === "bulk"
                ? `Supprimer les ${checkedLogs.length} entrées sélectionnées ?`
                : "Supprimer cette entrée du journal ?"}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary" style={{ minWidth: "120px" }}>Annuler</button>
              <button
                onClick={() => confirmDelete === "bulk" ? handleBulkDelete() : handleDeleteOne(confirmDelete)}
                className="btn btn-danger" style={{ minWidth: "120px" }}
              >
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale effacement total */}
      {confirmClear && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "32px", maxWidth: "460px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: "12px" }}>🗑️</div>
            <h3 style={{ textAlign: "center", color: "#b91c1c", marginBottom: "8px" }}>Effacer tout l'historique</h3>
            <p style={{ textAlign: "center", color: "#374151", marginBottom: "24px" }}>
              Cette action supprimera <strong>toutes</strong> les entrées du journal d'audit de façon irréversible.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={() => setConfirmClear(false)} className="btn btn-secondary" style={{ minWidth: "120px" }}>Annuler</button>
              <button onClick={handleClearAll} className="btn btn-danger" style={{ minWidth: "120px" }}>🗑️ Tout effacer</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
        {Object.entries(ACTION_LABELS).map(([key, meta]) => (
          <div key={key} style={{ flex: "1 1 130px", padding: "14px 16px", borderRadius: "10px", backgroundColor: meta.bg, border: `1px solid ${meta.color}22` }}>
            <div style={{ fontSize: "1.5rem" }}>{meta.icon}</div>
            <div style={{ fontSize: "1.6rem", fontWeight: "800", color: meta.color }}>{stats[key] || 0}</div>
            <div style={{ fontSize: "0.78rem", color: "#6b7280", fontWeight: "500" }}>{meta.label}</div>
          </div>
        ))}
        <div style={{ flex: "1 1 130px", padding: "14px 16px", borderRadius: "10px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "1.5rem" }}>📋</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#374151" }}>{logs.length}</div>
          <div style={{ fontSize: "0.78rem", color: "#6b7280", fontWeight: "500" }}>Total</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="card" style={{ marginBottom: "24px", padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 170px" }}>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#6b7280", marginBottom: "4px" }}>Utilisateur</label>
            <select className="form-control" value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}>
              <option value="">Tous</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.username}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#6b7280", marginBottom: "4px" }}>Action</label>
            <select className="form-control" value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}>
              <option value="">Toutes</option>
              {Object.entries(ACTION_LABELS).map(([key, meta]) => (
                <option key={key} value={key}>{meta.icon} {meta.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 170px" }}>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#6b7280", marginBottom: "4px" }}>Document</label>
            <select className="form-control" value={filterDoc} onChange={(e) => { setFilterDoc(e.target.value); setPage(1); }}>
              <option value="">Tous</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#6b7280", marginBottom: "4px" }}>Date</label>
            <input type="date" className="form-control" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setPage(1); }} />
          </div>
          <div style={{ flex: "2 1 180px" }}>
            <label style={{ display: "block", fontSize: "0.82rem", color: "#6b7280", marginBottom: "4px" }}>Recherche</label>
            <input type="text" className="form-control" placeholder="Nom, e-mail, document..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button onClick={resetFilters} className="btn btn-secondary" style={{ padding: "8px 12px", fontSize: "0.85rem" }}>✕ Réinitialiser</button>
          <button onClick={fetchLogs} className="btn btn-primary" style={{ padding: "8px 12px", fontSize: "0.85rem" }}>🔄 Actualiser</button>
          <button onClick={() => setConfirmClear(true)} className="btn btn-danger" style={{ padding: "8px 12px", fontSize: "0.85rem" }}>🗑️ Tout effacer</button>
        </div>
      </div>

      {actionMsg.text && <p style={msgStyle(actionMsg.error)}>{actionMsg.text}</p>}
      {error && <div style={msgStyle(true)}>🚫 {error}</div>}

      {/* Barre sélection */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", minHeight: "36px" }}>
        <span style={{ fontSize: "0.88rem", color: "#6b7280" }}>
          {loading ? "Chargement..." : `${filtered.length} événement${filtered.length > 1 ? "s" : ""}${filtered.length !== logs.length ? ` (sur ${logs.length})` : ""}`}
        </span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {checkedLogs.length > 0 && (
            <>
              <span style={{ fontWeight: "bold", fontSize: "0.88rem", color: "#374151" }}>
                {checkedLogs.length} sélectionnée{checkedLogs.length > 1 ? "s" : ""}
              </span>
              <button onClick={() => setConfirmDelete("bulk")} className="btn btn-danger" style={{ padding: "4px 12px", fontSize: "0.82rem" }}>
                🗑️ Supprimer la sélection
              </button>
              <button onClick={() => setCheckedLogs([])} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "0.82rem" }}>✕</button>
            </>
          )}
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "0.82rem" }} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>◀</button>
              <span style={{ fontSize: "0.85rem", color: "#374151" }}>Page {page} / {totalPages}</span>
              <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "0.82rem" }} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>▶</button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: "40px" }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAllPage} title="Sélectionner cette page" />
            </th>
            <th style={{ width: "150px" }}>Date / Heure</th>
            <th>Utilisateur</th>
            <th style={{ width: "150px", textAlign: "center" }}>Action</th>
            <th>Document concerné</th>
            <th style={{ width: "80px", textAlign: "center" }}>Suppr.</th>
          </tr>
        </thead>
        <tbody>
          {!loading && paginated.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: "center", color: "#6b7280", padding: "32px" }}>
                Aucun événement trouvé pour ces critères.
              </td>
            </tr>
          )}
          {paginated.map((log) => {
            const meta    = ACTION_LABELS[log.action] || { label: log.action, icon: "•", color: "#6b7280", bg: "#f9fafb" };
            const docName = docMap[log.target_id] || (log.target_id ? log.target_id.substring(0, 8) + "…" : "—");
            const isChecked = checkedLogs.includes(log.id);
            return (
              <tr key={log.id} style={{ backgroundColor: isChecked ? "#fef3c7" : "" }}>
                <td>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleLog(log.id)} />
                </td>
                <td style={{ fontSize: "0.82rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                  {formatDate(log.timestamp)}
                </td>
                <td>
                  <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{log.user_username || "—"}</div>
                  <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>{log.user_email || ""}</div>
                </td>
                <td style={{ textAlign: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", backgroundColor: meta.bg, color: meta.color, fontWeight: "600", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                    {meta.icon} {meta.label}
                  </span>
                </td>
                <td style={{ color: "#374151", fontSize: "0.9rem" }}>{docName}</td>
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => setConfirmDelete(log.id)} className="btn btn-danger" style={{ fontSize: "0.78rem", padding: "3px 8px" }}>🗑️</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination bas */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "16px" }}>
          <button className="btn btn-secondary" style={{ padding: "5px 12px" }} onClick={() => setPage(1)} disabled={page <= 1}>«</button>
          <button className="btn btn-secondary" style={{ padding: "5px 12px" }} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>◀</button>
          <span style={{ padding: "6px 14px", backgroundColor: "#eff6ff", borderRadius: "6px", color: "#1d4ed8", fontWeight: "600", fontSize: "0.88rem" }}>
            {page} / {totalPages}
          </span>
          <button className="btn btn-secondary" style={{ padding: "5px 12px" }} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>▶</button>
          <button className="btn btn-secondary" style={{ padding: "5px 12px" }} onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</button>
        </div>
      )}
    </div>
  );
};

export default AdminAudit;