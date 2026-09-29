const Centre = require('../models/Centre');
const { districtCode } = require('./tnGeo');

/**
 * Builds a short, human-traceable code for a newly created centre:
 * <district code>-<3-digit sequence within that district>, e.g. "TNJ-014".
 * Generated once at creation and stored on the Centre document - it never
 * changes afterwards, since it's baked into every token issued there.
 */
async function generateCentrePrefix(district) {
  const code = districtCode(district);
  const countInDistrict = await Centre.countDocuments({ district });
  const sequence = String(countInDistrict + 1).padStart(3, '0');
  const candidate = `${code}-${sequence}`;

  // Extremely unlikely, but guard against a collision (e.g. a centre was
  // deleted and re-created, or two requests raced) by bumping the sequence
  // until it's free rather than failing the whole centre-creation call.
  const clash = await Centre.exists({ codePrefix: candidate });
  if (!clash) return candidate;

  let n = countInDistrict + 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = `${code}-${String(n).padStart(3, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await Centre.exists({ codePrefix: next }))) return next;
    n += 1;
  }
}

module.exports = { generateCentrePrefix };
