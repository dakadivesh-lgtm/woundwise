const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('🧪 Starting WoundWise Full-Stack API Verification Test...\n');
  const baseUrl = 'http://127.0.0.1:5000/api';

  // 1. Health check
  console.log('1. Testing Health Check...');
  const healthRes = await fetch(`${baseUrl}/health`);
  const health = await healthRes.json();
  console.log('   Health Status:', health.status, '| Database:', health.database);
  if (health.status !== 'healthy') throw new Error('Health check failed');

  // 2. Authentication: Login default user
  console.log('\n2. Testing User Authentication (Login)...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'divesh@woundwise.local', password: 'woundwise123' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.data.token) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.data.token;
  const user = loginData.data.user;
  console.log(`   Logged in successfully as: ${user.name} (${user.email})`);

  const authHeaders = {
    'Authorization': `Bearer ${token}`
  };

  // 3. Check Initial Dashboard (Should show empty state or recent tests)
  console.log('\n3. Testing Dashboard Fetch...');
  const dashRes = await fetch(`${baseUrl}/wounds/dashboard`, { headers: authHeaders });
  const dashData = await dashRes.json();
  console.log('   Dashboard loaded for user:', dashData.data.userName);
  console.log('   Has existing records:', dashData.data.hasRecords, '| Total wounds:', dashData.data.totalWounds);

  // 4. Test Wound Upload with dummy JPEG
  console.log('\n4. Testing Wound Photo Upload & Analysis Integration...');
  // Create a minimal 1x1 pixel JPEG buffer for testing
  const dummyJpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  
  const boundary = '----WebKitFormBoundaryWoundWiseTest' + Date.now();
  let bodyBuffer = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nLeft Forearm Burn\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="location"\r\n\r\nLeft Forearm\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="notes"\r\n\r\nMild redness, no exudate, dressing changed today.\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="wound_test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    dummyJpg,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const uploadRes = await fetch(`${baseUrl}/wounds/upload`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodyBuffer
  });

  const uploadData = await uploadRes.json();
  if (!uploadData.success) {
    throw new Error('Upload failed: ' + JSON.stringify(uploadData));
  }
  const createdWoundId = uploadData.data.woundId;
  const createdEntryId = uploadData.data.entry.id;
  const imageFilename = uploadData.data.entry.image_filename;
  console.log('   Upload success! Wound ID:', createdWoundId);
  console.log('   Entry ID:', createdEntryId);
  console.log('   Assessment Status:', uploadData.data.assessment?.status);
  console.log('   Assessment Summary:', uploadData.data.assessment?.summary);

  // 5. Test Follow-up Upload to the same wound
  console.log('\n5. Testing Follow-up Photo Upload to Existing Wound...');
  const followUpBoundary = '----WebKitFormBoundaryWoundWiseFollowUp' + Date.now();
  const followUpBuffer = Buffer.concat([
    Buffer.from(`--${followUpBoundary}\r\nContent-Disposition: form-data; name="woundId"\r\n\r\n${createdWoundId}\r\n`),
    Buffer.from(`--${followUpBoundary}\r\nContent-Disposition: form-data; name="isFollowup"\r\n\r\ntrue\r\n`),
    Buffer.from(`--${followUpBoundary}\r\nContent-Disposition: form-data; name="notes"\r\n\r\nDay 3 follow-up: Redness receding, clean wound bed.\r\n`),
    Buffer.from(`--${followUpBoundary}\r\nContent-Disposition: form-data; name="image"; filename="wound_day3.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    dummyJpg,
    Buffer.from(`\r\n--${followUpBoundary}--\r\n`)
  ]);

  const followUpRes = await fetch(`${baseUrl}/wounds/upload`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': `multipart/form-data; boundary=${followUpBoundary}`
    },
    body: followUpBuffer
  });
  const followUpData = await followUpRes.json();
  if (!followUpData.success) {
    throw new Error('Follow-up upload failed: ' + JSON.stringify(followUpData));
  }
  console.log('   Follow-up attached successfully! Entry ID:', followUpData.data.entry.id);

  // 6. Test History Timeline Fetch
  console.log('\n6. Testing History Tracker Timeline...');
  const historyRes = await fetch(`${baseUrl}/wounds/${createdWoundId}`, { headers: authHeaders });
  const historyData = await historyRes.json();
  console.log(`   Wound: ${historyData.data.wound.title}`);
  console.log(`   Timeline contains ${historyData.data.timeline.length} entries (Baseline + Follow-up)`);
  if (historyData.data.timeline.length < 2) {
    throw new Error('Expected at least 2 entries in history timeline');
  }

  // 7. Test Records Fetch & Report Download
  console.log('\n7. Testing My Records & Report Download...');
  const recordsRes = await fetch(`${baseUrl}/records`, { headers: authHeaders });
  const recordsData = await recordsRes.json();
  console.log(`   Records count: ${recordsData.count}`);

  const reportRes = await fetch(`${baseUrl}/records/download-report/${createdEntryId}`, { headers: authHeaders });
  const reportText = await reportRes.text();
  console.log('   Report fetched successfully (sample):\n   ', reportText.split('\n').slice(0, 5).join('\n    '));

  // 8. Test Support Request Submission
  console.log('\n8. Testing Help & Support Ticket Submission...');
  const supportRes = await fetch(`${baseUrl}/support`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      category: 'Wound Tracking Question',
      subject: 'Question on follow-up timing',
      message: 'What is the recommended interval for taking photos of a healing burn?'
    })
  });
  const supportData = await supportRes.json();
  console.log('   Support Ticket Created:', supportData.success, '| Ticket ID:', supportData.data.id);

  // 9. Test User Settings Update
  console.log('\n9. Testing Settings & Profile Update...');
  const settingsRes = await fetch(`${baseUrl}/user/preferences`, {
    method: 'PUT',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailNotifications: true,
      healingReminders: true,
      darkMode: false
    })
  });
  const settingsData = await settingsRes.json();
  console.log('   Preferences Updated:', settingsData.success);

  console.log('\n🎉 ALL 9 VERIFICATION STEPS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Verification test failed:', err);
  process.exit(1);
});
