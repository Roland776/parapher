import React, { useState, useEffect, useRef, useContext } from "react";
import API, { getData } from "../api";
import { AuthContext } from "../context/AuthContext";
// PDF.js installé localement via npm — aucune dépendance CDN
import * as pdfjsLib from "pdfjs-dist";
// Worker bundlé par npm : toujours synchronisé avec la version de pdfjs-dist.
// Remplace l'ancienne URL vers /public qui se désynchronisait si la version changeait.
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ─── Rendu PDF page par page via PDF.js ──────────────────────────────────────
// Pas de plugin navigateur requis — fonctionne partout.
const PdfViewer = ({ data, username }) => {
  const containerRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [curPage, setCurPage] = useState(1);
  const [scale, setScale] = useState(window.innerWidth < 768 ? 0.6 : 1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Charger le document PDF depuis les bytes reçus (pdfjs-dist npm, pas de CDN)
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setCurPage(1);

    const uint8 = new Uint8Array(data);
    pdfjsLib
      .getDocument({ data: uint8 })
      .promise.then((pdfDoc) => {
        if (cancelled) return;
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger le PDF.");
      });

    return () => {
      cancelled = true;
    };
  }, [data]);

  // Rendre la page courante sur le canvas
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;

    pdfDocRef.current.getPage(curPage).then((page) => {
      const viewport = page.getViewport({ scale });
      const canvas = containerRef.current;
      if (!canvas) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const ctx = canvas.getContext("2d");

      // Annuler le render précédent si encore en cours
      if (renderTaskRef.current) renderTaskRef.current.cancel();

      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
    });
  }, [curPage, scale, loading]);

  if (error)
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#b91c1c" }}>
        🚫 {error}
      </div>
    );

  if (loading)
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
        ⏳ Chargement du document...
      </div>
    );

  return (
    <div>
      {/* Barre de navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "8px 12px",
          backgroundColor: "#f3f4f6",
          borderBottom: "1px solid #e5e7eb",
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn btn-secondary"
          style={{ padding: "4px 10px", fontSize: "0.82rem" }}
          onClick={() => setCurPage((p) => Math.max(1, p - 1))}
          disabled={curPage <= 1}
        >
          ◀ Préc.
        </button>
        <span style={{ fontSize: "0.88rem", color: "#374151" }}>
          Page {curPage} / {numPages}
        </span>
        <button
          className="btn btn-secondary"
          style={{ padding: "4px 10px", fontSize: "0.82rem" }}
          onClick={() => setCurPage((p) => Math.min(numPages, p + 1))}
          disabled={curPage >= numPages}
        >
          Suiv. ▶
        </button>
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <button
            className="btn btn-secondary"
            style={{ padding: "4px 8px", fontSize: "0.82rem" }}
            onClick={() =>
              setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))
            }
          >
            −
          </button>
          <span style={{ fontSize: "0.82rem", color: "#6b7280" }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: "4px 8px", fontSize: "0.82rem" }}
            onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))}
          >
            +
          </button>
        </span>
      </div>

      {/* Canvas PDF + filigrane */}
      <div
        style={{
          position: "relative",
          overflowX: "auto",
          backgroundColor: "#525659",
          padding: "16px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <canvas
          ref={containerRef}
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.4)", display: "block" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              transform: "rotate(-30deg)",
              fontSize: "1.6em",
              fontWeight: "bold",
              color: "rgba(255,255,255,0.06)",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            CONSULTATION — {username?.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Composant principal ──────────────────────────────────────────────────────
const MemberPublications = () => {
  const { user } = useContext(AuthContext);
  const [publications, setPublications] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [pdfData, setPdfData] = useState(null); // ArrayBuffer brut
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [consent, setConsent] = useState(false);
  const [signMsg, setSignMsg] = useState({ text: "", ok: false });
  const [actionMsg, setActionMsg] = useState({ text: "", ok: false });
  const [signed, setSigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState({});

  useEffect(() => {
    const fetchPublications = async () => {
      try {
        const response = await API.get("publications/all/");
        setPublications(getData(response));
        const currentMonth = new Date().toISOString().substring(0, 7);
        setOpenFolders({ [currentMonth]: true });
      } catch (error) {
        if (process.env.NODE_ENV === "development") console.error("Erreur chargement publications", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPublications();
  }, []);

  const groupedByDate = publications.reduce((acc, pub) => {
    const monthKey = pub.publish_date.substring(0, 7);
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(pub);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedByDate).sort((a, b) =>
    b.localeCompare(a),
  );

  const toggleFolder = (date) =>
    setOpenFolders((prev) => ({ ...prev, [date]: !prev[date] }));

  const formatMonth = (monthKey) => {
    const [year, month] = monthKey.split("-");
    const d = new Date(year, month - 1);
    const s = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handleConsult = async (pub) => {
    setActiveDoc(pub);
    setConsent(false);
    setSignMsg({ text: "", ok: false });
    setActionMsg({ text: "", ok: false });
    setPdfError("");
    setPdfData(null);
    setPdfLoading(true);

    try {
      const response = await API.get(`documents/${pub.document}/view/`, {
        responseType: "arraybuffer",
      });
      // Vérifier que la réponse est bien un PDF (magic bytes %PDF)
      const bytes = new Uint8Array(response.data);
      const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
      if (magic !== "%PDF") {
        throw new Error("La réponse reçue n'est pas un PDF valide.");
      }
      setPdfData(response.data);
    } catch (error) {
      const status = error.response?.status;
      // Log de diagnostic uniquement en développement
      if (process.env.NODE_ENV === "development") {
        console.error("[PDF] Erreur chargement:", {
          status,
          statusText: error.response?.statusText,
          message: error.message,
          contentType: error.response?.headers?.["content-type"],
        });
      }
      setPdfError(
        error.message?.includes("n'est pas un PDF")
          ? "Le fichier reçu est invalide (réponse corrompue). Vérifiez la configuration du tunnel ngrok."
          : status === 401
            ? "Session expirée. Veuillez vous reconnecter."
            : status === 403
              ? "Accès refusé à ce document."
              : status === 404
                ? "Document introuvable."
                : status === 500
                  ? `Erreur serveur (500). Vérifiez les logs Django.`
                  : `Erreur lors du chargement du document (${status ?? "réseau"}).`,
      );
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownload = async (docId, title) => {
    let url = null;
    try {
      const response = await API.get(`documents/${docId}/download/`, {
        responseType: "blob",
      });
      url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.pdf`;
      a.click();
      setActionMsg({ text: "✅ Téléchargement en cours...", ok: true });
    } catch (error) {
      const status = error.response?.status;
      setActionMsg({
        text:
          status === 403
            ? "Téléchargement refusé : droits insuffisants."
            : status === 404
              ? "Document introuvable."
              : "Erreur lors du téléchargement.",
        ok: false,
      });
    } finally {
      if (url) setTimeout(() => window.URL.revokeObjectURL(url), 500);
    }
  };

  const handleSign = async (e) => {
    e.preventDefault();
    if (!consent) {
      setSignMsg({
        text: "Vous devez cocher la case de consentement.",
        ok: false,
      });
      return;
    }
    try {
      await API.post(`documents/${activeDoc.document}/sign/`, {
        consent_accepted: true,
      });
      setSignMsg({
        text: "✅ Paraphe apposé avec succès ! Signature eIDAS générée.",
        ok: true,
      });
      setSigned((prev) => [...prev, activeDoc.document]);
    } catch (error) {
      setSignMsg({
        text: error.response?.data?.detail || "Erreur lors de la signature.",
        ok: false,
      });
    }
  };

  const msgStyle = (ok) => ({
    padding: "10px 14px",
    borderRadius: "6px",
    marginBottom: "12px",
    fontWeight: "500",
    backgroundColor: ok ? "#dcfce7" : "#fee2e2",
    color: ok ? "#166534" : "#b91c1c",
    border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
  });

  return (
    <div className="container">
      <h1>Espace Membre — Publications</h1>
      <p style={{ color: "#6b7280" }}>
        Connecté en tant que <strong>{user?.username}</strong>
      </p>
      <hr />

      <div className="member-layout">
        {/* ── Colonne gauche ── */}
        <div className="member-sidebar">
          <h3 style={{ marginBottom: "16px" }}>Documents par date</h3>

          {loading && <p style={{ color: "#6b7280" }}>Chargement...</p>}

          {!loading && sortedDates.length === 0 && (
            <div
              style={{
                padding: "20px",
                backgroundColor: "#f9fafb",
                borderRadius: "8px",
                border: "1px dashed #d1d5db",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              <p>📭 Aucun document publié.</p>
              <small>
                Revenez plus tard ou contactez votre administrateur.
              </small>
            </div>
          )}

          {!loading &&
            sortedDates.map((date) => {
              const isOpen = !!openFolders[date];
              const pubs = groupedByDate[date];
              const curMonth = new Date().toISOString().substring(0, 7);
              const isCurrent = date === curMonth;

              return (
                <div key={date} style={{ marginBottom: "8px" }}>
                  <button
                    onClick={() => toggleFolder(date)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      border: `1px solid ${isCurrent ? "#3b82f6" : "#e5e7eb"}`,
                      borderRadius: isOpen ? "8px 8px 0 0" : "8px",
                      backgroundColor: isCurrent ? "#eff6ff" : "#f9fafb",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontWeight: isCurrent ? "700" : "600",
                      fontSize: "0.88rem",
                      color: isCurrent ? "#1d4ed8" : "#374151",
                    }}
                  >
                    <span>📁 {formatMonth(date)}</span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: isCurrent ? "#bfdbfe" : "#e5e7eb",
                          color: isCurrent ? "#1d4ed8" : "#6b7280",
                          borderRadius: "12px",
                          padding: "1px 8px",
                          fontSize: "0.78rem",
                        }}
                      >
                        {pubs.length} doc{pubs.length > 1 ? "s" : ""}
                      </span>
                      <span>{isOpen ? "▲" : "▼"}</span>
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      style={{
                        border: `1px solid ${isCurrent ? "#3b82f6" : "#e5e7eb"}`,
                        borderTop: "none",
                        borderRadius: "0 0 8px 8px",
                        overflow: "hidden",
                      }}
                    >
                      {pubs.map((pub, idx) => {
                        const alreadySigned = signed.includes(pub.document);
                        const isActive = activeDoc?.id === pub.id;
                        return (
                          <div
                            key={pub.id}
                            style={{
                              padding: "12px 14px",
                              backgroundColor: isActive
                                ? "#dbeafe"
                                : idx % 2 === 0
                                  ? "#ffffff"
                                  : "#f9fafb",
                              borderTop: idx > 0 ? "1px solid #f3f4f6" : "none",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: "600",
                                marginBottom: "4px",
                                fontSize: "0.9rem",
                              }}
                            >
                              {alreadySigned && "✅ "}
                              <span
                                style={{
                                  fontSize: "0.8em",
                                  color: "#9ca3af",
                                  marginRight: "6px",
                                }}
                              >
                                {pub.publish_date.split("-")[2]}/
                                {pub.publish_date.split("-")[1]}
                              </span>
                              {pub.document_title}
                            </div>
                            <div
                              style={{
                                fontSize: "0.75em",
                                color: "#6b7280",
                                marginBottom: "8px",
                              }}
                            >
                              {pub.download_allowed ? "🔓" : "🔒"}
                              {pub.print_allowed ? " 🖨️" : " 🚫"}
                              {pub.signature_required
                                ? " ✍️ Paraphe requis"
                                : " 📋 Consultation"}
                              {pub.admin_note &&
                                pub.admin_note.trim() !== "" && (
                                  <span
                                    title="Message de l'administrateur"
                                    style={{
                                      marginLeft: "6px",
                                      color: "#d97706",
                                    }}
                                  >
                                    💬
                                  </span>
                                )}
                            </div>
                            <button
                              onClick={() => handleConsult(pub)}
                              className={
                                isActive
                                  ? "btn btn-secondary"
                                  : "btn btn-primary"
                              }
                              style={{
                                width: "100%",
                                fontSize: "0.82rem",
                                padding: "5px",
                              }}
                            >
                              {isActive
                                ? "📄 En cours de lecture"
                                : alreadySigned
                                  ? "📄 Relire (déjà paraphé)"
                                  : pub.signature_required
                                    ? "Consulter & Parapher ✍️"
                                    : "Consulter 👁️"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* ── Colonne droite : visionneuse ── */}
        <div className="member-viewer">
          {!activeDoc && (
            <div
              style={{
                textAlign: "center",
                padding: "80px 40px",
                border: "2px dashed #d1d5db",
                borderRadius: "12px",
                color: "#9ca3af",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📋</div>
              <p style={{ fontSize: "1.1rem" }}>
                Sélectionnez un document à gauche
              </p>
              <p style={{ fontSize: "0.9rem" }}>
                pour le consulter et apposer votre paraphe.
              </p>
            </div>
          )}

          {activeDoc && (
            <div className="card" style={{ padding: "24px" }}>
              {/* En-tête */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
                  📄 {activeDoc.document_title}
                </h2>
                {activeDoc.download_allowed && (
                  <button
                    onClick={() =>
                      handleDownload(
                        activeDoc.document,
                        activeDoc.document_title,
                      )
                    }
                    className="btn btn-success"
                    style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                  >
                    📥 Télécharger le PDF
                  </button>
                )}
              </div>

              {actionMsg.text && (
                <p style={msgStyle(actionMsg.ok)}>{actionMsg.text}</p>
              )}

              {/* Note admin */}
              {activeDoc.admin_note && activeDoc.admin_note.trim() !== "" && (
                <div
                  style={{
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fcd34d",
                    borderLeft: "4px solid #f59e0b",
                    borderRadius: "6px",
                    padding: "12px 16px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "600",
                      color: "#92400e",
                      marginBottom: "4px",
                      fontSize: "0.85rem",
                    }}
                  >
                    💬 Message de l'administrateur
                  </div>
                  <p
                    style={{
                      margin: 0,
                      color: "#78350f",
                      fontSize: "0.92rem",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {activeDoc.admin_note}
                  </p>
                </div>
              )}

              {/* Zone PDF */}
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  overflow: "hidden",
                  marginBottom: "24px",
                  backgroundColor: "#525659",
                }}
              >
                {pdfLoading && (
                  <div
                    style={{
                      padding: "80px",
                      textAlign: "center",
                      color: "#fff",
                      fontSize: "1rem",
                    }}
                  >
                    ⏳ Chargement du document...
                  </div>
                )}
                {!pdfLoading && pdfError && (
                  <div
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "#fca5a5",
                      fontSize: "0.95rem",
                    }}
                  >
                    🚫 {pdfError}
                  </div>
                )}
                {!pdfLoading && !pdfError && pdfData && (
                  <PdfViewer data={pdfData} username={user?.username} />
                )}
              </div>

              {/* Section signature */}
              {pdfData &&
                !pdfError &&
                activeDoc.signature_required &&
                !signed.includes(activeDoc.document) && (
                  <div
                    style={{
                      borderTop: "2px solid #e5e7eb",
                      paddingTop: "20px",
                    }}
                  >
                    <h3 style={{ marginBottom: "12px" }}>
                      ✍️ Apposer mon paraphe électronique
                    </h3>
                    {signMsg.text && (
                      <p style={msgStyle(signMsg.ok)}>{signMsg.text}</p>
                    )}
                    <form onSubmit={handleSign}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          marginBottom: "16px",
                          cursor: "pointer",
                          backgroundColor: "#f9fafb",
                          padding: "12px",
                          borderRadius: "6px",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          style={{ marginTop: "3px", flexShrink: 0 }}
                        />
                        <span style={{ fontSize: "0.9rem", color: "#374151" }}>
                          Je certifie avoir pris connaissance du document{" "}
                          <strong>"{activeDoc.document_title}"</strong> et
                          consens à y apposer ma signature électronique ayant
                          valeur légale conformément au règlement eIDAS.
                        </span>
                      </label>
                      <button
                        type="submit"
                        className="btn btn-danger"
                        style={{
                          padding: "10px 24px",
                          fontSize: "1rem",
                          fontWeight: "600",
                        }}
                      >
                        ✍️ Confirmer le Paraphe
                      </button>
                    </form>
                  </div>
                )}

              {signed.includes(activeDoc.document) && (
                <div style={msgStyle(true)}>
                  ✅ Ce document a été paraphé avec succès. Votre signature a
                  été enregistrée.
                </div>
              )}

              {pdfData &&
                !pdfError &&
                !activeDoc.signature_required &&
                !signed.includes(activeDoc.document) && (
                  <div style={msgStyle(true)}>
                    👁️ Ce document est en consultation simple. Aucun paraphe
                    requis.
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberPublications;
