// Run with: node --test src/answer-sheet/answerSheet.test.ts   (Node 22.18+ strips the types itself)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeAnswers, mapAnswerSheet, parseAnswerSheetQr, scoreAnswers } from './answerSheet.ts';

const guid = (n: number) => `${String(n).repeat(8)}-aaaa-4bbb-8ccc-${String(n).repeat(12)}`;
const compact = (g: string) => g.replace(/-/g, '').toUpperCase();

describe('parseAnswerSheetQr', () => {
  it('reads the compact GUID format the web app prints', () => {
    const text = ['GM1', ...[1, 2, 3, 4, 5].map((n) => compact(guid(n)))].join(':');
    assert.deepEqual(parseAnswerSheetQr(text), {
      sheetId: guid(1),
      offeringId: guid(2),
      gradingPeriodId: guid(3),
      gradingComponentItemId: guid(4),
      enrollmentId: guid(5),
    });
  });

  it('reads a blank copy (no student)', () => {
    const text = ['GM1', ...[1, 2, 3, 4].map((n) => compact(guid(n))), ''].join(':');
    assert.equal(parseAnswerSheetQr(text)?.enrollmentId, null);
  });

  it('reads the JSON fallback and rejects anything else', () => {
    const json = JSON.stringify({ s: 'a', o: 'b', g: 'c', i: 'd', e: 'e' });
    assert.equal(parseAnswerSheetQr(json)?.enrollmentId, 'e');
    assert.equal(parseAnswerSheetQr('https://example.com'), null);
    assert.equal(parseAnswerSheetQr('GM1:nope'), null);
  });
});

describe('answer key', () => {
  it('decodes the API key string', () => {
    assert.deepEqual(decodeAnswers('ab-d'), [0, 1, null, 3]);
  });

  it('maps an API sheet', () => {
    const s = mapAnswerSheet({ answerSheetId: 'x', itemCount: 4, choiceCount: 4, maxScore: 8, answers: 'abcd', title: 'Quiz 1' });
    assert.equal(s.id, 'x');
    assert.deepEqual(s.answers, [0, 1, 2, 3]);
  });
});

describe('scoreAnswers', () => {
  const sheet = { answers: [0, 1, 2, 3], maxScore: 4 };
  it('counts matches; blank or double-shaded (null) items are wrong', () => {
    assert.equal(scoreAnswers(sheet, [0, 1, 2, 3]), 4);
    assert.equal(scoreAnswers(sheet, [0, null, 2, 0]), 2);
  });
  it('scales to the max score and ignores unkeyed items', () => {
    assert.equal(scoreAnswers({ answers: [0, 1, null], maxScore: 20 }, [0, 1, 3]), 20);
    assert.equal(scoreAnswers({ answers: [0, 1, 2, 3, 1, 2, 1], maxScore: 20 }, [0, 1, 2, 3, null, null, null]), 11.43);
  });
});
