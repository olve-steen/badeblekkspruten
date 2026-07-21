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

function formatDisplayDate(dateValue) {
  if (!dateValue || !dateValue.includes("-")) {
    return "Velg dato";
  }

  const [year, month, day] = dateValue.split("-");
  return `${day}.${month}.${year}`;
}

function formatShortDisplayDate(dateValue) {
  if (!dateValue || !dateValue.includes("-")) {
    return "";
  }

  const [, month, day] = dateValue.split("-");
  return `${day}.${month}`;
}

const statsPalette = [
  "#1e88e5",
  "#8e24aa",
  "#e53935",
  "#fb8c00",
  "#00acc1",
  "#3949ab",
  "#d81b60",
  "#6d4c41",
  "#f4511e",
  "#5e35b1",
  "#00897b",
  "#546e7a",
];

function getSeriesColor(name) {
  const normalizedName = toCompareKey(name);
  const hash = [...normalizedName].reduce((accumulator, char, index) => {
    return accumulator + char.charCodeAt(0) * (index + 1);
  }, 0);

  return statsPalette[hash % statsPalette.length];
}

function CumulativeParticipantsChart({ dates, series }) {
  if (!dates.length || !series.length) {
    return null;
  }

  const [highlightedParticipant, setHighlightedParticipant] = useState("");

  const width = 420;
  const height = 300;
  const paddingLeft = 30;
  const paddingRight = 14;
  const paddingTop = 22;
  const paddingBottom = 56;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(
    ...series.flatMap((participant) => participant.points.map((point) => point.count)),
    1
  );

  const getX = (index) => {
    if (dates.length === 1) {
      return paddingLeft + chartWidth / 2;
    }

    return paddingLeft + (index / (dates.length - 1)) * chartWidth;
  };

  const getY = (value) => paddingTop + chartHeight - (value / maxValue) * chartHeight;

  const yTicks = [maxValue, maxValue / 2, 0];
  const formatTickLabel = (value) => {
    if (Number.isInteger(value)) {
      return value;
    }

    return value.toFixed(1);
  };
  const firstDateLabel = formatShortDisplayDate(dates[0]);
  const middleDateLabel = formatShortDisplayDate(dates[Math.floor((dates.length - 1) / 2)]);
  const lastDateLabel = formatShortDisplayDate(dates[dates.length - 1]);
  const toggleHighlightedParticipant = (name) => {
    setHighlightedParticipant((current) => (current === name ? "" : name));
  };

  return (
    <div className="stats-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Kumulativ utvikling for deltakere over tid"
        onClick={() => setHighlightedParticipant("")}
      >
        {yTicks.map((tickValue, index) => {
          const y = getY(tickValue);

          return (
            <g key={`${tickValue}-${index}`}>
              <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} className="stats-grid-line" />
              <text x="2" y={y + 4} textAnchor="start" className="stats-axis-label">
                {formatTickLabel(tickValue)}
              </text>
            </g>
          );
        })}

        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={paddingTop + chartHeight}
          className="stats-axis"
        />
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={paddingLeft + chartWidth}
          y2={paddingTop + chartHeight}
          className="stats-axis"
        />

        {series.map((participant) => {
          const linePoints = participant.points
            .map((point, index) => `${getX(index)},${getY(point.count)}`)
            .join(" ");
          const isHighlighted = highlightedParticipant === participant.name;
          const isDimmed = highlightedParticipant && !isHighlighted;

          return (
            <g key={participant.name}>
              <polyline
                points={linePoints}
                fill="none"
                className="stats-series-hit-area"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleHighlightedParticipant(participant.name);
                }}
              />
              <polyline
                points={linePoints}
                fill="none"
                className="stats-series-line"
                style={{
                  stroke: participant.color,
                  opacity: isDimmed ? 0.22 : 1,
                  strokeWidth: isHighlighted ? 6 : 4,
                  pointerEvents: "none",
                }}
              />
            </g>
          );
        })}

        <text
          x={paddingLeft}
          y={paddingTop + chartHeight + 22}
          textAnchor="start"
          className="stats-axis-label"
        >
          {firstDateLabel}
        </text>
        <text
          x={paddingLeft + chartWidth / 2}
          y={paddingTop + chartHeight + 26}
          textAnchor="middle"
          className="stats-axis-label"
        >
          {middleDateLabel}
        </text>
        <text
          x={paddingLeft + chartWidth}
          y={paddingTop + chartHeight + 22}
          textAnchor="end"
          className="stats-axis-label"
        >
          {lastDateLabel}
        </text>
      </svg>

      <div className="stats-legend" aria-label="Deltakere">
        {series.map((participant) => {
          const isSelected = highlightedParticipant === participant.name;
          const isDimmed = Boolean(highlightedParticipant) && !isSelected;

          return (
            <button
              key={participant.name}
              type="button"
              className={`stats-legend-item ${isSelected ? "active" : ""} ${isDimmed ? "dimmed" : ""}`}
              onClick={() => toggleHighlightedParticipant(participant.name)}
              aria-pressed={isSelected}
            >
              <span className="stats-legend-dot" style={{ backgroundColor: participant.color }} aria-hidden="true" />
              <span>{participant.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
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
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [pendingDeleteBath, setPendingDeleteBath] = useState(null);
  const userSearchKey = toCompareKey(user);
  const locationInputKey = toCompareKey(location);

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
    const bathCounts = {};

    baths.forEach((bath) => {
      if (!totals[bath.user]) {
        totals[bath.user] = 0;
      }

      if (!bathCounts[bath.user]) {
        bathCounts[bath.user] = 0;
      }

      totals[bath.user] += bath.points;
      bathCounts[bath.user] += 1;
    });

    const sorted = Object.entries(totals)
      .map(([name, points]) => ({
        name,
        points,
        bathCount: bathCounts[name] || 0,
      }))
      .sort((a, b) => b.points - a.points);

    let previousPoints = null;
    let currentRank = 0;

    return sorted.map((entry, index) => {
      if (entry.points !== previousPoints) {
        currentRank = index + 1;
        previousPoints = entry.points;
      }

      return {
        ...entry,
        rank: currentRank,
      };
    });
  }, [baths]);

  const visibleUserBaths = useMemo(() => {
    if (!userSearchKey) {
      return [];
    }

    return baths
      .filter((bath) => toCompareKey(bath.user) === userSearchKey)
      .sort((a, b) => b.dateValue.localeCompare(a.dateValue));
  }, [baths, userSearchKey]);

  const cumulativeStats = useMemo(() => {
    const dates = [...new Set(baths.map((bath) => bath.dateValue))].sort((a, b) => a.localeCompare(b));

    const users = [...new Set(baths.map((bath) => bath.user))].sort((a, b) =>
      a.localeCompare(b, "nb-NO")
    );

    const userDateCounts = {};

    baths.forEach((bath) => {
      if (!userDateCounts[bath.user]) {
        userDateCounts[bath.user] = {};
      }

      if (!userDateCounts[bath.user][bath.dateValue]) {
        userDateCounts[bath.user][bath.dateValue] = 0;
      }

      userDateCounts[bath.user][bath.dateValue] += Number(bath.points) || 0;
    });

    const series = users.map((name) => {
      let runningTotal = 0;

      const points = dates.map((date) => {
        runningTotal += userDateCounts[name]?.[date] || 0;

        return {
          date,
          count: runningTotal,
        };
      });

      return {
        name,
        color: getSeriesColor(name),
        points,
      };
    });

    return {
      dates,
      series,
    };
  }, [baths]);

  const locationSuggestions = useMemo(() => {
    if (!userSearchKey) {
      return [];
    }

    const sortedBaths = baths
      .filter((bath) => toCompareKey(bath.user) === userSearchKey)
      .sort((a, b) => b.dateValue.localeCompare(a.dateValue));
    const seenLocations = new Set();

    return sortedBaths
      .map((bath) => bath.location)
      .filter((bathLocation) => {
        const locationKey = toCompareKey(bathLocation);

        if (!locationKey || seenLocations.has(locationKey)) {
          return false;
        }

        seenLocations.add(locationKey);
        return true;
      });
  }, [baths, userSearchKey]);

  const visibleLocationSuggestions = useMemo(() => {
    if (!locationInputKey) {
      return locationSuggestions;
    }

    return locationSuggestions.filter((locationOption) =>
      toCompareKey(locationOption).includes(locationInputKey)
    );
  }, [locationInputKey, locationSuggestions]);

  function selectLocationSuggestion(locationOption) {
    setLocation(locationOption);
    setIsLocationMenuOpen(false);
  }

  const canSubmit = Boolean(userSearchKey && locationInputKey && bathDate && !isSubmitting);

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
                <div className="location-field">
                  <input
                    id="location-input"
                    className="location-input"
                    placeholder="Sted"
                    value={location}
                    autoComplete="off"
                    onFocus={() => setIsLocationMenuOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setIsLocationMenuOpen(false);
                      }, 120);
                    }}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      setIsLocationMenuOpen(true);
                    }}
                  />

                  {isLocationMenuOpen && visibleLocationSuggestions.length > 0 && (
                    <ul className="location-menu" role="listbox" aria-label="Tidligere badesteder">
                      {visibleLocationSuggestions.map((locationOption) => (
                        <li key={toCompareKey(locationOption)}>
                          <button
                            type="button"
                            className="location-menu-item"
                            onClick={() => {
                              selectLocationSuggestion(locationOption);
                            }}
                          >
                            {locationOption}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <label className="field-label" htmlFor="date-input">
                  Dato
                </label>
                <div className="date-field">
                  <span className="date-field-value">{formatDisplayDate(bathDate)}</span>
                  <span className="date-field-icon" aria-hidden="true">
                    📅
                  </span>
                  <input
                    id="date-input"
                    className="date-input-native"
                    type="date"
                    value={bathDate}
                    max={todayDateValue()}
                    onChange={(e) => setBathDate(e.target.value)}
                  />
                </div>

                <button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? "Registrerer..." : "🌊 Registrer bad"}
                </button>
              </form>

              <div className="list-block">
                <h3>Dine registrerte bad</h3>

                {!userSearchKey ? (
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
                          <div className="date-field">
                            <span className="date-field-value">{formatDisplayDate(editDate)}</span>
                            <span className="date-field-icon" aria-hidden="true">
                              📅
                            </span>
                            <input
                              id={`date-${bath.id}`}
                              className="date-input-native"
                              type="date"
                              value={editDate}
                              max={todayDateValue()}
                              onChange={(e) => setEditDate(e.target.value)}
                            />
                          </div>

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
          ) : activeTab === "leaderboard" ? (
            <>
              <h2>Poengtavle</h2>

              {isLoadingData ? (
                <p className="muted">Laster poeng...</p>
              ) : leaderboard.length === 0 ? (
                <p className="muted">Ingen registrerte bad enda.</p>
              ) : (
                leaderboard.map((person) => {
                  const topScore = leaderboard[0]?.points ?? 0;
                  const isTopScore = person.points === topScore;

                  return (
                    <div key={person.name} className="leaderboard-item">
                      <span className="leaderboard-name">
                        {person.rank}. {person.name} {isTopScore ? "👑" : ""}
                      </span>
                      <span className="leaderboard-bath-count">{person.bathCount} bad</span>
                      <strong>{person.points} poeng</strong>
                    </div>
                  );
                })
              )}
            </>
          ) : (
            <>
              <h2>Statistikk</h2>

              {isLoadingData ? (
                <p className="muted">Laster statistikk...</p>
              ) : cumulativeStats.series.length === 0 ? (
                <p className="muted">Ingen registrerte bad enda.</p>
              ) : (
                <div className="stats-grid">
                  <CumulativeParticipantsChart
                    dates={cumulativeStats.dates}
                    series={cumulativeStats.series}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === "registrer" && noticeMessage && <p className="notice success">{noticeMessage}</p>}
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
        <button
          type="button"
          className={`bottom-nav-button ${activeTab === "statistikk" ? "active" : ""}`}
          onClick={() => setActiveTab("statistikk")}
        >
          <span className="bottom-nav-icon" aria-hidden="true">📈</span>
          <span className="bottom-nav-label">Statistikk</span>
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