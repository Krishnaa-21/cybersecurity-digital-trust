import React from "react";
import { useParams } from "react-router-dom";

export default function Graph() {
  const { caseId } = useParams();

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-3">
        <h2 className="text-[16px] font-semibold text-text">
          Entity Correlation Graph <span className="font-mono text-accent">#{caseId}</span>
        </h2>
        <p className="text-[12px] text-textDim mt-0.5">
          Interactive multi-hop node visualization showing linked identifiers and confidence scores.
        </p>
      </div>
      <div className="py-12 text-center text-textDim text-[13px]">
        Graph canvas and node inspector will be mounted here.
      </div>
    </div>
  );
}
