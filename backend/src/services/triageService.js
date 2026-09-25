/**
 * Deterministic Safety Rule Engine for Wound Triage
 * File: backend/src/services/triageService.js
 */

const triageService = {
  /**
   * Evaluate deterministic triage level and reasons
   * @param {Object} currentEntry - Current entry with symptoms and measurements
   * @param {Object|null} baselineEntry - Day 1 baseline entry if applicable
   * @param {Object|null} previousEntry - Immediate previous entry if applicable
   * @returns {Object} { level: 'green'|'amber'|'red', title: string, reasons: Array<string>, nextAction: string }
   */
  evaluateTriage(currentEntry, baselineEntry = null, previousEntry = null) {
    const reasons = [];
    let level = 'green';

    const s = currentEntry || {};
    const symptomData = typeof s.symptom_data === 'string'
      ? (JSON.parse(s.symptom_data || '{}'))
      : (s.symptom_data || {});

    // Helper checks
    const isSnakeBite = Boolean(s.snake_bite || symptomData.snakeBite);
    const isAnimalBite = Boolean(s.animal_bite || symptomData.animalBite);
    const isBleedingUncontrolled = Boolean(s.bleeding_uncontrolled || symptomData.bleedingUncontrolled);
    const hasFever = Boolean(s.fever || symptomData.fever);
    const isRednessSpreading = (s.redness_status === 'Spreading' || symptomData.rednessSpreading === true || symptomData.rednessSpreading === 'Yes');
    const hasDischarge = Boolean(s.discharge || symptomData.discharge);
    const hasBadSmell = Boolean(s.bad_smell || symptomData.badSmell);
    const isWorseningPain = Boolean(s.worsening_pain || symptomData.worseningPain);
    const hasDiabetes = Boolean(s.diabetes || symptomData.diabetes);
    const isFootWound = Boolean(s.foot_wound || symptomData.footWound);
    const hasTetanusConcern = Boolean(s.tetanus_concern || symptomData.tetanusConcern === true || symptomData.tetanusConcern === 'Yes');

    // --- RED CRITERIA ---
    if (isSnakeBite) {
      level = 'red';
      reasons.push('Snake bite wound reported requiring immediate medical evaluation.');
    }
    if (isAnimalBite) {
      level = 'red';
      reasons.push('Animal bite wound reported with risk of rabies or severe bacterial infection.');
    }
    if (isBleedingUncontrolled) {
      level = 'red';
      reasons.push('Uncontrolled bleeding reported.');
    }
    if (hasFever && isRednessSpreading) {
      level = 'red';
      reasons.push('Systemic fever combined with spreading periwound redness (possible cellulitis).');
    }
    if (hasDischarge && isWorseningPain) {
      level = 'red';
      reasons.push('Pus/discharge accompanied by worsening pain level.');
    }
    if (hasBadSmell && isWorseningPain) {
      level = 'red';
      reasons.push('Foul odor accompanied by worsening symptoms.');
    }
    if (hasDiabetes && isFootWound) {
      level = 'red';
      reasons.push('Diabetic foot wound present requiring high-priority clinical oversight.');
    }
    if (hasTetanusConcern) {
      level = 'red';
      reasons.push('Deep/dirty wound with unknown or outdated tetanus vaccination.');
    }

    // Check significant area worsening if baseline or previous exists
    if (baselineEntry && currentEntry.coverage_pct != null && baselineEntry.coverage_pct != null) {
      const areaChangePct = ((currentEntry.coverage_pct - baselineEntry.coverage_pct) / baselineEntry.coverage_pct) * 100;
      if (areaChangePct > 15) {
        level = 'red';
        reasons.push(`Wound area increased significantly (${areaChangePct.toFixed(1)}% larger than Day 1 baseline).`);
      }
    }

    if (level === 'red') {
      return {
        level: 'red',
        title: 'See a health center today',
        reasons,
        nextAction: 'Do not wait for the next scheduled check. Seek professional medical evaluation promptly.'
      };
    }

    // --- AMBER CRITERIA ---
    const isRednessSlightlyIncreased = (s.redness_status === 'Slightly Increased' || symptomData.rednessSpreading === 'Unsure');
    const painScore = Number(s.pain_score || symptomData.painScore || 0);
    const prevPainScore = previousEntry ? Number(previousEntry.pain_score || 0) : null;
    const isPainUnchangedOrIncreased = prevPainScore !== null && painScore >= prevPainScore && painScore > 0;
    const segConfidence = s.seg_confidence || (s.segmentation_data ? JSON.parse(typeof s.segmentation_data === 'string' ? s.segmentation_data : '{}').segConfidence : null);
    const isLowSegConfidence = segConfidence === 'low' || segConfidence === 'none' || segConfidence === 'poor';

    if (baselineEntry && currentEntry.coverage_pct != null && baselineEntry.coverage_pct != null) {
      const areaChangePct = ((currentEntry.coverage_pct - baselineEntry.coverage_pct) / baselineEntry.coverage_pct) * 100;
      if (areaChangePct >= 0) {
        level = 'amber';
        reasons.push('Wound area is not decreasing compared to Day 1 baseline.');
      }
    }

    if (isRednessSlightlyIncreased) {
      level = 'amber';
      reasons.push('Periwound redness has increased slightly since previous check.');
    }

    if (isPainUnchangedOrIncreased) {
      level = 'amber';
      reasons.push(`Pain level remains elevated (${painScore}/10).`);
    }

    if (isLowSegConfidence) {
      level = 'amber';
      reasons.push('Automated boundary confidence is low; manual review recommended.');
    }

    if (symptomData.rednessSpreading === 'Unsure' || symptomData.tetanusConcern === 'Unsure') {
      level = 'amber';
      reasons.push('Uncertain symptom details reported; close monitoring advised.');
    }

    if (level === 'amber') {
      return {
        level: 'amber',
        title: 'Watch closely',
        reasons: reasons.length > 0 ? reasons : ['Symptoms or measurements warrant closer monitoring.'],
        nextAction: 'Recheck tomorrow. Seek clinical care sooner if symptoms worsen.'
      };
    }

    // --- GREEN DEFAULT ---
    return {
      level: 'green',
      title: 'No urgent warning signs found',
      reasons: [
        'Wound area is stable or improving compared to baseline',
        'No systemic fever or spreading redness reported',
        'No uncontrolled discharge or urgent risk factors reported'
      ],
      nextAction: 'Keep wound clean and covered. Continue monitoring progression as scheduled.'
    };
  }
};

module.exports = triageService;
