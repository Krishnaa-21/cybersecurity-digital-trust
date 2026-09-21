import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, setToken, setOfficer } from "../../api/client";
import { useMode } from "../../context/ModeContext";
import { t } from "../../config/standardPortal";
import StandardUtilityBar from "./StandardUtilityBar";
import StandardBranding from "./StandardBranding";
import StandardFooter from "./StandardFooter";
import { Notice } from "./StandardUI";

/** Standard Mode sign-in page. Same credentials flow as the Analysis Mode login. */
export default function StandardLogin() {
  const navigate = useNavigate();
  const { language } = useMode();
  const s = t(language);

  const [badgeId, setBadgeId] = useState("MP-IO-4471");
  const [password, setPassword] = useState("demo1234");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!badgeId.trim() || !password.trim()) {
      setError(s.loginEmptyError);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.post("auth/login", { badge_id: badgeId.trim(), password: password.trim() });
      if (data.access_token) {
        setToken(data.access_token);
        if (data.officer) setOfficer(data.officer);
        navigate("/", { replace: true });
      } else {
        throw new Error(s.loginDefaultError);
      }
    } catch (err) {
      let msg = err.message || s.loginDefaultError;
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || err.name === "TypeError") {
        msg = s.loginNetworkError;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="std-shell">
      <a className="std-skip" href="#std-main">{s.skip}</a>
      <StandardUtilityBar />
      <div className="std-identity">
        <div className="std-container std-identity__inner">
          <StandardBranding to="/login" />
        </div>
      </div>

      <main id="std-main" tabIndex={-1} className="std-main">
        <div className="std-container">
          <div className="std-pagehead">
            <div>
              <h1>{s.loginTitle}</h1>
              <p>{s.loginSub}</p>
            </div>
          </div>

          <div className="std-login">
            <section className="std-panel" aria-labelledby="std-notice-title">
              <div className="std-panel__head">
                <h2 className="std-panel__title" id="std-notice-title">{s.loginNoticeTitle}</h2>
              </div>
              <div className="std-panel__body">
                <ul className="std-list">
                  {s.loginNoticeList.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="std-panel std-login__signin" aria-labelledby="std-login-title">
              <div className="std-panel__head">
                <h2 className="std-panel__title" id="std-login-title">{s.loginPanelTitle}</h2>
              </div>
              <form className="std-panel__body" onSubmit={handleSubmit} noValidate>
                {error && <Notice tone="danger" inline title={s.loginFailedTitle}>{error}</Notice>}
                <div className="std-field">
                  <label className="std-label" htmlFor="std-badge">{s.loginOfficerIdLabel}</label>
                  <input id="std-badge" className="std-input std-mono" autoComplete="username" value={badgeId} onChange={(e) => setBadgeId(e.target.value)} />
                </div>
                <div className="std-field">
                  <label className="std-label" htmlFor="std-password">{s.loginPasswordLabel}</label>
                  <input id="std-password" type="password" className="std-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <button type="submit" className="std-btn" disabled={isLoading}>
                  {isLoading ? s.loginAuthenticating : s.loginSubmit}
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>

      <StandardFooter />
    </div>
  );
}
