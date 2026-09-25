import React, { useRef, useState, useEffect } from 'react';
import { woundService } from '../services/woundService';

// A simple 2D geometry helper to calculate polygon area
function getPolygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

// Real image quality validation using canvas pixel data (no random values)
function validateImageQuality(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  const issues = [];
  let lumSum = 0;
  let edgeScore = 0;
  let prevRow = null;

  for (let y = 0; y < h; y += 4) {
    const row = [];
    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      lumSum += lum;
      row.push(lum);
    }
    if (prevRow) {
      for (let k = 0; k < row.length; k++) edgeScore += Math.abs(row[k] - prevRow[k]);
    }
    prevRow = row;
  }

  const totalSamples = Math.floor(w / 4) * Math.floor(h / 4);
  const meanLum = lumSum / totalSamples;
  const meanEdge = edgeScore / totalSamples;

  if (meanLum < 40)  issues.push('poor lighting (too dark)');
  if (meanLum > 225) issues.push('overexposed');
  if (meanEdge < 3)  issues.push('blur detected');
  if (w < 200 || h < 200) issues.push('low resolution');

  const confidence = issues.length === 0 ? 'high'
    : issues.length === 1 ? 'medium'
    : 'poor';

  return { valid: confidence !== 'poor', issues, confidence };
}

// Heuristic color-cluster segmentation — works on ANY wound photo
// Uses redness + darkness scoring then ray-marches from weighted centroid
function segmentWound(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Assessment ROI: centre 55% of image (NOT full image as denominator)
  const roiX = Math.round(W * 0.225);
  const roiY = Math.round(H * 0.225);
  const roiW = Math.round(W * 0.55);
  const roiH = Math.round(H * 0.55);

  const data = ctx.getImageData(roiX, roiY, roiW, roiH).data;
  const scores = new Float32Array(roiW * roiH);
  let totalScore = 0, weightedX = 0, weightedY = 0;

  for (let py = 0; py < roiH; py++) {
    for (let px = 0; px < roiW; px++) {
      const i = (py * roiW + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const redness = r > 0 ? (r - (g + b) / 2) / 255 : 0;
      const darkness = 1 - lum / 255;
      const score = Math.max(0, redness * 0.6 + darkness * 0.4 - 0.05);
      scores[py * roiW + px] = score;
      totalScore += score;
      weightedX += px * score;
      weightedY += py * score;
    }
  }

  const cx = totalScore > 0 ? weightedX / totalScore : roiW / 2;
  const cy = totalScore > 0 ? weightedY / totalScore : roiH / 2;

  const NUM_RAYS = 12;
  const threshold = 0.12;
  const boundary = [];

  for (let a = 0; a < NUM_RAYS; a++) {
    const angle = (a / NUM_RAYS) * Math.PI * 2;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let lastGoodR = 0;

    for (let r = 0; r < Math.min(roiW, roiH) * 0.5; r += 1) {
      const sx = Math.round(cx + dx * r);
      const sy = Math.round(cy + dy * r);
      if (sx < 0 || sx >= roiW || sy < 0 || sy >= roiH) break;
      if (scores[sy * roiW + sx] >= threshold) lastGoodR = r;
      else if (r > lastGoodR + 12) break;
    }

    const radius = Math.max(lastGoodR, Math.min(roiW, roiH) * 0.08);
    boundary.push({
      x: roiX + cx + Math.cos(angle) * radius,
      y: roiY + cy + Math.sin(angle) * radius
    });
  }

  let woundPixCount = 0;
  for (let i = 0; i < scores.length; i++) if (scores[i] >= threshold) woundPixCount++;
  const woundFraction = woundPixCount / (roiW * roiH);
  const segConfidence = woundFraction > 0.05 ? 'good' : woundFraction > 0.01 ? 'low' : 'none';

  return { roi: { x: roiX, y: roiY, w: roiW, h: roiH }, boundary, segConfidence, woundFraction };
}

export default function WoundSegmentationEditor({ imageUrl, initialData, onSave, onCancel }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const offscreenRef = useRef(null); // hidden canvas for pixel analysis

  const [isLoaded, setIsLoaded] = useState(false);
  const [quality, setQuality] = useState({ valid: true, issues: [], confidence: 'high' });
  const [segConfidence, setSegConfidence] = useState('good');
  const [roi, setRoi] = useState({ x: 10, y: 10, w: 100, h: 100 });
  const [boundary, setBoundary] = useState([]);
  
  // Scale marker state
  const [hasScaleMarker, setHasScaleMarker] = useState(false);
  const [scaleLine, setScaleLine] = useState({ p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 }, physicalLength: 2 }); // 2cm default

  // Interaction state
  const [draggingItem, setDraggingItem] = useState(null); // { type: 'boundary'|'roi'|'scale', index: number }

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      // Build offscreen canvas (capped at 1080px wide) for all pixel analysis
      const maxW = 1080;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const offW = Math.round(img.width * scale);
      const offH = Math.round(img.height * scale);
      const off = document.createElement('canvas');
      off.width = offW;
      off.height = offH;
      off.getContext('2d').drawImage(img, 0, 0, offW, offH);
      offscreenRef.current = off;

      // Real quality check from pixel data
      const q = validateImageQuality(off);
      setQuality(q);

      if (initialData && initialData.roi && initialData.boundary) {
        setRoi(initialData.roi);
        setBoundary(initialData.boundary);
        if (initialData.scaleLine) {
          setHasScaleMarker(true);
          setScaleLine(initialData.scaleLine);
        }
        setSegConfidence(initialData.segConfidence || 'good');
      } else {
        // Real heuristic segmentation on pixel data
        const seg = segmentWound(off);
        setRoi(seg.roi);
        setBoundary(seg.boundary);
        setSegConfidence(seg.segConfidence);
        setScaleLine({
          p1: { x: offW * 0.75, y: offH * 0.88 },
          p2: { x: offW * 0.75 + Math.round(offW * 0.15), y: offH * 0.88 },
          physicalLength: 2
        });
      }
      setIsLoaded(true);
    };
    img.onerror = () => {
      setQuality({ valid: false, issues: ['failed to load image'], confidence: 'poor' });
      setIsLoaded(true);
    };
  }, [imageUrl, initialData]);

  const draw = () => {
    const canvas = canvasRef.current;
    const off = offscreenRef.current;
    if (!canvas || !off || !isLoaded) return;
    const ctx = canvas.getContext('2d');

    canvas.width = off.width;
    canvas.height = off.height;

    // Draw image from offscreen canvas
    ctx.drawImage(off, 0, 0);

    // Draw ROI
    ctx.strokeStyle = '#F59E0B'; // Amber
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
    ctx.setLineDash([]);
    
    // Draw ROI corners (for dragging)
    ctx.fillStyle = '#F59E0B';
    const corners = [
      { x: roi.x, y: roi.y },
      { x: roi.x + roi.w, y: roi.y },
      { x: roi.x + roi.w, y: roi.y + roi.h },
      { x: roi.x, y: roi.y + roi.h }
    ];
    corners.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Boundary Polygon
    if (boundary.length > 0) {
      ctx.beginPath();
      ctx.moveTo(boundary[0].x, boundary[0].y);
      for (let i = 1; i < boundary.length; i++) {
        ctx.lineTo(boundary[i].x, boundary[i].y);
      }
      ctx.closePath();
      
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; // Red tint
      ctx.fill();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw boundary vertices
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      boundary.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    // Draw Scale Marker
    if (hasScaleMarker) {
      ctx.strokeStyle = '#38B2AC'; // Teal
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(scaleLine.p1.x, scaleLine.p1.y);
      ctx.lineTo(scaleLine.p2.x, scaleLine.p2.y);
      ctx.stroke();

      ctx.fillStyle = '#38B2AC';
      [scaleLine.p1, scaleLine.p2].forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  };

  useEffect(() => {
    draw();
  }, [isLoaded, roi, boundary, hasScaleMarker, scaleLine]);

  // Mouse interaction logic
  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const HIT_RADIUS = 20;

  const handleMouseDown = (e) => {
    const pos = getMousePos(e);

    // Check scale marker points
    if (hasScaleMarker) {
      if (Math.hypot(pos.x - scaleLine.p1.x, pos.y - scaleLine.p1.y) < HIT_RADIUS) {
        setDraggingItem({ type: 'scale', index: 1 });
        return;
      }
      if (Math.hypot(pos.x - scaleLine.p2.x, pos.y - scaleLine.p2.y) < HIT_RADIUS) {
        setDraggingItem({ type: 'scale', index: 2 });
        return;
      }
    }

    // Check boundary vertices
    for (let i = 0; i < boundary.length; i++) {
      if (Math.hypot(pos.x - boundary[i].x, pos.y - boundary[i].y) < HIT_RADIUS) {
        setDraggingItem({ type: 'boundary', index: i });
        return;
      }
    }

    // Check ROI corners
    const corners = [
      { x: roi.x, y: roi.y, id: 'tl' },
      { x: roi.x + roi.w, y: roi.y, id: 'tr' },
      { x: roi.x + roi.w, y: roi.y + roi.h, id: 'br' },
      { x: roi.x, y: roi.y + roi.h, id: 'bl' }
    ];
    for (let i = 0; i < corners.length; i++) {
      if (Math.hypot(pos.x - corners[i].x, pos.y - corners[i].y) < HIT_RADIUS) {
        setDraggingItem({ type: 'roi', id: corners[i].id });
        return;
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!draggingItem) return;
    const pos = getMousePos(e);

    if (draggingItem.type === 'boundary') {
      const newBound = [...boundary];
      newBound[draggingItem.index] = pos;
      setBoundary(newBound);
    } else if (draggingItem.type === 'scale') {
      const newLine = { ...scaleLine };
      if (draggingItem.index === 1) newLine.p1 = pos;
      else newLine.p2 = pos;
      setScaleLine(newLine);
    } else if (draggingItem.type === 'roi') {
      const newRoi = { ...roi };
      if (draggingItem.id === 'tl') {
        newRoi.w += newRoi.x - pos.x;
        newRoi.h += newRoi.y - pos.y;
        newRoi.x = pos.x;
        newRoi.y = pos.y;
      } else if (draggingItem.id === 'tr') {
        newRoi.w = pos.x - newRoi.x;
        newRoi.h += newRoi.y - pos.y;
        newRoi.y = pos.y;
      } else if (draggingItem.id === 'br') {
        newRoi.w = pos.x - newRoi.x;
        newRoi.h = pos.y - newRoi.y;
      } else if (draggingItem.id === 'bl') {
        newRoi.w += newRoi.x - pos.x;
        newRoi.h = pos.y - newRoi.y;
        newRoi.x = pos.x;
      }
      // Keep positive dimensions
      if (newRoi.w < 20) newRoi.w = 20;
      if (newRoi.h < 20) newRoi.h = 20;
      setRoi(newRoi);
    }
  };

  const handleMouseUp = () => {
    setDraggingItem(null);
  };

  // Calculations
  const woundAreaPx = boundary.length > 2 ? getPolygonArea(boundary) : 0;
  const roiAreaPx = roi.w * roi.h;
  const coveragePct = roiAreaPx > 0 ? (woundAreaPx / roiAreaPx) * 100 : 0;

  let physicalAreaCm2 = null;
  if (hasScaleMarker) {
    const distPx = Math.hypot(scaleLine.p1.x - scaleLine.p2.x, scaleLine.p1.y - scaleLine.p2.y);
    if (distPx > 0) {
      const pixelsPerCm = distPx / scaleLine.physicalLength;
      const pxPerCm2 = pixelsPerCm * pixelsPerCm;
      physicalAreaCm2 = woundAreaPx / pxPerCm2;
    }
  }

  const handleConfirm = async () => {
    const dataToSave = {
      coveragePct,
      coverage_pct: coveragePct,
      physicalAreaCm2,
      wound_area_cm2: physicalAreaCm2,
      woundAreaPx,
      wound_area_px: woundAreaPx,
      roi,
      boundary,
      hasScaleMarker,
      scaleLine,
      quality,
      segConfidence,
      seg_confidence: segConfidence,
      imageWidth: offscreenRef.current?.width || 640,
      imageHeight: offscreenRef.current?.height || 480
    };

    const entryId = initialData?.entryId || initialData?.id;
    if (entryId) {
      try {
        await woundService.updateMeasurements(entryId, dataToSave);
      } catch (err) {
        console.warn('Could not persist measurements to server:', err.message);
      }
    }

    onSave(dataToSave);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      <div style={{ padding: '16px 24px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Review Wound Boundary</h2>
        <div>
          <button className="btn-outline" onClick={onCancel} style={{ marginRight: 12 }}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={quality.confidence === 'poor'}>Confirm & Save</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Canvas Area */}
        <div 
          ref={containerRef} 
          style={{ flex: 1, padding: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0F172A', position: 'relative' }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%', 
              objectFit: 'contain',
              cursor: draggingItem ? 'grabbing' : 'crosshair',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
            }}
          />
        </div>

        {/* Right: Controls Area */}
        <div style={{ width: 340, background: 'var(--card-bg)', borderLeft: '1px solid var(--border)', padding: 24, overflowY: 'auto' }}>
          
          {quality.confidence === 'poor' && (
            <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 20 }}>
              <h4 style={{ color: '#991B1B', fontWeight: 600, marginBottom: 8 }}>Quality Warning</h4>
              <p style={{ fontSize: 13, color: '#7F1D1D' }}>
                Unable to calculate reliably due to: {quality.issues.join(', ')}. Please retake the photo or adjust boundary manually.
              </p>
            </div>
          )}

          {quality.confidence !== 'poor' && (segConfidence === 'low' || segConfidence === 'none') && (
            <div style={{ padding: 16, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, marginBottom: 20 }}>
              <h4 style={{ color: '#92400E', fontWeight: 600, marginBottom: 8 }}>Low Detection Confidence</h4>
              <p style={{ fontSize: 13, color: '#78350F' }}>
                Wound boundaries were auto-detected with low confidence. Please manually adjust the red boundary handles to refine the area.
              </p>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>Calculated Metrics</h3>
            
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Wound Coverage</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>
                {quality.confidence === 'poor' ? '--' : `${coveragePct.toFixed(1)}%`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Percentage of selected assessment area (ROI)</div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Physical Wound Area</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: hasScaleMarker ? 'var(--teal)' : 'var(--text-muted)' }}>
                {quality.confidence === 'poor' ? '--' : (hasScaleMarker ? `${physicalAreaCm2.toFixed(2)} cm²` : 'Scale reference required')}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>Manual Adjustments</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Drag the red nodes to adjust the wound boundary. Drag the amber corners to adjust the Region of Interest (ROI).
            </p>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 12 }}>
              <input 
                type="checkbox" 
                checked={hasScaleMarker} 
                onChange={(e) => setHasScaleMarker(e.target.checked)} 
              />
              Include Scale Marker
            </label>

            {hasScaleMarker && (
              <div style={{ marginLeft: 24 }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Drag the teal line over a known reference object (e.g., a coin or ruler).
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input 
                    type="number" 
                    value={scaleLine.physicalLength} 
                    onChange={(e) => setScaleLine({...scaleLine, physicalLength: parseFloat(e.target.value) || 1})}
                    style={{ width: 80, padding: 8, borderRadius: 4, border: '1px solid var(--border)' }}
                  />
                  <span style={{ fontSize: 14 }}>cm</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
