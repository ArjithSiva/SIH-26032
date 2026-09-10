// Full list of Tamil Nadu's 38 districts, spelled to match the TNCSC DPC
// dataset's convention where a district overlaps with it (e.g. "Thiruvarur",
// "Kancheepuram", "Villupuram") so district-based centre lookups keep
// working with plain string equality. This list is intentionally NOT
// derived from Centre data - unlike DPC centres (which exist only where a
// procurement season is running), every Tamil Nadu district belongs here
// regardless of whether it currently has an open centre, so farmers from
// any district can complete registration.
const TN_DISTRICTS = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kancheepuram',
  'Kanyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivagangai',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thiruchirappalli',
  'Thirunelveli',
  'Thiruvallore',
  'Thiruvanamalai',
  'Thiruvarur',
  'Thoothukudi',
  'Tirupattur',
  'Tiruppur',
  'Vellore',
  'Villupuram',
  'Virudhunagar',
];

// Short, stable 3-letter codes used as the district segment of a centre's
// token prefix (see utils/centrePrefix.js). Picked to stay readable and
// distinct rather than a strict abbreviation algorithm.
const DISTRICT_CODES = {
  Ariyalur: 'ARY',
  Chengalpattu: 'CGL',
  Chennai: 'CHN',
  Coimbatore: 'CBE',
  Cuddalore: 'CUD',
  Dharmapuri: 'DPI',
  Dindigul: 'DGL',
  Erode: 'ERD',
  Kallakurichi: 'KLK',
  Kancheepuram: 'KAN',
  Kanyakumari: 'KKM',
  Karur: 'KRR',
  Krishnagiri: 'KRG',
  Madurai: 'MDU',
  Mayiladuthurai: 'MYL',
  Nagapattinam: 'NGP',
  Namakkal: 'NMK',
  Nilgiris: 'NLG',
  Perambalur: 'PRB',
  Pudukkottai: 'PDK',
  Ramanathapuram: 'RMD',
  Ranipet: 'RNP',
  Salem: 'SLM',
  Sivagangai: 'SVG',
  Tenkasi: 'TNK',
  Thanjavur: 'TNJ',
  Theni: 'THN',
  Thiruchirappalli: 'TRY',
  Thirunelveli: 'TNV',
  Thiruvallore: 'TVL',
  Thiruvanamalai: 'TVM',
  Thiruvarur: 'TVR',
  Thoothukudi: 'TUT',
  Tirupattur: 'TPT',
  Tiruppur: 'TPR',
  Vellore: 'VLR',
  Villupuram: 'VPM',
  Virudhunagar: 'VDN',
};

function districtCode(district) {
  if (DISTRICT_CODES[district]) return DISTRICT_CODES[district];
  // Fallback for a district name that doesn't exactly match (typo/future
  // district) - first 3 letters, uppercased, so centre creation never hard-fails.
  return (district || 'GEN').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
}

module.exports = { TN_DISTRICTS, DISTRICT_CODES, districtCode };
