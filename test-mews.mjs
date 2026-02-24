// Quick test of Mews API
const MEWS_DEMO_URL = 'https://api.mews-demo.com/api/connector/v1';
const credentials = {
  ClientToken: 'E0D439EE522F44368DC78E1BFB03710C-D24FB11DBE31D4621C4817E028D9E1D',
  AccessToken: '7059D2C25BF64EA681ACAB3A00B859CC-D91BFF2B1E3047A3E0DEC1D57BE1382',
  Client: 'EywaAI'
};

async function test() {
  console.log('🔌 Testing Mews API connection...\n');
  
  const response = await fetch(`${MEWS_DEMO_URL}/configuration/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  
  const data = await response.json();
  
  console.log('✅ Connected to Mews!');
  console.log('🏨 Hotel:', data.Enterprise?.Name);
  console.log('🌍 Timezone:', data.Enterprise?.TimeZoneIdentifier);
  console.log('💰 Currency:', data.Enterprise?.DefaultCurrencyCode);
  console.log('\n🌳 Eywa neural link established!');
}

test().catch(e => console.error('❌ Error:', e.message));
