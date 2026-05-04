// Direct test of SMB detection function
const { buildSMBProContext } = require('./lib/handlers/smb-detection.js');

const userId = '5cae9ba6-193d-473a-b18f-9785aa8f93cf';

console.log('Testing SMB Detection for user:', userId);

buildSMBProContext(userId)
  .then(result => {
    console.log('\n✅ Function completed successfully');
    console.log('Result length:', result.length);
    if (result) {
      console.log('Result preview:', result.substring(0, 200) + '...');
    } else {
      console.log('Result: empty string (no nudge triggered)');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Function failed with error:');
    console.error(err);
    process.exit(1);
  });
