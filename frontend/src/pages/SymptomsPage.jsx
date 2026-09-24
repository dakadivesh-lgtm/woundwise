import React, { useState } from 'react';

const ALL_SYMPTOMS = [
  { id: 1, text: 'Snakebite.', urgent: true },
  { id: 2, text: 'Animal bite.', urgent: true },
  { id: 3, text: 'Deep or dirty wound with an outdated or unknown tetanus vaccination.', urgent: true },
  { id: 4, text: 'Fever with redness that is spreading.', urgent: true },
  { id: 5, text: 'Pus, bad smell, or pain that keeps getting worse.', urgent: true },
  { id: 6, text: 'A foot wound in someone with diabetes.', urgent: true },
  { id: 7, text: 'Bleeding that won\'t stop, dizziness, or fainting.', urgent: true },
  { id: 8, text: 'Wound getting worse after 2–3 days.', urgent: false }
];

const PROCESSING_STAGES = [
  { id: 1, title: 'Loading your completed photo assessment', progress: 16 },
  { id: 2, title: 'Reviewing your confirmed symptoms', progress: 33 },
  { id: 3, title: 'Checking urgent warning signs', progress: 50 },
  { id: 4, title: 'Combining assessment information', progress: 66 },
  { id: 5, title: 'Preparing next-step guidance', progress: 83 },
  { id: 6, title: 'Getting your results ready', progress: 100 }
];

export default function SymptomsPage({ assessmentPayload, onComplete, onNavigate }) {
  // excludedIds = symptoms the patient DOES NOT HAVE
  // User clicks to cross out (exclude) a symptom
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  const toggleExcluded = (id) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const startProcessing = () => {
    setIsProcessing(true);
    setCurrentStageIndex(0);
    setProgressPct(16);

    let stage = 0;
    const interval = setInterval(() => {
      stage += 1;
      if (stage < PROCESSING_STAGES.length) {
        setCurrentStageIndex(stage);
        setProgressPct(PROCESSING_STAGES[stage].progress);
      } else {
        clearInterval(interval);
        // Complete and advance
        setTimeout(() => {
          // Confirmed symptoms are those NOT excluded
          const confirmedSymptoms = ALL_SYMPTOMS.filter(s => !excludedIds.has(s.id));
          onComplete({
            ...assessmentPayload,
            confirmedSymptoms,
            hasUrgentFlags: confirmedSymptoms.some(s => s.urgent)
          });
        }, 600);
      }
    }, 750);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }}>
      {!isProcessing ? (
        /* Symptom Checklist Card */
        <div className="symptom-card">
          <div className="symptom-status-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Photo analysis complete</span>
          </div>

          <h2 className="symptom-heading">Check your symptoms</h2>
          <p className="symptom-instructions">
            Cross out anything that does not apply to you. Leave symptoms you have unchanged.
          </p>

          <div className="symptom-list" role="group" aria-label="Symptom review list">
            {ALL_SYMPTOMS.map((sym) => {
              const isExcluded = excludedIds.has(sym.id);
              return (
                <div
                  key={sym.id}
                  className={`symptom-row ${isExcluded ? 'is-excluded' : ''}`}
                  onClick={() => toggleExcluded(sym.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="symptom-text">{sym.text}</span>
                  <button
                    type="button"
                    className="symptom-toggle-btn"
                    aria-pressed={!isExcluded}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExcluded(sym.id);
                    }}
                  >
                    <span className="symptom-circle" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          <p className="symptom-footer-note">Continuing confirms that you have reviewed every symptom.</p>

          <button
            type="button"
            className="btn-confirm-symptoms"
            onClick={startProcessing}
          >
            Confirm symptoms and view result
          </button>
        </div>
      ) : (
        /* 6-Stage Health Track Processing Card */
        <div className="processing-card" role="region" aria-label="Health Track Analysis" style={{ display: 'block' }}>
          <div className="processing-header">
            <div className="processing-loader-box" aria-hidden="true">
              <div className="processing-spinner"></div>
            </div>
            <div className="processing-header-text">
              <span className="processing-brand-label">HEALTH TRACK ANALYSIS</span>
              <h2 className="processing-heading">Preparing your wound assessment</h2>
              <p className="processing-supporting-text">
                Reviewing your photo assessment and confirmed symptoms to prepare next-step guidance.
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="processing-progress-track">
            <div
              className="processing-progress-fill"
              style={{ width: `${progressPct}%`, transition: 'width 0.6s ease' }}
            />
          </div>

          {/* Sequential Stages List */}
          <div className="processing-stages-list">
            {PROCESSING_STAGES.map((stg, idx) => {
              const isPast    = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;

              let rowClass = 'stage-pending';
              if (isCurrent) rowClass = 'stage-running';
              if (isPast)    rowClass = 'stage-completed';

              return (
                <div key={stg.id} className={`stage-row ${rowClass}`}>
                  <span className="stage-icon-container">
                    {isPast && (
                      <span className="stage-icon-completed">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9"/>
                          <polyline points="9 12 11 14 15 10"/>
                        </svg>
                      </span>
                    )}
                    {isCurrent && <span className="stage-icon-running" />}
                    {!isPast && !isCurrent && <span className="stage-icon-pending" />}
                  </span>
                  <span className="stage-label">{stg.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
