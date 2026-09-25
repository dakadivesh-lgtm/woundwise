/**
 * Longitudinal Comparison Service for Wound Progression (Day 1 → Day 3 → Day 5 → Day 7)
 * File: backend/src/services/comparisonService.js
 */

const triageService = require('./triageService');

const comparisonService = {
  /**
   * Calculate percentage area change between two entries
   */
  calculateAreaChange(currentEntry, baselineEntry) {
    if (!currentEntry || !baselineEntry) {
      return {
        hasComparison: false,
        text: 'Size comparison unavailable',
        changePct: null
      };
    }

    // Prefer physical cm2 if both have it
    const currCm2 = currentEntry.wound_area_cm2;
    const baseCm2 = baselineEntry.wound_area_cm2;

    if (currCm2 && baseCm2 && baseCm2 > 0) {
      const pct = ((currCm2 - baseCm2) / baseCm2) * 100;
      const isSmaller = pct < 0;
      const absPct = Math.abs(Math.round(pct));
      const formattedText = isSmaller ? `↓ ${absPct}% smaller than Day 1` : (pct === 0 ? 'Stable size since Day 1' : `↑ ${absPct}% larger than Day 1`);
      return {
        hasComparison: true,
        isPhysical: true,
        currentValue: `${currCm2.toFixed(2)} cm²`,
        baselineValue: `${baseCm2.toFixed(2)} cm²`,
        changePct: pct,
        formattedText,
        label: 'physical area'
      };
    }

    // Fall back to coverage_pct relative area
    const currCov = currentEntry.coverage_pct;
    const baseCov = baselineEntry.coverage_pct;

    if (currCov != null && baseCov != null && baseCov > 0) {
      const pct = ((currCov - baseCov) / baseCov) * 100;
      const isSmaller = pct < 0;
      const absPct = Math.abs(Math.round(pct));
      const formattedText = isSmaller ? `↓ ${absPct}% smaller than Day 1` : (pct === 0 ? 'Stable relative area since Day 1' : `↑ ${absPct}% larger than Day 1`);
      return {
        hasComparison: true,
        isPhysical: false,
        currentValue: `${currCov.toFixed(1)}% ROI area`,
        baselineValue: `${baseCov.toFixed(1)}% ROI area`,
        changePct: pct,
        formattedText,
        label: 'relative wound area'
      };
    }

    return {
      hasComparison: false,
      text: 'Size comparison unavailable',
      changePct: null
    };
  },

  /**
   * Compare pain scores (0-10)
   */
  comparePain(currentPain, baselinePain) {
    if (currentPain == null || baselinePain == null) return { text: 'Not recorded', status: 'neutral' };
    const diff = currentPain - baselinePain;
    if (diff < 0) return { text: `Improved (${baselinePain}/10 → ${currentPain}/10)`, status: 'improved' };
    if (diff > 0) return { text: `Worsened (${baselinePain}/10 → ${currentPain}/10)`, status: 'worsened' };
    return { text: `Unchanged (${currentPain}/10)`, status: 'unchanged' };
  },

  /**
   * Compare swelling levels
   */
  compareSwelling(currentSwelling, baselineSwelling) {
    const order = { 'none': 0, 'mild': 1, 'moderate': 2, 'severe': 3 };
    const currRank = order[String(currentSwelling || 'none').toLowerCase()] ?? 1;
    const baseRank = order[String(baselineSwelling || 'none').toLowerCase()] ?? 1;

    const formattedCurr = (currentSwelling || 'Mild').charAt(0).toUpperCase() + (currentSwelling || 'Mild').slice(1);
    const formattedBase = (baselineSwelling || 'Mild').charAt(0).toUpperCase() + (baselineSwelling || 'Mild').slice(1);

    if (currRank < baseRank) return { text: `Decreased (${formattedBase} → ${formattedCurr})`, status: 'improved' };
    if (currRank > baseRank) return { text: `Increased (${formattedBase} → ${formattedCurr})`, status: 'worsened' };
    return { text: `No change (${formattedCurr})`, status: 'unchanged' };
  },

  /**
   * Compare redness status
   */
  compareRedness(currentRedness, baselineRedness) {
    const curr = currentRedness || 'Normal';
    const base = baselineRedness || 'Normal';

    if (curr === base) return { text: `Unchanged (${curr})`, status: 'unchanged' };
    if (curr === 'Spreading' || curr === 'Slightly Increased') return { text: `Increased (${base} → ${curr})`, status: 'worsened' };
    return { text: `Reduced (${base} → ${curr})`, status: 'improved' };
  },

  /**
   * Build complete longitudinal comparison payload
   */
  buildWoundComparison(currentEntry, baselineEntry = null, allEntries = []) {
    const isBaseline = !baselineEntry || (baselineEntry.id === currentEntry.id);
    const followupDay = currentEntry.followup_day || (isBaseline ? 1 : (allEntries.findIndex(e => e.id === currentEntry.id) * 2 + 1));

    // Evaluate deterministic safety rules
    const triage = triageService.evaluateTriage(currentEntry, baselineEntry, null);

    if (isBaseline) {
      return {
        isBaseline: true,
        followupDay: 1,
        dayLabel: 'Day 1 Baseline',
        area: currentEntry.wound_area_cm2 ? `${currentEntry.wound_area_cm2.toFixed(2)} cm²` : (currentEntry.coverage_pct != null ? `${currentEntry.coverage_pct.toFixed(1)}% ROI area` : 'Not measured'),
        pain: `${currentEntry.pain_score || 0} / 10`,
        redness: currentEntry.redness_status || 'Normal',
        swelling: currentEntry.swelling_level || 'Mild',
        message: "We'll use this check as the baseline for future comparisons.",
        triage
      };
    }

    const areaDiff = comparisonService.calculateAreaChange(currentEntry, baselineEntry);
    const painDiff = comparisonService.comparePain(currentEntry.pain_score, baselineEntry.pain_score);
    const swellingDiff = comparisonService.compareSwelling(currentEntry.swelling_level, baselineEntry.swelling_level);
    const rednessDiff = comparisonService.compareRedness(currentEntry.redness_status, baselineEntry.redness_status);

    // Timeline state array for Day 1, Day 3, Day 5, Day 7
    const timelineStates = [1, 3, 5, 7].map(day => {
      const match = allEntries.find(e => e.followup_day === day);
      return {
        day,
        label: day === 1 ? 'Day 1 (Baseline)' : `Day ${day}`,
        isCompleted: Boolean(match),
        isCurrent: day === followupDay,
        entryId: match ? match.id : null,
        entryDate: match ? match.entry_date : null
      };
    });

    // Healing Progress Determination based on longitudinal diff
    let healingProgress = 'Stable';
    if (areaDiff.changePct !== null && areaDiff.changePct < -5 && painDiff.status !== 'worsened') {
      healingProgress = 'Improving';
    } else if (areaDiff.changePct !== null && areaDiff.changePct > 5) {
      healingProgress = 'Worsening';
    } else if (rednessDiff.status === 'worsened' || swellingDiff.status === 'worsened') {
      healingProgress = 'Worsening';
    }

    return {
      isBaseline: false,
      followupDay,
      dayLabel: `Day ${followupDay} Follow-up`,
      baselineEntry,
      currentEntry,
      areaDiff,
      painDiff,
      swellingDiff,
      rednessDiff,
      healingProgress,
      timelineStates,
      whatChanged: [
        { label: 'Wound size', from: baselineEntry.wound_area_cm2 ? `${baselineEntry.wound_area_cm2.toFixed(2)} cm²` : `${baselineEntry.coverage_pct?.toFixed(1) || 0}%`, to: currentEntry.wound_area_cm2 ? `${currentEntry.wound_area_cm2.toFixed(2)} cm²` : `${currentEntry.coverage_pct?.toFixed(1) || 0}%`, summary: areaDiff.formattedText },
        { label: 'Pain score', from: `${baselineEntry.pain_score || 0}/10`, to: `${currentEntry.pain_score || 0}/10`, summary: painDiff.text },
        { label: 'Redness', from: baselineEntry.redness_status || 'Normal', to: currentEntry.redness_status || 'Normal', summary: rednessDiff.text },
        { label: 'Swelling', from: baselineEntry.swelling_level || 'Mild', to: currentEntry.swelling_level || 'Mild', summary: swellingDiff.text },
        { label: 'Fever', from: baselineEntry.fever ? 'Yes' : 'No', to: currentEntry.fever ? 'Yes' : 'No', summary: currentEntry.fever ? 'Reported' : 'No' },
        { label: 'Discharge', from: baselineEntry.discharge ? 'Yes' : 'No', to: currentEntry.discharge ? 'Yes' : 'No', summary: currentEntry.discharge ? 'Reported' : 'No' }
      ],
      triage
    };
  }
};

module.exports = comparisonService;
