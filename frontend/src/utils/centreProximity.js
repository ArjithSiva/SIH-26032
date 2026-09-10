// Ranks centres by how close they are to a farmer's own village/taluk/
// district: 0 = same village, 1 = same taluk, 2 = same district, 3 = other.
// Used both to sort a centre list (closest first) and to pick a sensible
// default "recommended" selection without listing every centre in the
// state.
export function proximityRank(centre, location) {
  if (!location) return 3;
  if (location.village && centre.village === location.village) return 0;
  if (location.taluk && centre.taluk === location.taluk) return 1;
  if (location.district && centre.district === location.district) return 2;
  return 3;
}

export function sortByProximity(centres, location) {
  return [...centres].sort((a, b) => proximityRank(a, location) - proximityRank(b, location));
}

// The default/recommended selection: whichever is the single closest tier
// that actually has a centre in it (so a farmer whose exact village has no
// centre still gets a sensible taluk- or district-level default instead of
// an empty list).
export function recommendedCentreIds(centres, location) {
  for (let rank = 0; rank <= 2; rank += 1) {
    const matches = centres.filter((c) => proximityRank(c, location) === rank);
    if (matches.length > 0) return matches.map((c) => c._id);
  }
  return [];
}
