import React from "react";
import { ArrowUp, ExternalLink } from "lucide-react";
import { PORTAL, pick } from "../../config/standardPortal";
import { useMode } from "../../context/ModeContext";
import { BrandMark } from "./StandardBranding";

const RELATED = [
  { label: "National Cyber Crime Reporting Portal", href: "https://cybercrime.gov.in" },
  { label: "Indian Cyber Crime Coordination Centre (I4C)", href: "https://i4c.mha.gov.in" },
  { label: "CERT-In — Indian Computer Emergency Response Team", href: "https://www.cert-in.org.in" },
];

const STATUTES = [
  "Information Technology Act, 2000 — Sections 66C, 66D and 69A",
  "Indian Evidence Act — Section 65B certification",
  "Section 91 CrPC — production of documents / debit-freeze directions",
];

/**
 * Portal footer: brand block, related portals, statutory references,
 * helplines, and a base bar with the advisory notice, copyright and
 * back-to-top control. Everything aligns to the shared page container.
 */
export default function StandardFooter() {
  const { language } = useMode();
  const year = new Date().getFullYear();

  return (
    <footer className="std-footer">
      <div className="std-container std-footer__grid">
        <section className="std-footer__brand" aria-label={PORTAL.portalName}>
          <div className="std-footer__logo">
            <BrandMark />
            <span className="std-footer__name">{PORTAL.portalName}</span>
          </div>
          <p>{pick(PORTAL.portalTitle, language)}</p>
          {PORTAL.officeAddress ? <p>{PORTAL.officeAddress}</p> : null}
          {PORTAL.helpdesk ? <p>Helpdesk: {PORTAL.helpdesk}</p> : null}
        </section>

        <nav aria-labelledby="std-footer-portals">
          <h2 id="std-footer-portals">Related Portals</h2>
          <ul>
            {RELATED.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  <span>{l.label}</span>
                  <ExternalLink className="std-footer__ext" aria-hidden="true" size={13} />
                  <span className="std-visually-hidden"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="std-footer-statutes">
          <h2 id="std-footer-statutes">Statutory References</h2>
          <ul>
            {STATUTES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="std-footer-helplines">
          <h2 id="std-footer-helplines">Helplines</h2>
          <p className="std-footer__helpline">
            <strong>1930</strong>
            <span>National Cyber Crime Helpline (toll free)</span>
          </p>
          <p>Citizen complaints: cybercrime.gov.in</p>
        </section>
      </div>

      <div className="std-footer__base">
        <div className="std-container">
          <p className="std-footer__notice">
            <strong>Advisory notice:</strong> {PORTAL.portalName} is an investigative decision-support system for authorised officers.
            Risk ratings, correlation scores and AI-generated narratives are advisory and must be verified by the Investigating Officer
            before any legal action is initiated. Access is restricted, logged and monitored; unauthorised access or misuse is
            punishable under applicable law.
          </p>
          <div className="std-footer__legal">
            <span>
              © {year} {PORTAL.portalName}. All rights reserved.
            </span>
            <button
              type="button"
              className="std-footer__top"
              onClick={() => window.scrollTo({ top: 0 })}
            >
              <ArrowUp aria-hidden="true" size={14} />
              Back to top
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
