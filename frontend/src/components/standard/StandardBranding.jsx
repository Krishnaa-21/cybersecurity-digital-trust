import React from "react";
import { Link } from "react-router-dom";
import { useMode } from "../../context/ModeContext";
import { PORTAL, pick } from "../../config/standardPortal";

/** TraceX logo mark. Decorative when paired with the visible app name. */
export function BrandMark({ className = "" }) {
  return <img className={`std-emblem ${className}`.trim()} src={PORTAL.logoSrc} alt="" width="48" height="48" draggable={false} />;
}

/** Logo + app name + portal title block (links to the dashboard / login). */
export default function StandardBranding({ to = "/" }) {
  const { language } = useMode();
  return (
    <Link to={to} className="std-brand">
      <BrandMark />
      <span className="std-brand__text">
        <span className="std-brand__name">{PORTAL.portalName}</span>
        <span className="std-brand__sub">{pick(PORTAL.portalTitle, language)}</span>
      </span>
    </Link>
  );
}
