import React from 'react';

export default function QualityCheckPanel({ qualityMetrics }) {
  if (!qualityMetrics) return null;

  return (
    <div className="quality-panel">
      <div className="quality-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        Image Quality Assessment
      </div>

      <div className="quality-grid">
        <div className="quality-item">
          <span>📐 Resolution:</span>
          <span className={qualityMetrics.resolutionOk ? 'quality-icon--ok' : 'quality-icon--warn'}>
            {qualityMetrics.resolutionOk ? '✓ Optimal' : '⚠ Low Res'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ({qualityMetrics.width}×{qualityMetrics.height}px)
          </span>
        </div>

        <div className="quality-item">
          <span>🔍 Sharpness:</span>
          <span className={qualityMetrics.sharp ? 'quality-icon--ok' : 'quality-icon--warn'}>
            {qualityMetrics.sharp ? '✓ Clear focus' : '⚠ Slight blur'}
          </span>
        </div>

        <div className="quality-item">
          <span>💡 Lighting:</span>
          <span className={qualityMetrics.lightingOk ? 'quality-icon--ok' : 'quality-icon--warn'}>
            {qualityMetrics.lightingOk ? '✓ Balanced' : qualityMetrics.tooDark ? '⚠ Too dark' : '⚠ Too bright'}
          </span>
        </div>
      </div>
    </div>
  );
}
