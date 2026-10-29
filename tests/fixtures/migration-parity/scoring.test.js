// Run with the existing Mocha bootstrap; no browser/framework instance needed.
const assert = require('node:assert/strict');
const rules = require('../../../src/main/js/screens/app/screens/play/components/DrawArea.rules');
const stroke = require('./strokes.json');
describe('P0 pure reusable handwriting contract', () => {
  it('accepts an exact forward horizontal stroke and rejects its reverse direction', () => {
    const correctLine = stroke.mouse.map(([x,y]) => ({x,y}));
    const data = {correctLine,userLine:correctLine,correctLines:[correctLine],userLines:[correctLine]};
    assert.equal(rules.isLineAccurate({requiredAccuracyPercentage:50,strictnessPercentage:20},data).value,true);
    assert.equal(rules.areLinesAccurate({requiredAccuracyPercentage:50,strictnessPercentage:20},data).value,true);
    assert.equal(rules.isCorrectDirection({},data).value,true);
    assert.equal(rules.isCorrectDirection({},{...data,userLine:[...correctLine].reverse()}).value,false);
  });
});
