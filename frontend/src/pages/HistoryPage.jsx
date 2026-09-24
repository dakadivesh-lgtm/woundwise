import React, { useState, useEffect } from 'react';
import ImageCompareModal from '../components/ImageCompareModal';
import { woundService } from '../services/woundService';
import { getImageUrl } from '../services/api';

export default function HistoryPage({ onNavigate, onShowNotification, targetWoundId }) {
  const [wounds, setWounds] = useState([]);
  const [selectedWoundId, setSelectedWoundId] = useState(targetWoundId || null);
  const [woundDetail, setWoundDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // Comparison State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareEntryA, setCompareEntryA] = useState(null);
  const [compareEntryB, setCompareEntryB] = useState(null);

  useEffect(() => {
    loadWounds();
  }, []);

  useEffect(() => {
    if (selectedWoundId) {
      loadWoundTimeline(selectedWoundId);
    }
  }, [selectedWoundId]);

  const loadWounds = async () => {
    try {
      setLoading(true);
      const data = await woundService.getWounds();
      setWounds(data || []);

      if (data && data.length > 0) {
        const initialId = targetWoundId && data.find(w => w.id === targetWoundId)
          ? targetWoundId
          : data[0].id;
        setSelectedWoundId(initialId);
      }
    } catch (err) {
      console.error('Failed to load wounds for history:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWoundTimeline = async (id) => {
    try {
      const data = await woundService.getWoundDetail(id);
      setWoundDetail(data);

      // Default comparison if 2+ entries exist
      if (data.timeline && data.timeline.length >= 2) {
        setCompareEntryA(data.timeline[0]);
        setCompareEntryB(data.timeline[data.timeline.length - 1]);
      } else {
        setCompareEntryA(null);
        setCompareEntryB(null);
      }
    } catch (err) {
      console.error('Failed to load wound details:', err);
    }
  };

  const handleLaunchCompare = () => {
    if (!woundDetail?.timeline || woundDetail.timeline.length < 2) {
      onShowNotification('You need at least 2 photos recorded for this wound to compare changes over time.', 'info');
      return;
    }
    setCompareModalOpen(true);
  };

  return (
    <section className="page-body">
      <div className="greeting-block">
        <h2 className="greeting-title">History Tracker</h2>
        <p className="greeting-sub">Monitor wound progression over time with dated photos and assessments.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading history records...</p>
        </div>
      ) : wounds.length === 0 ? (
        <div className="no-tests-card" style={{ marginTop: 20 }}>
          <h3 className="no-tests-title">No Wound History Yet</h3>
          <p className="no-tests-desc">Upload your first wound photo to begin tracking healing history.</p>
          <button className="btn-primary" onClick={() => onNavigate('upload')}>
            Upload First Wound
          </button>
        </div>
      ) : (
        <>
          {/* Wound Selector Toolbar */}
          <div className="records-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 600, fontSize: '13px' }}>Select Wound Case:</label>
              <select 
                className="form-select" 
                style={{ width: 'auto', minWidth: 260 }}
                value={selectedWoundId || ''}
                onChange={(e) => setSelectedWoundId(e.target.value)}
              >
                {wounds.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title} — {w.location} ({w.entryCount || 0} entries)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                className="btn-outline" 
                onClick={handleLaunchCompare}
                disabled={!woundDetail?.timeline || woundDetail.timeline.length < 2}
              >
                🔍 Compare Photos
              </button>
              <button 
                className="btn-primary" 
                onClick={() => onNavigate('upload', { initialWoundId: selectedWoundId })}
              >
                + Add Follow-up Photo
              </button>
            </div>
          </div>

          {/* Wound Summary Banner */}
          {woundDetail?.wound && (
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginRight: 10 }}>
                  {woundDetail.wound.title}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  📍 {woundDetail.wound.location}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="wound-badge wound-badge--active">
                  {woundDetail.timeline?.length || 0} Total Photo Entries
                </span>
              </div>
            </div>
          )}

          {/* Timeline of Dated Photos */}
          <div className="timeline-container">
            {woundDetail?.timeline?.map((entry, index) => {
              const dateFormatted = new Date(entry.entry_date || entry.created_at).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              const isFirst = index === 0;
              const isLatest = index === woundDetail.timeline.length - 1;

              return (
                <div key={entry.id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-card">
                    <img 
                      src={getImageUrl(entry.image_filename)} 
                      alt={`Wound check ${index + 1}`} 
                      className="timeline-thumb" 
                    />

                    <div className="timeline-info">
                      <div className="timeline-date">{dateFormatted}</div>
                      <h4 className="timeline-title">
                        {isFirst ? 'Baseline Wound Check' : `Follow-up Check #${index}`}
                        {isLatest && index > 0 && ' (Latest)'}
                      </h4>

                      <div className="timeline-notes">
                        {entry.notes || 'No observational notes logged for this entry.'}
                      </div>

                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="timeline-badge">
                          Assessment: {entry.assessment_summary || 'Analysis not configured'}
                        </span>

                        <button 
                          className="btn-outline" 
                          style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--blue)' }}
                          onClick={() => {
                            onNavigate('result', {
                              woundId: woundDetail.wound.id,
                              woundTitle: woundDetail.wound.title,
                              imageFilename: entry.image_filename,
                              entryDate: entry.entry_date || entry.created_at,
                              notes: entry.notes,
                              assessmentSummary: entry.assessment_summary
                            });
                          }}
                        >
                          👁️ View Health Result
                        </button>

                        <button 
                          className="btn-outline" 
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => {
                            setCompareEntryA(woundDetail.timeline[0]);
                            setCompareEntryB(entry);
                            setCompareModalOpen(true);
                          }}
                          disabled={woundDetail.timeline.length < 2}
                        >
                          Compare with Baseline
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison Modal */}
          <ImageCompareModal 
            isOpen={compareModalOpen} 
            onClose={() => setCompareModalOpen(false)} 
            entryA={compareEntryA} 
            entryB={compareEntryB} 
          />
        </>
      )}
    </section>
  );
}
