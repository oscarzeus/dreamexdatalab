// Quick test for Render service status
const https = require('https');

const testUrl = 'https://orange-money-api.onrender.com/health';

console.log(`Testing: ${testUrl}`);

https.get(testUrl, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Response body:', data);
    });
}).on('error', (err) => {
    console.log('Error:', err.message);
});