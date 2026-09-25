import React, { useState } from 'react';
import { woundService } from '../services/woundService';

const PROCESSING_STAGES = [
  { id: 1, title: 'Loading your completed photo assessment', progress: 16 },
  { id: 2, title: 'Reviewing your confirmed symptoms', progress: 33 },
  { id: 3, title: 'Evaluating safety rule engine', progress: 50 },
  { id: 4, title: 'Calculating longitudinal progression', progress: 66 },
  { id: 5, title: 'Preparing next-step guidance', progress: 83 },
  { id: 6, title: 'Getting your results ready', progress: 100 }
];

export default function SymptomsPage({ assessmentPayload, onComplete, onNavigate }) {
  // Explicit symptom states with safe default values (No / 0 / None)
  const [painScore, setPainScore] = useState(4);
  const [fever, setFever] = useState(false);
  const [rednessStatus, setRednessStatus] = useState('Normal'); // 'Normal', 'Slightly Increased', 'Spreading'
  const [discharge, setDischarge] = useState(false);
  const [badSmell, setBadSmell] = useState(false);
  const [worseningPain, setWorseningPain] = useState(false);
  const [swellingLevel, setSwellingLevel] = useState('Mild'); // 'None', 'Mild', 'Moderate', 'Severe'
  const [bleedingUncontrolled, setBleedingUncontrolled] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [footWound, setFootWound] = useState(false);
  const [animalBite, setAnimalBite] = useState(false);
  const [snakeBite, setSnakeBite] = useState(false);
  const [tetanusConcern, setTetanusConcern] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  const startProcessing = async () => {
    setIsProcessing(true);
    setCurrentStageIndex(0);
    setProgressPct(16);

    const symptomData = {
      painScore: Number(painScore),
      pain_score: Number(painScore),
      fever,
      rednessStatus,
      redness_status: rednessStatus,
      discharge,
      badSmell,
      bad_smell: badSmell,
      worseningPain,
      worsening_pain: worseningPain,
      swellingLevel,
      swelling_level: swellingLevel,
      bleedingUncontrolled,
      bleeding_uncontrolled: bleedingUncontrolled,
      diabetes,
      footWound,
      foot_wound: footWound,
      animalBite,
      animal_bite: animalBite,
      snakeBite,
      snake_bite: snakeBite,
      tetanusConcern,
      tetanus_concern: tetanusConcern
    };

    // Save symptoms against backend if entry ID exists
    const entryId = assessmentPayload?.entry?.id || assessmentPayload?.entryId;
    if (entryId) {
      try {
        await woundService.updateSymptoms(entryId, symptomData);
      } catch (err) {
        console.warn('Could not persist symptoms directly:', err.message);
      }
    }

    let stage = 0;
    const interval = setInterval(() => {
      stage += 1;
      if (stage < PROCESSING_STAGES.length) {
        setCurrentStageIndex(stage);
        setProgressPct(PROCESSING_STAGES[stage].progress);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          const hasUrgentFlags = Boolean(
            snakeBite || animalBite || bleedingUncontrolled ||
            (fever && rednessStatus === 'Spreading') ||
            (discharge && worseningPain) || (badSmell && worseningPain) ||
            (diabetes && footWound) || tetanusConcern
          );

          onComplete({
            ...assessmentPayload,
            symptomData,
            hasUrgentFlags
          });
        }, 500);
      }
    }, 550);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px' }}>
      {!isProcessing ? (
        <div className="symptom-card" style={{ maxWidth: '640px', width: '100%' }}>
          <div className="symptom-status-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Photo analysis complete</span>
          </div>

          <h2 className="symptom-heading">Patient Symptom Check</h2>
          <p className="symptom-instructions">
            Please answer these explicit questions to help us evaluate safety and tracking.
          </p>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }} onSubmit={(e) => { e.preventDefault(); startProcessing(); }}>
            {/* 1. Pain Score */}
            <div style={{ background: '#F8FAF9', border: '1px solid #E2E8E3', borderRadius: '12px', padding: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, color: '#153C2E', marginBottom: '8px' }}>
                Current Pain Level (0 — 10): <span style={{ color: '#2563EB', fontWeight: 700 }}>{painScore} / 10</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={painScore}
                onChange={(e) => setPainScore(e.target.value)}
                style={{ width: '100%', accentColor: '#2563EB' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                <span>0 (No pain)</span>
                <span>5 (Moderate)</span>
                <span>10 (Severe)</span>
              </div>
            </div>

            {/* 2. Swelling Level */}
            <div style={{ background: '#F8FAF9', border: '1px solid #E2E8E3', borderRadius: '12px', padding: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, color: '#153C2E', marginBottom: '10px' }}>
                Swelling Level around wound area:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {['None', 'Mild', 'Moderate', 'Severe'].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSwellingLevel(lvl)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: swellingLevel === lvl ? '2px solid #2563EB' : '1px solid #CBD5E1',
                      background: swellingLevel === lvl ? '#EFF6FF' : '#FFFFFF',
                      color: swellingLevel === lvl ? '#1E40AF' : '#334155',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Redness Spreading */}
            <div style={{ background: '#F8FAF9', border: '1px solid #E2E8E3', borderRadius: '12px', padding: '16px' }}>
              <label style={{ display: 'block', fontWeight: 600, color: '#153C2E', marginBottom: '10px' }}>
                Is redness spreading beyond the wound edge?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { label: 'No (Normal)', val: 'Normal' },
                  { label: 'Slightly Increased', val: 'Slightly Increased' },
                  { label: 'Spreading', val: 'Spreading' }
                ].map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setRednessStatus(opt.val)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      border: rednessStatus === opt.val ? '2px solid #2563EB' : '1px solid #CBD5E1',
                      background: rednessStatus === opt.val ? '#EFF6FF' : '#FFFFFF',
                      color: rednessStatus === opt.val ? '#1E40AF' : '#334155',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '12.5px'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Yes/No Question Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Do you have a fever?', state: fever, setter: setFever },
                { label: 'Is there pus or discharge?', state: discharge, setter: setDischarge },
                { label: 'Is there a bad smell?', state: badSmell, setter: setBadSmell },
                { label: 'Is pain getting worse?', state: worseningPain, setter: setWorseningPain },
                { label: 'Is bleeding difficult to stop?', state: bleedingUncontrolled, setter: setBleedingUncontrolled },
                { label: 'Do you have diabetes?', state: diabetes, setter: setDiabetes },
                { label: 'Is this wound on the foot?', state: footWound, setter: setFootWound },
                { label: 'Was it caused by an animal bite?', state: animalBite, setter: setAnimalBite },
                { label: 'Was it caused by a snake bite?', state: snakeBite, setter: setSnakeBite },
                { label: 'Tetanus concern (deep/dirty)?', state: tetanusConcern, setter: setTetanusConcern }
              ].map((q, idx) => (
                <div key={idx} style={{ background: '#F8FAF9', border: '1px solid #E2E8E3', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#153C2E', marginBottom: '8px' }}>{q.label}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => q.setter(true)}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: '6px',
                        border: q.state === true ? '2px solid #DC2626' : '1px solid #CBD5E1',
                        background: q.state === true ? '#FEF2F2' : '#FFFFFF',
                        color: q.state === true ? '#991B1B' : '#334155',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => q.setter(false)}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: '6px',
                        border: q.state === false ? '2px solid #2563EB' : '1px solid #CBD5E1',
                        background: q.state === false ? '#EFF6FF' : '#FFFFFF',
                        color: q.state === false ? '#1E40AF' : '#334155',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="btn-confirm-symptoms"
              style={{ marginTop: '10px' }}
            >
              Confirm symptoms & calculate results
            </button>
          </form>
        </div>
      ) : (
        /* Health Track Processing Card */
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

          <div className="processing-progress-track">
            <div
              className="processing-progress-fill"
              style={{ width: `${progressPct}%`, transition: 'width 0.6s ease' }}
            />
          </div>

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
