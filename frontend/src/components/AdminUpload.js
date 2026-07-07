import React, { useState, useEffect, useCallback } from "react";
import API, { getData } from "../api";

const AdminUpload = () => {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [members, setMembers] = useState([]);
  const [publications, setPublications] = useState([]);
  const [pubLoading, setPubLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState({ text: "", error: false });

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pubDoc, setPubDoc] = useState(null);

  const [checkedDocs, setCheckedDocs] = useState([]);
  const [checkedPubs, setCheckedPubs] = useState([]);
  const [checkedMembers, setCheckedMembers] = useState([]);

  const [canView, setCanView] = useState(false);
  const [canDownload, setCanDownload] = useState(false);
  const [permMsg, setPermMsg] = useState({ text: "", error: false });

  const [downloadAllowed, setDownloadAllowed] = useState(false);
  const [printAllowed, setPrintAllowed] = useState(false);
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [pubMsg, setPubMsg] = useState({ text: "", error: false });

  const [multiMsg, setMultiMsg] = useState({ text: "", error: false });

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmMultiDelete, setConfirmMultiDelete] = useState(null);

  useEffect(() => {
    if (!uploadMsg.text || uploadMsg.text.includes("✅")) return;
    const t = setTimeout(() => setUploadMsg({ text: "", error: false }), 5000);
    return () => clearTimeout(t);
  }, [uploadMsg]);
  useEffect(() => {
    if (!permMsg.text || permMsg.text.includes("✅")) return;
    const t = setTimeout(() => setPermMsg({ text: "", error: false }), 5000);
    return () => clearTimeout(t);
  }, [permMsg]);
  useEffect(() => {
    if (!pubMsg.text || pubMsg.text.includes("✅")) return;
    const t = setTimeout(() => setPubMsg({ text: "", error: false }), 5000);
    return () => clearTimeout(t);
  }, [pubMsg]);
  useEffect(() => {
    if (!multiMsg.text || multiMsg.text.includes("✅")) return;
    const t = setTimeout(() => setMultiMsg({ text: "", error: false }), 5000);
    return () => clearTimeout(t);
  }, [multiMsg]);

  const fetchAll = useCallback(async () => {
    try {
      const [d, c, m] = await Promise.all([
        API.get("documents/"),
        API.get("categories/"),
        API.get("members/"),
      ]);
      setDocuments(getData(d));
      setCategories(getData(c));
      setMembers(getData(m));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchPublications = useCallback(async () => {
    setPubLoading(true);
    try {
      const res = await API.get("publications/");
      setPublications(
        getData(res).sort((a, b) => b.publish_date.localeCompare(a.publish_date)),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setPubLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchPublications();
  }, [fetchAll, fetchPublications]);

  const toggleDoc = (id) =>
    setCheckedDocs((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  const toggleAllDocs = () =>
    setCheckedDocs(
      checkedDocs.length === documents.length ? [] : documents.map((d) => d.id),
    );
  const togglePub = (id) =>
    setCheckedPubs((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  const toggleMember = (id) =>
    setCheckedMembers((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  const toggleAllMembers = () =>
    setCheckedMembers(
      checkedMembers.length === members.length ? [] : members.map((m) => m.id),
    );

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", title);
    fd.append("category", categoryId);
    fd.append("storage_path", file);
    try {
      await API.post("documents/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadMsg({ text: "✅ Document uploadé avec succès !", error: false });
      setTitle("");
      setCategoryId("");
      setFile(null);
      fetchAll();
    } catch (err) {
      const d = err.response?.data;
      setUploadMsg({
        text:
          typeof d === "object"
            ? JSON.stringify(d)
            : "Erreur lors de l'upload.",
        error: true,
      });
    }
  };

  const doDeleteDoc = async (id) => {
    try {
      await API.delete(`documents/${id}/`);
      setUploadMsg({ text: "✅ Document supprimé.", error: false });
      if (selectedDoc?.id === id) setSelectedDoc(null);
      if (pubDoc?.id === id) setPubDoc(null);
      setCheckedDocs((p) => p.filter((x) => x !== id));
      fetchAll();
      fetchPublications();
    } catch (err) {
      const serverMsg =
        err.response?.data?.[0] || err.response?.data?.detail || null;

      setUploadMsg({
        text:
          err.response?.status === 403
            ? "Suppression refusée."
            : serverMsg || "Erreur de suppression.",
        error: true,
      });
    } finally {
      setConfirmDelete(null);
    }
  };

  const doDeletePub = async (id) => {
    try {
      await API.delete(`publications/${id}/`);
      setPubMsg({ text: "✅ Publication supprimée.", error: false });
      setCheckedPubs((p) => p.filter((x) => x !== id));
      fetchPublications();
    } catch (err) {
      setPubMsg({
        text:
          err.response?.status === 403
            ? "Suppression refusée."
            : "Erreur de suppression.",
        error: true,
      });
    } finally {
      setConfirmDelete(null);
    }
  };

  const doMultiDeleteDocs = async () => {
    try {
      await Promise.all(
        checkedDocs.map((id) => API.delete(`documents/${id}/`)),
      );
      const n = checkedDocs.length;
      setMultiMsg({
        text: `✅ ${n} document${n > 1 ? "s" : ""} supprimé${n > 1 ? "s" : ""}.`,
        error: false,
      });
      setCheckedDocs([]);
      fetchAll();
      fetchPublications();
    } catch {
      setMultiMsg({ text: "Erreur lors de la suppression.", error: true });
    } finally {
      setConfirmMultiDelete(null);
    }
  };

  const doMultiDeletePubs = async () => {
    try {
      await Promise.all(
        checkedPubs.map((id) => API.delete(`publications/${id}/`)),
      );
      const n = checkedPubs.length;
      setMultiMsg({
        text: `✅ ${n} publication${n > 1 ? "s" : ""} supprimée${n > 1 ? "s" : ""}.`,
        error: false,
      });
      setCheckedPubs([]);
      fetchPublications();
    } catch {
      setMultiMsg({ text: "Erreur lors de la suppression.", error: true });
    } finally {
      setConfirmMultiDelete(null);
    }
  };

  const handlePublicationSubmit = async () => {
    if (!pubDoc) {
      setPubMsg({ text: "Sélectionnez un document à publier.", error: true });
      return;
    }
    try {
      await API.post("publications/", {
        document: pubDoc.id,
        download_allowed: downloadAllowed,
        print_allowed: printAllowed,
        signature_required: signatureRequired,
        admin_note: adminNote,
      });
      setPubMsg({
        text: `✅ "${pubDoc.title}" publié pour aujourd'hui.`,
        error: false,
      });
      setDownloadAllowed(false);
      setPrintAllowed(false);
      setSignatureRequired(false);
      setAdminNote("");
      fetchPublications();
    } catch (err) {
      const d = err.response?.data;
      setPubMsg({
        text:
          typeof d === "object" ? JSON.stringify(d) : "Erreur de publication.",
        error: true,
      });
    }
  };

  const handleMultiPublish = async () => {
    if (checkedDocs.length === 0) return;
    try {
      await Promise.all(
        documents
          .filter((d) => checkedDocs.includes(d.id))
          .map((doc) =>
            API.post("publications/", {
              document: doc.id,
              download_allowed: downloadAllowed,
              print_allowed: printAllowed,
              signature_required: signatureRequired,
              admin_note: adminNote,
            }),
          ),
      );
      const n = checkedDocs.length;
      setPubMsg({
        text: `✅ ${n} document${n > 1 ? "s" : ""} publié${n > 1 ? "s" : ""} pour aujourd'hui.`,
        error: false,
      });
      setCheckedDocs([]);
      setAdminNote("");
      fetchPublications();
    } catch (err) {
      const d = err.response?.data;
      setPubMsg({
        text:
          typeof d === "object" ? JSON.stringify(d) : "Erreur de publication.",
        error: true,
      });
    }
  };

  const handleApplyPermissions = async (e) => {
    e.preventDefault();
    const docIds =
      checkedDocs.length > 0
        ? checkedDocs
        : selectedDoc
          ? [selectedDoc.id]
          : [];
    if (docIds.length === 0) {
      setPermMsg({
        text: "Cochez des documents ou cliquez « Gérer les droits ».",
        error: true,
      });
      return;
    }
    if (checkedMembers.length === 0) {
      setPermMsg({ text: "Cochez au moins un membre.", error: true });
      return;
    }
    if (!canView && !canDownload) {
      setPermMsg({ text: "Cochez au moins un droit.", error: true });
      return;
    }
    const applyOne = (docId, memberId) =>
      API.post("permissions/", {
        document: docId,
        user: memberId,
        can_view: canView,
        can_download: canDownload,
      }).catch((err) => {
        if (
          err.response?.status === 400 &&
          JSON.stringify(err.response?.data).includes("unique")
        ) {
          return API.get("permissions/", {
            params: { user: memberId, document: docId },
          }).then((res) => {
            const list = getData(res);
            return list.length > 0
              ? API.patch(`permissions/${list[0].id}/`, {
                  document: docId,
                  user: memberId,
                  can_view: canView,
                  can_download: canDownload,
                })
              : null;
          });
        }
        throw err;
      });
    try {
      await Promise.all(
        docIds.flatMap((docId) =>
          checkedMembers.map((mId) => applyOne(docId, mId)),
        ),
      );
      const m = checkedMembers.length,
        d = docIds.length;
      setPermMsg({
        text: `✅ Droits attribués à ${m} membre${m > 1 ? "s" : ""} sur ${d} document${d > 1 ? "s" : ""}.`,
        error: false,
      });
      setCheckedMembers([]);
      setCheckedDocs([]);
      setCanView(false);
      setCanDownload(false);
    } catch {
      setPermMsg({
        text: "Erreur lors de l'attribution des droits.",
        error: true,
      });
    }
  };

  const msgStyle = (error) => ({
    padding: "10px 14px",
    borderRadius: "4px",
    marginBottom: "12px",
    backgroundColor: error ? "#fee2e2" : "#dcfce7",
    color: error ? "#b91c1c" : "#166534",
    border: `1px solid ${error ? "#fecaca" : "#bbf7d0"}`,
    fontWeight: "500",
  });

  const groupedPubs = publications.reduce((acc, pub) => {
    const k = pub.publish_date.substring(0, 7);
    if (!acc[k]) acc[k] = [];
    acc[k].push(pub);
    return acc;
  }, {});
  const sortedMonths = Object.keys(groupedPubs).sort((a, b) =>
    b.localeCompare(a),
  );
  const formatMonth = (k) => {
    const [y, m] = k.split("-");
    const s = new Date(y, m - 1).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const rightsTarget =
    checkedDocs.length > 0
      ? `${checkedDocs.length} document${checkedDocs.length > 1 ? "s" : ""} cochés`
      : selectedDoc
        ? selectedDoc.title
        : null;
  const pubTarget =
    checkedDocs.length > 0
      ? `${checkedDocs.length} document${checkedDocs.length > 1 ? "s" : ""} cochés`
      : pubDoc
        ? pubDoc.title
        : null;

  return (
    <div className="container">
      <h1>Administration — Gestion Documentaire</h1>
      <hr />

      {/* Modale suppression unitaire */}
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
              {confirmDelete.type === "doc"
                ? `Supprimer "${confirmDelete.label}" ? Toutes ses publications et permissions seront supprimées.`
                : `Supprimer la publication "${confirmDelete.label}" ?`}
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
                onClick={() =>
                  confirmDelete.type === "doc"
                    ? doDeleteDoc(confirmDelete.id)
                    : doDeletePub(confirmDelete.id)
                }
                className="btn btn-danger"
                style={{ minWidth: "120px" }}
              >
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale suppression multiple */}
      {confirmMultiDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              padding: "32px",
              maxWidth: "480px",
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
              🗑️
            </div>
            <h3
              style={{
                textAlign: "center",
                marginBottom: "8px",
                color: "#b91c1c",
              }}
            >
              {`Supprimer ${confirmMultiDelete.count} ${confirmMultiDelete.type === "docs" ? "document" : "publication"}${confirmMultiDelete.count > 1 ? "s" : ""}`}
            </h3>
            <p
              style={{
                textAlign: "center",
                color: "#374151",
                marginBottom: "24px",
              }}
            >
              {confirmMultiDelete.type === "docs"
                ? "Les documents, leurs publications et permissions associées seront supprimés."
                : "Les publications sélectionnées seront supprimées."}
            </p>
            <div
              style={{ display: "flex", gap: "12px", justifyContent: "center" }}
            >
              <button
                onClick={() => setConfirmMultiDelete(null)}
                className="btn btn-secondary"
                style={{ minWidth: "120px" }}
              >
                Annuler
              </button>
              <button
                onClick={() =>
                  confirmMultiDelete.type === "docs"
                    ? doMultiDeleteDocs()
                    : doMultiDeletePubs()
                }
                className="btn btn-danger"
                style={{ minWidth: "120px" }}
              >
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Grille 2 colonnes : Import | Droits ════════════════════════════════ */}
      {/* ══ Grille 2 colonnes : Import | Droits ════════════════════════════════ */}
      <div className="admin-grid">
        {/* ── 1. Import ── */}
        <div className="card">
          <h3>1. Importer un nouveau document</h3>
          {uploadMsg.text && (
            <p style={msgStyle(uploadMsg.error)}>{uploadMsg.text}</p>
          )}
          <form onSubmit={handleUploadSubmit}>
            <div className="form-group">
              <label>Titre du document :</label>
              <input
                type="text"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Catégorie :</label>
              <select
                className="form-control"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">-- Sélectionner une catégorie --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {categories.length === 0 && (
                <small style={{ color: "#b45309" }}>
                  ⚠️ Aucune catégorie. Créez-en une via{" "}
                  <a
                    href="http://localhost:8000/admin"
                    target="_blank"
                    rel="noreferrer"
                  >
                    l'admin Django
                  </a>
                  .
                </small>
              )}
            </div>
            <div className="form-group">
              <label>Fichier (PDF uniquement) :</label>
              <input
                type="file"
                className="form-control"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                required
              />
            </div>
            <button type="submit" className="btn btn-success">
              ⬆️ Uploader et Enregistrer
            </button>
          </form>
        </div>

        {/* ── 2. Droits d'accès ── */}
        <div className="card">
          <h3>2. Gestion des droits d'accès</h3>

          <div
            style={{
              marginBottom: "12px",
              padding: "8px 12px",
              borderRadius: "6px",
              backgroundColor: rightsTarget ? "#eff6ff" : "#f9fafb",
              border: "1px solid #e5e7eb",
              fontSize: "0.88rem",
              color: rightsTarget ? "#1d4ed8" : "#9ca3af",
            }}
          >
            {rightsTarget
              ? `📂 Document(s) ciblé(s) : ${rightsTarget}`
              : "💡 Cochez des documents dans la liste, ou cliquez « Gérer les droits » sur un document."}
          </div>

          {permMsg.text && (
            <p style={msgStyle(permMsg.error)}>{permMsg.text}</p>
          )}

          <form onSubmit={handleApplyPermissions}>
            {/* Barre titre + désélection membres */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>
                Membres à autoriser
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: "4px 10px",
                  fontSize: "0.82rem",
                  visibility: checkedMembers.length > 0 ? "visible" : "hidden",
                }}
                onClick={() => setCheckedMembers([])}
              >
                ✕ Désélectionner ({checkedMembers.length})
              </button>
            </div>

            {/* Table membres — même pattern que table documents */}
            <table className="table" style={{ marginBottom: "12px" }}>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={
                        checkedMembers.length === members.length &&
                        members.length > 0
                      }
                      onChange={toggleAllMembers}
                      title="Sélectionner tous"
                    />
                  </th>
                  <th>Utilisateur</th>
                  <th>E-mail</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 && (
                  <tr>
                    <td
                      colSpan="3"
                      style={{ textAlign: "center", color: "#b45309" }}
                    >
                      ⚠️ Aucun membre trouvé.
                    </td>
                  </tr>
                )}
                {members.map((m) => (
                  <tr
                    key={m.id}
                    style={{
                      backgroundColor: checkedMembers.includes(m.id)
                        ? "#eff6ff"
                        : "",
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={checkedMembers.includes(m.id)}
                        onChange={() => toggleMember(m.id)}
                      />
                    </td>
                    <td
                      style={{
                        fontWeight: checkedMembers.includes(m.id)
                          ? "600"
                          : "normal",
                      }}
                    >
                      {m.username}
                    </td>
                    <td style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                      {m.email}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Droits */}
            <div className="form-group">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={canView}
                  onChange={(e) => setCanView(e.target.checked)}
                />
                Autoriser la lecture
              </label>
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
                  checked={canDownload}
                  onChange={(e) => setCanDownload(e.target.checked)}
                />
                Autoriser le téléchargement
              </label>
            </div>

            {/* Bouton — texte variable, toujours présent */}
            <button type="submit" className="btn btn-primary">
              {checkedMembers.length > 0 && checkedDocs.length > 0
                ? `Appliquer à ${checkedMembers.length} membre${checkedMembers.length > 1 ? "s" : ""} sur ${checkedDocs.length} doc${checkedDocs.length > 1 ? "s" : ""}`
                : checkedMembers.length > 0
                  ? `Appliquer à ${checkedMembers.length} membre${checkedMembers.length > 1 ? "s" : ""}`
                  : "Appliquer les permissions"}
            </button>
          </form>
        </div>
      </div>
      {/* fin grille */}

      {/* ══ 3. Publication ══════════════════════════════════════════════════════ */}
      <div className="card" style={{ marginTop: "24px" }}>
        <h3>3. Publier un document pour aujourd'hui</h3>

        <div
          style={{
            marginBottom: "12px",
            padding: "8px 12px",
            borderRadius: "6px",
            backgroundColor: pubTarget ? "#f0fdf4" : "#f9fafb",
            border: "1px solid #e5e7eb",
            fontSize: "0.88rem",
            color: pubTarget ? "#166534" : "#9ca3af",
          }}
        >
          {pubTarget
            ? `📢 Cible : ${pubTarget}`
            : "💡 Cochez des documents dans la liste ou cliquez « Publier » sur un document."}
        </div>

        {pubMsg.text && <p style={msgStyle(pubMsg.error)}>{pubMsg.text}</p>}

        <div
          className="form-group"
          style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={downloadAllowed}
              onChange={(e) => setDownloadAllowed(e.target.checked)}
            />
            Autoriser le téléchargement
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={printAllowed}
              onChange={(e) => setPrintAllowed(e.target.checked)}
            />
            Autoriser l'impression
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={signatureRequired}
              onChange={(e) => setSignatureRequired(e.target.checked)}
            />
            Paraphe obligatoire
          </label>
        </div>

        <div className="form-group" style={{ marginTop: "12px" }}>
          <label
            style={{ display: "block", marginBottom: "6px", fontWeight: "500" }}
          >
            💬 Remarque à l'attention des membres{" "}
            <span
              style={{
                fontWeight: "normal",
                color: "#6b7280",
                fontSize: "0.85rem",
              }}
            >
              (optionnel — incluse dans l'e-mail de notification)
            </span>
          </label>
          <textarea
            className="form-control"
            rows={3}
            placeholder="Ex : Merci de lire ce document avant notre réunion de vendredi."
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button
            onClick={
              checkedDocs.length > 0
                ? handleMultiPublish
                : handlePublicationSubmit
            }
            className="btn btn-primary"
          >
            {checkedDocs.length > 0
              ? `📢 Publier ${checkedDocs.length} document${checkedDocs.length > 1 ? "s" : ""}`
              : "📢 Publier maintenant"}
          </button>
          <button
            onClick={() => setCheckedDocs([])}
            className="btn btn-secondary"
            style={{
              visibility: checkedDocs.length > 0 ? "visible" : "hidden",
            }}
          >
            Annuler la sélection
          </button>
        </div>
      </div>

      {/* ══ 4. Base documentaire ════════════════════════════════════════════════ */}
      <div className="table-container" style={{ marginTop: "32px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3>📂 Base documentaire</h3>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              minHeight: "36px",
            }}
          >
            {checkedDocs.length > 0 && (
              <>
                <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                  {checkedDocs.length} sélectionné
                  {checkedDocs.length > 1 ? "s" : ""}
                </span>
                <button
                  onClick={() =>
                    setConfirmMultiDelete({
                      type: "docs",
                      count: checkedDocs.length,
                    })
                  }
                  className="btn btn-danger"
                  style={{ padding: "5px 12px", fontSize: "0.85rem" }}
                >
                  🗑️ Supprimer
                </button>
                <button
                  onClick={handleMultiPublish}
                  className="btn btn-primary"
                  style={{ padding: "5px 12px", fontSize: "0.85rem" }}
                >
                  📢 Publier
                </button>
                <button
                  onClick={() => setCheckedDocs([])}
                  className="btn btn-secondary"
                  style={{ padding: "5px 12px", fontSize: "0.85rem" }}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>

        {multiMsg.text && (
          <p style={msgStyle(multiMsg.error)}>{multiMsg.text}</p>
        )}

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  checked={
                    checkedDocs.length === documents.length &&
                    documents.length > 0
                  }
                  onChange={toggleAllDocs}
                  title="Tout sélectionner"
                />
              </th>
              <th>Titre</th>
              <th>Catégorie</th>
              <th>Version</th>
              <th>Uploadé par</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr>
                <td
                  colSpan="6"
                  style={{ textAlign: "center", color: "#6b7280" }}
                >
                  Aucun document.
                </td>
              </tr>
            )}
            {documents.map((doc) => {
              const isChecked = checkedDocs.includes(doc.id);
              const isRightsActive = selectedDoc?.id === doc.id;
              const isPubActive = pubDoc?.id === doc.id;
              const bg = isChecked
                ? "#fef3c7"
                : isRightsActive
                  ? "#eff6ff"
                  : isPubActive
                    ? "#f0fdf4"
                    : "";
              return (
                <tr key={doc.id} style={{ backgroundColor: bg }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDoc(doc.id)}
                    />
                  </td>
                  <td>{doc.title}</td>
                  <td>{doc.category_name}</td>
                  <td>v{doc.version}</td>
                  <td>{doc.uploaded_by_name}</td>
                  <td>
                    <div
                      style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
                    >
                      <button
                        onClick={() =>
                          setSelectedDoc(isRightsActive ? null : doc)
                        }
                        className="btn btn-secondary"
                        style={{ fontSize: "0.82rem", padding: "4px 10px" }}
                      >
                        {isRightsActive ? "✓ Droits actif" : "Gérer les droits"}
                      </button>
                      <button
                        onClick={() => setPubDoc(isPubActive ? null : doc)}
                        className="btn btn-primary"
                        style={{ fontSize: "0.82rem", padding: "4px 10px" }}
                      >
                        {isPubActive ? "✓ Sélectionné" : "Publier"}
                      </button>
                      <button
                        onClick={() =>
                          setConfirmDelete({
                            type: "doc",
                            id: doc.id,
                            label: doc.title,
                          })
                        }
                        className="btn btn-danger"
                        style={{ fontSize: "0.82rem", padding: "4px 10px" }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ 5. Historique publications ══════════════════════════════════════════ */}
      <div style={{ marginTop: "32px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3>📅 Historique des publications</h3>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              minHeight: "36px",
            }}
          >
            {checkedPubs.length > 0 && (
              <>
                <span style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                  {checkedPubs.length} sélectionnée
                  {checkedPubs.length > 1 ? "s" : ""}
                </span>
                <button
                  onClick={() =>
                    setConfirmMultiDelete({
                      type: "pubs",
                      count: checkedPubs.length,
                    })
                  }
                  className="btn btn-danger"
                  style={{ padding: "5px 12px", fontSize: "0.85rem" }}
                >
                  🗑️ Supprimer
                </button>
                <button
                  onClick={() => setCheckedPubs([])}
                  className="btn btn-secondary"
                  style={{ padding: "5px 12px", fontSize: "0.85rem" }}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>

        {pubLoading && <p style={{ color: "#6b7280" }}>Chargement...</p>}
        {!pubLoading && sortedMonths.length === 0 && (
          <p style={{ color: "#6b7280" }}>Aucune publication.</p>
        )}

        {!pubLoading &&
          sortedMonths.map((monthKey) => {
            const curMonth = new Date().toISOString().substring(0, 7);
            const isCurrent = monthKey === curMonth;
            const monthPubs = groupedPubs[monthKey];
            const monthPubIds = monthPubs.map((p) => p.id);
            const allChecked = monthPubIds.every((id) =>
              checkedPubs.includes(id),
            );
            return (
              <div key={monthKey} style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    padding: "8px 14px",
                    backgroundColor: isCurrent ? "#eff6ff" : "#f3f4f6",
                    border: `1px solid ${isCurrent ? "#bfdbfe" : "#e5e7eb"}`,
                    borderRadius: "8px 8px 0 0",
                    fontWeight: "700",
                    fontSize: "0.9rem",
                    color: isCurrent ? "#1d4ed8" : "#374151",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {isCurrent ? "📅" : "📁"} {formatMonth(monthKey)}
                  <span
                    style={{
                      marginLeft: "auto",
                      backgroundColor: isCurrent ? "#bfdbfe" : "#e5e7eb",
                      color: isCurrent ? "#1d4ed8" : "#6b7280",
                      borderRadius: "12px",
                      padding: "1px 10px",
                      fontSize: "0.78rem",
                      fontWeight: "600",
                    }}
                  >
                    {monthPubs.length} publication
                    {monthPubs.length > 1 ? "s" : ""}
                  </span>
                </div>
                <table
                  className="table"
                  style={{
                    margin: 0,
                    borderRadius: "0 0 8px 8px",
                    overflow: "hidden",
                    border: `1px solid ${isCurrent ? "#bfdbfe" : "#e5e7eb"}`,
                    borderTop: "none",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: isCurrent ? "#dbeafe" : "#f9fafb",
                      }}
                    >
                      <th style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={() => {
                            if (allChecked)
                              setCheckedPubs((p) =>
                                p.filter((id) => !monthPubIds.includes(id)),
                              );
                            else
                              setCheckedPubs((p) => [
                                ...new Set([...p, ...monthPubIds]),
                              ]);
                          }}
                        />
                      </th>
                      <th>Date</th>
                      <th>Document</th>
                      <th style={{ textAlign: "center" }}>Téléchargement</th>
                      <th style={{ textAlign: "center" }}>Impression</th>
                      <th style={{ textAlign: "center" }}>Signature</th>
                      <th style={{ textAlign: "center" }}>Supprimer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthPubs.map((pub) => (
                      <tr
                        key={pub.id}
                        style={{
                          backgroundColor: checkedPubs.includes(pub.id)
                            ? "#fef3c7"
                            : "",
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={checkedPubs.includes(pub.id)}
                            onChange={() => togglePub(pub.id)}
                          />
                        </td>
                        <td style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                          {new Date(
                            pub.publish_date + "T00:00:00",
                          ).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <td style={{ fontWeight: "500" }}>
                          {pub.document_title}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {pub.download_allowed ? "✅" : "❌"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {pub.print_allowed ? "✅" : "❌"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {pub.signature_required ? "✍️" : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() =>
                              setConfirmDelete({
                                type: "pub",
                                id: pub.id,
                                label: `${pub.document_title} (${pub.publish_date})`,
                              })
                            }
                            className="btn btn-danger"
                            style={{ fontSize: "0.8rem", padding: "3px 10px" }}
                          >
                            🗑️ Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default AdminUpload;
