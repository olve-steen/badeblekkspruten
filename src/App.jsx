import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { initializeApp } from "firebase/app";
import {
  deleteDoc,
  doc,
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD02PzZMi1FYlvoXxOB6sjb5kiwuZpFAAA",
  authDomain: "badeblekkspruten-7943b.firebaseapp.com",
  projectId: "badeblekkspruten-7943b",
  storageBucket: "badeblekkspruten-7943b.firebasestorage.app",
  messagingSenderId: "749645126032",
  appId: "1:749645126032:web:1643812c4093d1d1433b15",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function todayDateValue() {
  return toLocalDateString(new Date());
}

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function toDisplayCase(value) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .map((part) => {
      const firstChar = part.charAt(0).toLocaleUpperCase("nb-NO");
      const rest = part.slice(1).toLocaleLowerCase("nb-NO");

      return `${firstChar}${rest}`;
    })
    .join(" ");
}

function toCompareKey(value) {
  return normalizeWhitespace(value).toLocaleLowerCase("nb-NO");
}

function formatDateValue(rawDate) {
  if (!rawDate) {
    return todayDateValue();
  }

  if (typeof rawDate === "string") {
    return rawDate.slice(0, 10);
  }

  if (rawDate instanceof Date) {
    return toLocalDateString(rawDate);
  }

  if (typeof rawDate.toDate === "function") {
    return toLocalDateString(rawDate.toDate());
  }

  return todayDateValue();
}

function App() {
  const [activeTab, setActiveTab] = useState("registrer");
  const [user, setUser] = useState("");
  const [location, setLocation] = useState("");
  const [bathDate, setBathDate] = useState(todayDateValue());
  const [baths, setBaths] = useState([]);
  const [editingBathId, setEditingBathId] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDate, setEditDate] = useState(todayDateValue());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [pendingDeleteBath, setPendingDeleteBath] = useState(null);

  async function loadBaths() {
    setIsLoadingData(true);
    setErrorMessage("");

    try {
      const snapshot = await getDocs(collection(db, "baths"));
      const loadedBaths = snapshot.docs.map((bathDoc) => {
        const data = bathDoc.data();

        return {
          id: bathDoc.id,
          user: data.user || "",
          location: data.location || "",
          points: Number(data.points) || 0,
          dateValue: formatDateValue(data.date),
        };
      });

      setBaths(loadedBaths);
    } catch {
      setErrorMessage("Kunne ikke laste data nå. Sjekk nettverket og prøv igjen.");
    } finally {
      setIsLoadingData(false);
    }
  }

  async function registerBath(event) {
    event.preventDefault();

    const userKey = toCompareKey(user);
    const locationKey = toCompareKey(location);
    const displayUser = toDisplayCase(user);
    const displayLocation = toDisplayCase(location);

    if (!userKey || !locationKey || !bathDate || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const hasExistingLocation = baths.some(
        (bath) => toCompareKey(bath.user) === userKey && toCompareKey(bath.location) === locationKey
      );
      const points = hasExistingLocation ? 1 : 2;

      await addDoc(collection(db, "baths"), {
        user: displayUser,
        location: displayLocation,
        points,
        date: bathDate,
      });

      setUser(displayUser);
      setLocation("");
      setBathDate(todayDateValue());
      setNoticeMessage(`Bad registrert! +${points} poeng`);

      await loadBaths();
    } catch {
      setErrorMessage("Kunne ikke registrere bad nå. Prøv igjen om et øyeblikk.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function beginEdit(bath) {
    setEditingBathId(bath.id);
    setEditLocation(bath.location);
    setEditDate(bath.dateValue);
    setErrorMessage("");
    setNoticeMessage("");
  }

  function cancelEdit() {
    setEditingBathId("");
    setEditLocation("");
    setEditDate(todayDateValue());
  }

  async function saveEdit(bath) {
    const locationKey = toCompareKey(editLocation);
    const displayLocation = toDisplayCase(editLocation);

    if (!locationKey || !editDate || isSavingEdit) {
      return;
    }

    setIsSavingEdit(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const userKey = toCompareKey(bath.user);
      const hasExistingLocation = baths.some(
        (item) =>
          item.id !== bath.id &&
          toCompareKey(item.user) === userKey &&
          toCompareKey(item.location) === locationKey
      );
      const points = hasExistingLocation ? 1 : 2;

      await updateDoc(doc(db, "baths", bath.id), {
        location: displayLocation,
        date: editDate,
        points,
      });

      cancelEdit();
      setNoticeMessage("Bad oppdatert.");
      await loadBaths();
    } catch {
      setErrorMessage("Kunne ikke oppdatere badet nå. Prøv igjen.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  function requestDeleteBath(bath) {
    setPendingDeleteBath(bath);
    setErrorMessage("");
    setNoticeMessage("");
  }

  function cancelDeleteBath() {
    if (!isDeleting) {
      setPendingDeleteBath(null);
    }
  }

  async function removeBath(bathId) {
    setErrorMessage("");
    setNoticeMessage("");
    setIsDeleting(true);

    try {
      await deleteDoc(doc(db, "baths", bathId));

      if (editingBathId === bathId) {
        cancelEdit();
      }

      setNoticeMessage("Bad slettet.");
      await loadBaths();
      return true;
    } catch {
      setErrorMessage("Kunne ikke slette badet nå. Prøv igjen.");
      return false;
    } finally {
      setIsDeleting(false);
    }
  }

  async function confirmDeleteBath() {
    if (!pendingDeleteBath || isDeleting) {
      return;
    }

    const deleted = await removeBath(pendingDeleteBath.id);

    if (deleted) {
      setPendingDeleteBath(null);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBaths();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const leaderboard = useMemo(() => {
    const totals = {};

    baths.forEach((bath) => {
      if (!totals[bath.user]) {
        totals[bath.user] = 0;
      }

      totals[bath.user] += bath.points;
    });

    return Object.entries(totals)
      .map(([name, points]) => ({
        name,
        points,
      }))
      .sort((a, b) => b.points - a.points);
  }, [baths]);

  const visibleUserBaths = useMemo(() => {
    const userKey = toCompareKey(user);

    if (!userKey) {
      return [];
    }

    return baths
      .filter((bath) => toCompareKey(bath.user) === userKey)
      .sort((a, b) => b.dateValue.localeCompare(a.dateValue));
  }, [baths, user]);

  const canSubmit = toCompareKey(user) && toCompareKey(location) && bathDate && !isSubmitting;

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>🐙 Badeblekkspruten</h1>
      </header>

      <main className="layout">
        <section className="card card-main">
          {activeTab === "registrer" ? (
            <>
              <h2>Registrere bad</h2>

              <form className="register-form" onSubmit={registerBath}>
                <label className="field-label" htmlFor="user-input">
                  Hvem badet?
                </label>
                <input
                  id="user-input"
                  placeholder="Navn"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                />

                <label className="field-label" htmlFor="location-input">
                  Hvor badet du?
                </label>
                <input
                  id="location-input"
                  placeholder="Sted"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />

                <label className="field-label" htmlFor="date-input">
                  Dato
                </label>
                <input
                  id="date-input"
                  type="date"
                  value={bathDate}
                  max={todayDateValue()}
                  onChange={(e) => setBathDate(e.target.value)}
                />

                <button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? "Registrerer..." : "🌊 Registrer bad"}
                </button>
              </form>

              <div className="list-block">
                <h3>Dine registrerte bad</h3>

                {!user.trim() ? (
                  <p className="muted">Skriv inn navn over for å se badene dine.</p>
                ) : isLoadingData ? (
                  <p className="muted">Laster bad...</p>
                ) : visibleUserBaths.length === 0 ? (
                  <p className="muted">Ingen bad registrert for dette navnet enda.</p>
                ) : (
                  visibleUserBaths.map((bath) => (
                    <article key={bath.id} className="bath-item">
                      {editingBathId === bath.id ? (
                        <>
                          <p className="bath-name">{bath.user}</p>
                          <label className="field-label" htmlFor={`location-${bath.id}`}>
                            Sted
                          </label>
                          <input
                            id={`location-${bath.id}`}
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                          />

                          <label className="field-label" htmlFor={`date-${bath.id}`}>
                            Dato
                          </label>
                          <input
                            id={`date-${bath.id}`}
                            type="date"
                            value={editDate}
                            max={todayDateValue()}
                            onChange={(e) => setEditDate(e.target.value)}
                          />

                          <div className="item-actions">
                            <button
                              type="button"
                              className="small-button"
                              onClick={() => saveEdit(bath)}
                              disabled={isSavingEdit || !editLocation.trim() || !editDate}
                            >
                              {isSavingEdit ? "Lagrer..." : "Lagre"}
                            </button>
                            <button type="button" className="small-button ghost" onClick={cancelEdit}>
                              Avbryt
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bath-line">
                            <p className="bath-name">{bath.location}</p>
                            <strong>{bath.points} poeng</strong>
                          </div>
                          <p className="muted">Dato: {bath.dateValue}</p>

                          <div className="item-actions">
                            <button type="button" className="small-button" onClick={() => beginEdit(bath)}>
                              ✏️ Rediger
                            </button>
                            <button
                              type="button"
                              className="small-button danger"
                              onClick={() => requestDeleteBath(bath)}
                            >
                              🗑️ Slett
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <h2>Poengtavle</h2>

              {isLoadingData ? (
                <p className="muted">Laster poeng...</p>
              ) : leaderboard.length === 0 ? (
                <p className="muted">Ingen registrerte bad enda.</p>
              ) : (
                leaderboard.map((person, index) => (
                  <div key={person.name} className="leaderboard-item">
                    <span>
                      {index + 1}. {person.name}
                    </span>
                    <strong>{person.points} poeng</strong>
                  </div>
                ))
              )}
            </>
          )}

          {noticeMessage && <p className="notice success">{noticeMessage}</p>}
          {errorMessage && <p className="notice error">{errorMessage}</p>}
        </section>
      </main>

      <nav className="bottom-nav" role="tablist" aria-label="Visning">
        <button
          type="button"
          className={`bottom-nav-button ${activeTab === "registrer" ? "active" : ""}`}
          onClick={() => setActiveTab("registrer")}
        >
          <span className="bottom-nav-icon" aria-hidden="true">🌊</span>
          <span className="bottom-nav-label">Registrere bad</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-button ${activeTab === "leaderboard" ? "active" : ""}`}
          onClick={() => setActiveTab("leaderboard")}
        >
          <span className="bottom-nav-icon" aria-hidden="true">🏆</span>
          <span className="bottom-nav-label">Poengtavle</span>
        </button>
      </nav>

      {activeTab === "registrer" && (
        <footer className="footer-note">
          <span className="footer-icon">ℹ️</span>
          Godkjent bad: Hodet under vann / 5 svømmetak.
          <br />
          Første gang på nytt sted gir 2 poeng, ellers 1 poeng.
        </footer>
      )}

      {pendingDeleteBath && (
        <div className="dialog-backdrop" role="presentation" onClick={cancelDeleteBath}>
          <section
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-dialog-title">Slette bad?</h3>
            <p>
              Er du sikker på at du vil slette badet ved <strong>{pendingDeleteBath.location}</strong>?
            </p>

            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-button secondary"
                onClick={cancelDeleteBath}
                disabled={isDeleting}
              >
                Avbryt
              </button>
              <button
                type="button"
                className="dialog-button danger"
                onClick={confirmDeleteBath}
                disabled={isDeleting}
              >
                {isDeleting ? "Sletter..." : "Ja, slett"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;