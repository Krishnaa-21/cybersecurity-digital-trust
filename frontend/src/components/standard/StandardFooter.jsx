import React from "react";
import { ArrowUp, ExternalLink } from "lucide-react";
import { PORTAL, pick, t } from "../../config/standardPortal";
import { useMode } from "../../context/ModeContext";
import { BrandMark } from "./StandardBranding";

/**
 * Portal footer: brand block, related portals, statutory references,
 * helplines, and a base bar with the advisory notice, copyright and
 * back-to-top control. Everything aligns to the shared page container.
 */
export default function StandardFooter() {
  const { language } = useMode();
  const s = t(language);
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
          {PORTAL.helpdesk ? <p>{language === "hi" ? "हेल्पडेस्क:" : "Helpdesk:"} {PORTAL.helpdesk}</p> : null}
        </section>

        <nav aria-labelledby="std-footer-portals">
          <h2 id="std-footer-portals">{s.footerRelatedPortals}</h2>
          <ul>
            {s.footerPortals.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  <span>{l.label}</span>
                  <ExternalLink className="std-footer__ext" aria-hidden="true" size={13} />
                  <span className="std-visually-hidden"> {s.opensInNewTab}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="std-footer-statutes">
          <h2 id="std-footer-statutes">{s.footerStatutoryReferences}</h2>
          <ul>
            {s.footerStatutes.map((statute) => (
              <li key={statute}>{statute}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="std-footer-helplines">
          <h2 id="std-footer-helplines">{s.footerHelplines}</h2>
          <p className="std-footer__helpline">
            <strong>{s.footerHelplineNumber}</strong>
            <span>{s.footerHelplineDesc}</span>
          </p>
          <p>{s.footerCitizenComplaints}</p>
        </section>
      </div>

      <div className="std-footer__base">
        <div className="std-container">
          <p className="std-footer__notice">
            <strong>{s.footerAdvisoryNoticeTitle}</strong> {s.footerAdvisoryNoticeBody}
          </p>
          <div className="std-footer__legal">
            <span>
              {s.footerCopyright.replace("{year}", year)}
            </span>
            <button
              type="button"
              className="std-footer__top"
              onClick={() => window.scrollTo({ top: 0 })}
            >
              <ArrowUp aria-hidden="true" size={14} />
              {s.footerBackToTop}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
