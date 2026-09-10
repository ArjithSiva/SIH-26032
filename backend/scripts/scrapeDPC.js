require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Centre = require('../models/Centre');
const { generateCentrePrefix } = require('../utils/centrePrefix');

const DEFAULT_OFFICER_PASSWORD = process.env.DEFAULT_OFFICER_PASSWORD || 'centre123';

const DPC_URL = 'https://tncsc.tn.gov.in/en/DPC.html';

// TNCSC dates are DD/MM/YYYY, or "-" for "still open, no closing date yet".
function parseDpcDate(value) {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === '-') return null;
  const [day, month, year] = trimmed.split('/').map(Number);
  if (!day || !month || !year) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function parseGeoCoordinates($, cell) {
  // The coordinates render as a link whose text is "lat,lng" - fall back to
  // the raw cell text if the markup ever changes and there's no link.
  const linkText = $(cell).find('a').first().text().trim();
  const raw = linkText || $(cell).text().trim();
  const [latStr, lngStr] = raw.split(',').map((s) => s.trim());
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lngStr);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return { latitude, longitude };
}

async function fetchAndParseDPCTable() {
  const { data: html } = await axios.get(DPC_URL, { timeout: 30000 });
  const $ = cheerio.load(html);

  // The page has exactly one large data table (Sl.No / Region / Taluk /
  // Village / Opening / Closing / Status / Geo-Coordinates) - find it by
  // matching its header row rather than assuming a fixed table index, so a
  // future markup reshuffle doesn't silently break the scraper.
  let table = null;
  $('table').each((_, el) => {
    const headerText = $(el).find('tr').first().text();
    if (headerText.includes('Region Name') && headerText.includes('DPC Status')) {
      table = el;
    }
  });

  if (!table) {
    throw new Error('Could not locate the DPC table on the page - the site markup may have changed.');
  }

  const rows = [];
  $(table)
    .find('tr')
    .slice(1) // skip header row
    .each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length < 8) return;

      const region = $(cells[1]).text().trim();
      const taluk = $(cells[2]).text().trim();
      const village = $(cells[3]).text().trim();
      const openingDate = $(cells[4]).text().trim();
      const closingDate = $(cells[5]).text().trim();
      const status = $(cells[6]).text().trim();
      const geo = parseGeoCoordinates($, cells[7]);

      if (!region || !village) return;

      rows.push({
        district: region,
        taluk,
        village,
        seasonOpeningDate: parseDpcDate(openingDate),
        seasonClosingDate: parseDpcDate(closingDate),
        dpcStatus: status,
        location: geo,
      });
    });

  return rows;
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('Set MONGODB_URI in backend/.env before running the scraper.');
    process.exit(1);
  }

  console.log(`Fetching ${DPC_URL} ...`);
  const allRows = await fetchAndParseDPCTable();
  console.log(`Parsed ${allRows.length} total DPC rows.`);

  const openRows = allRows.filter((r) => r.dpcStatus === 'Open');
  console.log(`${openRows.length} are currently Open - Closed centres are dropped as dead weight.`);

  if (!openRows.length) {
    console.error('No Open rows parsed - aborting without touching the database.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB. Upserting centres...');

  const now = new Date();
  let created = 0;
  let updated = 0;

  for (const row of openRows) {
    const name = `${row.village} DPC`;
    const existing = await Centre.findOne({ district: row.district, taluk: row.taluk, village: row.village }).select('_id');
    const codePrefix = existing ? undefined : await generateCentrePrefix(row.district);

    const result = await Centre.findOneAndUpdate(
      { district: row.district, taluk: row.taluk, village: row.village },
      {
        $set: {
          name,
          district: row.district,
          taluk: row.taluk,
          village: row.village,
          location: row.location || undefined,
          seasonOpeningDate: row.seasonOpeningDate,
          seasonClosingDate: row.seasonClosingDate,
          dpcStatus: 'Open',
          isActive: true,
          sourceLastScrapedAt: now,
        },
        $setOnInsert: {
          crops: [{ name: 'Paddy', maxQuantity: null }], // DPCs are paddy-only per TNCSC's own description
          officerPasswordHash: await bcrypt.hash(DEFAULT_OFFICER_PASSWORD, 10),
          mustChangeOfficerPassword: true,
          state: 'Tamil Nadu',
          ...(codePrefix ? { codePrefix } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true }
    );

    if (result.lastErrorObject?.updatedExisting) updated += 1;
    else created += 1;
  }

  // Anything previously marked Open that wasn't touched by this run (every
  // upsert above stamped sourceLastScrapedAt = now) is no longer Open in the
  // source - deactivate rather than delete, so historical bookings still
  // resolve their centre reference.
  const deactivated = await Centre.updateMany(
    { dpcStatus: 'Open', sourceLastScrapedAt: { $ne: now } },
    { $set: { dpcStatus: 'Closed', isActive: false } }
  );

  console.log(`Done. Created: ${created}, updated: ${updated}, deactivated (no longer Open): ${deactivated.modifiedCount}.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('DPC scrape failed:', err.message);
  process.exit(1);
});
