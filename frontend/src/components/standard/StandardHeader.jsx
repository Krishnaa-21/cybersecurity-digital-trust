import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { LogOut, Plus, Search } from "lucide-react";
import { useMode } from "../../context/ModeContext";
import { getOfficer, clearAuth, apiClient } from "../../api/client";
import { t } from "../../config/standardPortal";
import StandardUtilityBar from "./StandardUtilityBar";
import StandardBranding from "./StandardBranding";
import { scamLabel } from "./StandardUI";

/**
 * Portal header: utility bar → identity band (logo, app name, case search,
 * officer) → primary navigation bar.
 * Behaviour (search, navigation, sign-out) is identical to the previous header.
 */
export default function StandardHeader({ onOpenNewInvestigation }) {
  const { language } = useMode();
  const s = t(language);
  const navigate = useNavigate();
  const location = useLocation();
  const { caseId } = useParams();
  const activeCaseId = caseId || "1";

  const officer = getOfficer() || {};
  const officerName = officer.name || s.officer;
  const initials = officerName
    .replace(/[^\p{L}\s.]/gu, "")
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  /* ── Case search (fetches the case list lazily, filters locally) ───── */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const cacheRef = useRef(null);
  const searchRef = useRef(null);

  const ensureCases = async () => {
    if (cacheRef.current) return cacheRef.current;
    try {
      const data = await apiClient.get("cases");
      cacheRef.current = data || [];
    } catch {
      cacheRef.current = null;
      return [];
    }
    return cacheRef.current;
  };

  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      return undefined;
    }
    let cancelled = false;
    ensureCases().then((cases) => {
      if (cancelled) return;
      const matches = cases.filter(
        (c) =>
          c.case_number?.toLowerCase().includes(q) ||
          c.victim_name?.toLowerCase().includes(q) ||
          c.district?.toLowerCase().includes(q) ||
          c.scam_type?.toLowerCase().includes(q)
      );
      setResults(matches.slice(0, 5));
      setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    const onDown = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onCaseCreated = () => {
      cacheRef.current = null;
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("tracex_case_created", onCaseCreated);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("tracex_case_created", onCaseCreated);
    };
  }, []);

  const openCase = (c) => {
    setOpen(false);
    setQuery("");
    navigate(`/cases/${c.id}/graph`);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (results[0]) openCase(results[0]);
  };

  const handleSignOut = () => {
    clearAuth();
    navigate("/login");
  };

  const navLinks = [
    { label: s.dashboard, to: "/", active: location.pathname === "/" },
    { label: s.correlation, to: `/cases/${activeCaseId}/graph`, active: location.pathname.includes("/graph") },
    { label: s.reports, to: `/cases/${activeCaseId}/reports`, active: location.pathname.includes("/reports") },
  ];

  return (
    <header>
      <StandardUtilityBar />

      <div className="std-identity">
        <div className="std-container std-identity__inner">
          <StandardBranding to="/" />

          <div className="std-identity__tools">
            <div className="std-search" ref={searchRef}>
              <form role="search" onSubmit={handleSearchSubmit}>
                <label htmlFor="std-case-search" className="std-visually-hidden">
                  {s.searchLabel}
                </label>
                <div className="std-search__row">
                  <div className="std-search__field">
                    <Search className="std-search__icon" aria-hidden="true" size={16} />
                    <input
                      id="std-case-search"
                      type="search"
                      className="std-input"
                      autoComplete="off"
                      placeholder={s.searchPlaceholder}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onFocus={() => {
                        if (results.length > 0) setOpen(true);
                      }}
                    />
                  </div>
                  <button type="submit" className="std-btn">
                    {s.searchBtn}
                  </button>
                </div>
              </form>

              {open && (
                <div className="std-search__results">
                  <h3>
                    {s.matchingCases} ({results.length})
                  </h3>
                  {results.length === 0 ? (
                    <div className="std-search__empty">{s.noResults}</div>
                  ) : (
                    <ul>
                      {results.map((c) => (
                        <li key={c.id}>
                          <button type="button" className="std-search__item" onClick={() => openCase(c)}>
                            <span className="std-search__primary">
                              <span className="std-id">{c.case_number}</span> — {c.victim_name}
                            </span>
                            <span className="std-search__secondary">
                              {c.district || s.districtPending} · {scamLabel(c.scam_type, language)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="std-identity__user">
              <div className="std-officer">
                <span className="std-officer__avatar" aria-hidden="true">{initials || "IO"}</span>
                <div className="std-officer__text">
                  <div className="std-officer__name">{officerName}</div>
                  {(officer.badge_id || officer.station_name) && (
                    <div className="std-officer__meta">
                      {officer.badge_id ? (
                        <>
                          {s.badge}: <span className="std-mono">{officer.badge_id}</span>
                        </>
                      ) : null}
                      {officer.badge_id && officer.station_name ? " · " : null}
                      {officer.station_name || null}
                    </div>
                  )}
                </div>
              </div>

              <button type="button" className="std-btn std-btn--secondary std-btn--sm" onClick={handleSignOut}>
                <LogOut aria-hidden="true" size={14} />
                {s.signOut}
              </button>
            </div>
          </div>
        </div>
      </div>

      <nav className="std-nav" aria-label={s.mainNav}>
        <div className="std-container std-nav__inner">
          <ul className="std-nav__list">
            {navLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="std-nav__link" aria-current={link.active ? "page" : undefined}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="std-nav__action">
            <button type="button" className="std-btn std-btn--ondark std-btn--sm" onClick={onOpenNewInvestigation}>
              <Plus aria-hidden="true" size={15} />
              {s.registerCase}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
