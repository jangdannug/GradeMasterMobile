// Run with: node --test src/class-record/logic.test.ts   (Node 22.18+ strips the types itself)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  actionGates,
  buildHighestScoreMap,
  buildScoreMap,
  cardInitials,
  changedEntries,
  classRecordStatusValue,
  compScores,
  computeStudentValidation,
  descriptorColor,
  formatRowName,
  initialGrade,
  isPeriodOpen,
  isScoreOverMax,
  isSubmittedStatus,
  lookupDescriptor,
  lookupFinalGrade,
  matchesStudentSearch,
  parseScoreInput,
  parseSearchTokens,
  splitNameByTokens,
  submissionBadgeTone,
  submissionStatusHint,
  submissionStatusLabel,
  type GradingComponent,
} from './logic.ts';

// Quizzes 40% (Quiz 1 /20, Quiz 2 /10) and Exam 60% (Exam /50)
const components: GradingComponent[] = [
  { id: 'c1', weightPercent: 40, sequenceNo: 1, items: [{ id: 'q1', maxScore: 20 }, { id: 'q2', maxScore: 10 }] },
  { id: 'c2', weightPercent: 60, sequenceNo: 2, items: [{ id: 'ex', maxScore: 50 }] },
];
const highest = buildHighestScoreMap(components);

describe('buildScoreMap', () => {
  it('is empty for no rows', () => assert.deepEqual(buildScoreMap(undefined), {}));
  it('keeps only non-null scores keyed by enrollment then item', () =>
    assert.deepEqual(
      buildScoreMap([{ enrollmentId: 'e1', scores: { i1: { rawScore: 8 }, i2: { rawScore: null } } }]),
      { e1: { i1: 8 } }
    ));
  it('treats zero as a real score and keeps one entry per row', () =>
    assert.deepEqual(
      buildScoreMap([
        { enrollmentId: 'e1', scores: { i1: { rawScore: 0 } } },
        { enrollmentId: 'e2', scores: {} },
      ]),
      { e1: { i1: 0 }, e2: {} }
    ));
});

describe('grade math', () => {
  it('builds the highest score map from the items', () => assert.deepEqual(highest, { q1: 20, q2: 10, ex: 50 }));

  it('computes total / percentage / weighted score per component', () => {
    const scores = { e1: { q1: 18, q2: 9, ex: 45 } };
    const quizzes = compScores('e1', components[0], scores, highest);
    assert.equal(quizzes.total, 27);
    assert.equal(quizzes.ps, 90);
    assert.equal(quizzes.ws, 36); // 90% of a 40% component
    assert.equal(quizzes.valid, true);
    assert.equal(compScores('e1', components[1], scores, highest).ws, 54);
  });

  it('adds the weighted scores into the initial grade', () =>
    assert.equal(initialGrade('e1', components, { e1: { q1: 18, q2: 9, ex: 45 } }, highest), 90));

  it('treats missing scores as 0 and a missing enrollment as 0', () => {
    assert.equal(initialGrade('e1', components, { e1: { ex: 50 } }, highest), 60);
    assert.equal(initialGrade(undefined, components, {}, highest), 0);
  });

  it('uses the component itself as the column when it has no items', () => {
    const comp: GradingComponent = { id: 'x', weightPercent: 100, sequenceNo: 1, items: [] };
    const max = { x: 20 };
    assert.equal(compScores('e1', comp, { e1: { x: 15 } }, max).ps, 75);
    assert.equal(compScores('e1', comp, { e1: { x: 15 } }, max).valid, true);
    assert.equal(compScores('e1', comp, {}, { x: 0 }).valid, false);
  });

  it('never produces NaN or divides by a zero maximum', () => {
    const zero = buildHighestScoreMap([{ id: 'c', weightPercent: 50, sequenceNo: 1, items: [{ id: 'i', maxScore: 0 }] }]);
    const result = compScores('e1', { id: 'c', weightPercent: 50, sequenceNo: 1, items: [{ id: 'i', maxScore: 0 }] }, { e1: { i: 5 } }, zero);
    assert.equal(result.ps, 0);
    assert.equal(result.valid, false);
  });

  describe('lookupFinalGrade', () => {
    const rows = [
      { minInitial: 0, maxInitial: 59.99, transmuted: 60 },
      { minInitial: 60, maxInitial: 79.99, transmuted: 75 },
      { minInitial: 80, maxInitial: 100, transmuted: 90 },
    ];

    it('returns the transmuted grade of the row containing the initial grade', () => {
      assert.equal(lookupFinalGrade(30, rows), 60);
      assert.equal(lookupFinalGrade(70.5, rows), 75);
    });

    it('includes both ends of a range', () => {
      assert.equal(lookupFinalGrade(0, rows), 60);
      assert.equal(lookupFinalGrade(59.99, rows), 60);
      assert.equal(lookupFinalGrade(60, rows), 75);
      assert.equal(lookupFinalGrade(80, rows), 90);
      assert.equal(lookupFinalGrade(100, rows), 90);
    });

    it('returns null when no row matches', () => {
      assert.equal(lookupFinalGrade(100.01, rows), null);
      assert.equal(lookupFinalGrade(-1, rows), null);
      assert.equal(lookupFinalGrade(59.995, rows), null);
    });

    it('returns null for an empty table', () => {
      assert.equal(lookupFinalGrade(80, []), null);
    });
  });

  it('looks up the final grade and descriptor by range (first match wins)', () => {
    const rows = [
      { minInitial: 0, maxInitial: 59.99, transmuted: 60 },
      { minInitial: 60, maxInitial: 100, transmuted: 75 },
    ];
    assert.equal(lookupFinalGrade(30, rows), 60);
    assert.equal(lookupFinalGrade(60, rows), 75);
    assert.equal(lookupFinalGrade(120, rows), null);
    const descriptors = [
      { minGrade: 90, maxGrade: 100, label: 'Outstanding', color: 'Green' },
      { minGrade: 75, maxGrade: 89.99, label: 'Satisfactory', color: 'Blue' },
    ];
    assert.deepEqual(lookupDescriptor(92, descriptors), { label: 'Outstanding', color: 'Green' });
    assert.equal(lookupDescriptor(50, descriptors), null);
  });

  it('maps descriptor color names to theme shades and passes hex through', () => {
    assert.equal(descriptorColor('Green', false), '#16a34a');
    assert.equal(descriptorColor('Green', true), '#4ade80');
    assert.equal(descriptorColor('#123456', false), '#123456');
    assert.equal(descriptorColor('Nope', false), null);
  });
});

describe('validation', () => {
  it('flags a score over its maximum', () => {
    assert.equal(isScoreOverMax('e1', 'q1', { e1: { q1: 25 } }, highest), true);
    assert.equal(isScoreOverMax('e1', 'q1', { e1: { q1: 20 } }, highest), false);
    // An item whose maximum is 0 can never be "over"
    assert.equal(isScoreOverMax('e1', 'z', { e1: { z: 5 } }, { z: 0 }), false);
  });

  it('reports over-max, any-score and blank flags per student', () => {
    assert.deepEqual(computeStudentValidation('e1', { e1: { q1: 25, q2: 5, ex: 10 } }, components, highest), {
      hasOverMax: true,
      hasAnyScore: true,
      hasBlank: false,
    });
    assert.deepEqual(computeStudentValidation('e1', { e1: { q1: 10 } }, components, highest), {
      hasOverMax: false,
      hasAnyScore: true,
      hasBlank: true,
    });
    assert.deepEqual(computeStudentValidation('e1', {}, components, highest), {
      hasOverMax: false,
      hasAnyScore: false,
      hasBlank: true,
    });
  });

  it('counts a student with no enrollment as blank', () =>
    assert.equal(computeStudentValidation(undefined, {}, components, highest).hasBlank, true));
});

describe('drafts', () => {
  it('parses score input: empty and NaN clear the cell', () => {
    assert.equal(parseScoreInput(' 12.5 '), 12.5);
    assert.equal(parseScoreInput(''), undefined);
    assert.equal(parseScoreInput('abc'), undefined);
    assert.equal(parseScoreInput('0'), 0);
  });

  it('sends only the changed cells and clears with null', () => {
    const baseline = { e1: { q1: 10, q2: 5 }, e2: {} };
    const draft = { e1: { q1: 10, q2: 6 }, e2: { q1: 3 } };
    assert.deepEqual(changedEntries(baseline, draft), [
      { enrollmentId: 'e1', gradingComponentItemId: 'q2', rawScore: 6 },
      { enrollmentId: 'e2', gradingComponentItemId: 'q1', rawScore: 3 },
    ]);
    assert.deepEqual(changedEntries({ e1: { q1: 10 } }, { e1: {} }), [
      { enrollmentId: 'e1', gradingComponentItemId: 'q1', rawScore: null },
    ]);
    assert.deepEqual(changedEntries(baseline, baseline), []);
  });
});

describe('action gates', () => {
  const open = { status: 0, editable: true, isGpOpen: true, isSyLocked: false, overMaxCount: 0, blankCount: 0, isDirty: false };
  it('allows save and submit on a clean, complete draft', () =>
    assert.deepEqual(actionGates(open), { blocksSave: false, blocksSubmit: false }));
  it('blocks submit until saved and without blanks', () => {
    assert.equal(actionGates({ ...open, isDirty: true }).blocksSubmit, true);
    assert.equal(actionGates({ ...open, isDirty: true }).blocksSave, false);
    assert.equal(actionGates({ ...open, blankCount: 2 }).blocksSubmit, true);
  });
  it('blocks both on over-max scores, a closed period, a locked year or a read-only sheet', () => {
    assert.equal(actionGates({ ...open, overMaxCount: 1 }).blocksSave, true);
    assert.equal(actionGates({ ...open, isGpOpen: false }).blocksSave, true);
    assert.equal(actionGates({ ...open, isSyLocked: true }).blocksSave, true);
    assert.equal(actionGates({ ...open, editable: false }).blocksSave, true);
  });
  it('blocks a submitted or pending record but lets a withdrawn or returned one be saved again', () => {
    assert.equal(actionGates({ ...open, status: 5, editable: true }).blocksSave, true);
    assert.equal(actionGates({ ...open, status: 1, editable: true }).blocksSave, true);
    assert.equal(actionGates({ ...open, status: 2 }).blocksSave, false);
    assert.equal(actionGates({ ...open, status: 6 }).blocksSave, false);
  });
  it('opens a period only for an active school year inside its window', () => {
    const p = { startDate: '2026-09-01', endDate: '2026-12-20' };
    assert.equal(isPeriodOpen(true, '2026-10-25', p), true);
    assert.equal(isPeriodOpen(true, '2026-12-21', p), false);
    assert.equal(isPeriodOpen(false, '2026-10-25', p), false);
    assert.equal(isPeriodOpen(true, '2026-10-25', undefined), false);
  });
});

describe('status helpers', () => {
  it('labels every known status and falls back to Unknown', () => {
    const labels = ['Draft', 'Submitted', 'Withdrawn', 'Approved', 'Rejected', 'Pending School Head Review', 'Returned by School Head', 'Locked'];
    labels.forEach((label, status) => assert.equal(submissionStatusLabel(status), label));
    assert.equal(submissionStatusLabel(null), 'Unknown');
    assert.equal(submissionStatusLabel(99), 'Unknown');
  });
  it('accepts the status as a name or a numeric string', () => {
    assert.equal(classRecordStatusValue('Approved'), 3);
    assert.equal(classRecordStatusValue('pendingheadreview'), 5);
    assert.equal(classRecordStatusValue('7'), 7);
    assert.equal(classRecordStatusValue('nope'), null);
    assert.equal(submissionStatusLabel('Locked'), 'Locked');
  });
  it('gives each status a tone', () => {
    assert.equal(submissionBadgeTone(3), 'success');
    assert.equal(submissionBadgeTone(4), 'danger');
    assert.equal(submissionBadgeTone(2), 'warning');
    assert.equal(submissionBadgeTone(6), 'warning');
    assert.equal(submissionBadgeTone(7), 'secondary');
    assert.equal(submissionBadgeTone(1), 'info');
    assert.equal(submissionBadgeTone(undefined), 'secondary');
  });
  it('treats everything but a plain draft as submitted', () => {
    assert.equal(isSubmittedStatus(0), false);
    assert.equal(isSubmittedStatus(null), false);
    assert.equal(isSubmittedStatus(undefined), false);
    assert.equal(isSubmittedStatus(2), true);
    assert.equal(isSubmittedStatus(7), true);
  });
  it('explains each status for editable and read-only sheets', () => {
    assert.match(submissionStatusHint(0, true), /not been submitted yet/);
    assert.match(submissionStatusHint(6, true), /returned this record for revision. Fix the scores/);
    assert.equal(submissionStatusHint(2, true), 'This record is still editable.');
    assert.match(submissionStatusHint(1, false), /waiting for review/);
    assert.match(submissionStatusHint(5, false), /school head's review/);
    assert.match(submissionStatusHint(3, false), /approved and is locked/);
    assert.match(submissionStatusHint(7, false), /locked/);
    assert.equal(submissionStatusHint(0, false), 'This grading sheet is read-only.');
  });
});

describe('name search', () => {
  const row = { lastName: 'Abad', firstName: 'Ramon' };
  it('formats "Last, First" and tolerates a missing part', () => {
    assert.equal(formatRowName(row), 'Abad, Ramon');
    assert.equal(formatRowName({ lastName: 'Abad', firstName: '' }), 'Abad');
  });
  it('parses tokens: lower-cased, split on whitespace, blank -> []', () => {
    assert.deepEqual(parseSearchTokens('  Ramon   ABA D '), ['ramon', 'aba', 'd']);
    assert.deepEqual(parseSearchTokens('   '), []);
  });
  it('matches order-free and requires every token (accent-insensitive)', () => {
    assert.equal(matchesStudentSearch(row, []), true);
    assert.equal(matchesStudentSearch(row, parseSearchTokens('Ramon Abad')), true);
    assert.equal(matchesStudentSearch(row, parseSearchTokens('Abad Ramon')), true);
    assert.equal(matchesStudentSearch(row, parseSearchTokens('Ramon Cruz')), false);
    assert.equal(matchesStudentSearch({ lastName: 'Peña', firstName: 'José' }, parseSearchTokens('pena jose')), true);
  });
  it('splits a name into highlighted segments, keeping the original casing', () => {
    assert.deepEqual(splitNameByTokens('Abad, Ramon', []), [{ text: 'Abad, Ramon', match: false }]);
    assert.deepEqual(splitNameByTokens('Abad, Ramon', ['ramon']), [
      { text: 'Abad, ', match: false },
      { text: 'Ramon', match: true },
    ]);
    assert.deepEqual(splitNameByTokens('Abad, Ramon', ['abad', 'ramon']), [
      { text: 'Abad', match: true },
      { text: ', ', match: false },
      { text: 'Ramon', match: true },
    ]);
    assert.deepEqual(splitNameByTokens('Abad, Ramon', ['.']), [{ text: 'Abad, Ramon', match: false }]);
  });
});

describe('class cards', () => {
  it('builds up to two initials', () => {
    assert.equal(cardInitials('MATH7'), 'MA');
    assert.equal(cardInitials('Araling Panlipunan'), 'AP');
    assert.equal(cardInitials('   '), '?');
  });
});
