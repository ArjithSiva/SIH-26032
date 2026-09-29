// Run from the project root: node scripts/testBhashini.js
// (needs backend/node_modules to exist - run `cd backend && npm install`
// first if you haven't already)
//
// This calls the Pipeline Config step directly and prints exactly what
// Bhashini sends back, instead of the silent-fallback-to-English behaviour
// the app itself uses (see utils/bhashiniClient.js) - useful for telling
// apart "wrong credentials", "key not approved yet" and "network/DNS
// issue" from each other.
const fs = require('fs');
const path = require('path');

function loadBackendEnv() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env) && value) process.env[key] = value;
  }
}
loadBackendEnv();

const axios = require('../backend/node_modules/axios');

const ULCA_CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const PIPELINE_ID = process.env.BHASHINI_PIPELINE_ID || '64392f96daac500b55c543cd';

async function main() {
  console.log('Testing with:');
  console.log('  BHASHINI_USER_ID:', process.env.BHASHINI_USER_ID ? `${process.env.BHASHINI_USER_ID.slice(0, 6)}...` : '(not set)');
  console.log('  BHASHINI_API_KEY:', process.env.BHASHINI_API_KEY ? `${process.env.BHASHINI_API_KEY.slice(0, 6)}...` : '(not set)');
  console.log('  Pipeline ID:', PIPELINE_ID);
  console.log('');

  if (!process.env.BHASHINI_USER_ID || !process.env.BHASHINI_API_KEY) {
    console.error('Set BHASHINI_USER_ID and BHASHINI_API_KEY in backend/.env first.');
    process.exit(1);
  }

  try {
    const { data } = await axios.post(
      ULCA_CONFIG_URL,
      {
        pipelineTasks: [{ taskType: 'translation' }, { taskType: 'tts' }],
        pipelineRequestConfig: { pipelineId: PIPELINE_ID },
      },
      {
        headers: {
          userID: process.env.BHASHINI_USER_ID,
          ulcaApiKey: process.env.BHASHINI_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    console.log('SUCCESS - Pipeline Config responded. Your key is active and working.');
    console.log('Translation service ID:', data.pipelineResponseConfig?.find((c) => c.taskType === 'translation')?.config?.[0]?.serviceId);
    console.log('TTS service ID:', data.pipelineResponseConfig?.find((c) => c.taskType === 'tts')?.config?.[0]?.serviceId);
  } catch (err) {
    console.error('FAILED.');
    console.error('HTTP status:', err.response?.status);
    console.error('Response body:', JSON.stringify(err.response?.data, null, 2) || err.message);
    console.error('');
    if (err.response?.status === 401 || err.response?.status === 403) {
      console.error(
        'A 401/403 here most likely means your Udyat key is not fully approved yet - check ' +
          'the "Key Request Details" panel on your dashboard for BOTH "CEO\'s Approval" and ' +
          '"Manager\'s Approval". If Manager\'s Approval is still Pending, this will keep ' +
          'failing until that clears, regardless of how the .env values are set.'
      );
    } else if (!err.response) {
      console.error('No response at all - check your network/DNS can reach meity-auth.ulcacontrib.org.');
    }
  }
}

main();
