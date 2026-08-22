'use strict';
/**
 * Lightweight topic catalog (server-side only — keeps APK small).
 * Order within subject ≈ suggested learning path.
 * topicId is stable for progress rows.
 */
const CATALOG = [
  // Biology — Form 1–4 basics
  { id: 'bio.cell', subject: 'biology', form: 'form1', title: 'Cell structure', difficulty: 1 },
  { id: 'bio.diffusion', subject: 'biology', form: 'form1', title: 'Diffusion and osmosis', difficulty: 1 },
  { id: 'bio.photosynthesis', subject: 'biology', form: 'form2', title: 'Photosynthesis', difficulty: 2 },
  { id: 'bio.respiration', subject: 'biology', form: 'form2', title: 'Respiration', difficulty: 2 },
  { id: 'bio.nutrition', subject: 'biology', form: 'form2', title: 'Human nutrition', difficulty: 2 },
  { id: 'bio.transport', subject: 'biology', form: 'form3', title: 'Transport in plants/animals', difficulty: 3 },
  { id: 'bio.excretion', subject: 'biology', form: 'form3', title: 'Excretion', difficulty: 3 },
  { id: 'bio.coordination', subject: 'biology', form: 'form4', title: 'Coordination', difficulty: 3 },
  { id: 'bio.reproduction', subject: 'biology', form: 'form4', title: 'Reproduction', difficulty: 3 },
  { id: 'bio.genetics', subject: 'biology', form: 'form4', title: 'Genetics basics', difficulty: 4 },

  // Chemistry
  { id: 'chem.matter', subject: 'chemistry', form: 'form1', title: 'Matter and states', difficulty: 1 },
  { id: 'chem.atoms', subject: 'chemistry', form: 'form1', title: 'Atoms and elements', difficulty: 1 },
  { id: 'chem.bonding', subject: 'chemistry', form: 'form2', title: 'Chemical bonding', difficulty: 2 },
  { id: 'chem.acids', subject: 'chemistry', form: 'form2', title: 'Acids and bases', difficulty: 2 },
  { id: 'chem.reactions', subject: 'chemistry', form: 'form3', title: 'Chemical reactions', difficulty: 3 },
  { id: 'chem.organic', subject: 'chemistry', form: 'form4', title: 'Organic chemistry intro', difficulty: 4 },

  // Physics
  { id: 'phy.measurement', subject: 'physics', form: 'form1', title: 'Measurement', difficulty: 1 },
  { id: 'phy.motion', subject: 'physics', form: 'form1', title: 'Motion', difficulty: 1 },
  { id: 'phy.force', subject: 'physics', form: 'form2', title: 'Force and pressure', difficulty: 2 },
  { id: 'phy.energy', subject: 'physics', form: 'form2', title: 'Work, energy, power', difficulty: 2 },
  { id: 'phy.waves', subject: 'physics', form: 'form3', title: 'Waves and sound', difficulty: 3 },
  { id: 'phy.electricity', subject: 'physics', form: 'form3', title: 'Electricity basics', difficulty: 3 },
  { id: 'phy.magnetism', subject: 'physics', form: 'form4', title: 'Magnetism', difficulty: 3 },

  // Mathematics
  { id: 'math.numbers', subject: 'mathematics', form: 'form1', title: 'Numbers and operations', difficulty: 1 },
  { id: 'math.algebra', subject: 'mathematics', form: 'form1', title: 'Introduction to algebra', difficulty: 2 },
  { id: 'math.equations', subject: 'mathematics', form: 'form2', title: 'Linear equations', difficulty: 2 },
  { id: 'math.geometry', subject: 'mathematics', form: 'form2', title: 'Geometry basics', difficulty: 2 },
  { id: 'math.quadratic', subject: 'mathematics', form: 'form3', title: 'Quadratic equations', difficulty: 3 },
  { id: 'math.trig', subject: 'mathematics', form: 'form3', title: 'Trigonometry intro', difficulty: 3 },
  { id: 'math.stats', subject: 'mathematics', form: 'form4', title: 'Statistics basics', difficulty: 3 },
];

function listTopics({ subject, form } = {}) {
  let rows = CATALOG.slice();
  if (subject) {
    const s = String(subject).toLowerCase();
    rows = rows.filter((t) => t.subject === s);
  }
  if (form) {
    const f = String(form).toLowerCase();
    rows = rows.filter((t) => !t.form || t.form === f || formRank(t.form) <= formRank(f));
  }
  return rows;
}

function formRank(form) {
  const m = {
    form1: 1,
    form2: 2,
    form3: 3,
    form4: 4,
    form5: 5,
    form6: 6,
    primary7: 0,
  };
  return m[String(form || '').toLowerCase()] ?? 99;
}

function getTopic(topicId) {
  return CATALOG.find((t) => t.id === topicId) || null;
}

module.exports = { CATALOG, listTopics, getTopic, formRank };
