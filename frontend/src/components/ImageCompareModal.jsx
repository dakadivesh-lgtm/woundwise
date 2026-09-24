import React from 'react';
import { getImageUrl } from '../services/api';

export default function ImageCompareModal({ isOpen, onClose, entryA, entryB }) {
  if (!isOpen || !entryA || !entryB) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="camera-modal-overlay" role="dialog" aria-modal="true" aria-label="Wound Photo Comparison">
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: 'var(--radius-lg)',
        width: '90%',
        maxWidth: '860px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        boxShadow: 'var(--shadow-modal)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Wound Progression Comparison
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Compare healing changes side-by-side
            </p>
          </div>
          <button className="btn-outline" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="compare-grid">
          {/* Baseline Entry */}
          <div className="compare-card">
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--blue)', marginBottom: 6 }}>
              {entryA.is_followup ? 'Earlier Entry' : 'Baseline Photo'} · {formatDate(entryA.entry_date || entryA.created_at)}
            </div>
            <img 
              src={getImageUrl(entryA.image_filename)} 
              alt="Earlier Entry" 
              className="compare-img"
            />
            <div style={{ marginTop: 10, textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>Notes:</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {entryA.notes || 'No notes entered for this date.'}
              </div>
            </div>
          </div>

          {/* Follow-up Entry */}
          <div className="compare-card">
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--teal)', marginBottom: 6 }}>
              Follow-up Photo · {formatDate(entryB.entry_date || entryB.created_at)}
            </div>
            <img 
              src={getImageUrl(entryB.image_filename)} 
              alt="Follow-up Entry" 
              className="compare-img"
            />
            <div style={{ marginTop: 10, textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>Notes:</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {entryB.notes || 'No notes entered for this date.'}
              </div>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 20,
          background: 'var(--blue-light)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12.5px',
          color: 'var(--text-secondary)'
        }}>
          💡 <strong>Clinical Observation Tip:</strong> Look for changes in wound margins, reduction in surrounding erythema (redness), exudate volume, and epithelial tissue advance. Consult your clinician for medical evaluation.
        </div>
      </div>
    </div>
  );
}
