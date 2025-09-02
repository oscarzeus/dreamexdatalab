const http = require('http');

console.log('🧪 Testing SMTP status...');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/smtp-status',
    method: 'GET'
};

const req = http.request(options, (res) => {
    console.log(`✅ Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('📊 SMTP Status:', result);
        } catch (e) {
            console.log('📄 Raw response:', data);
        }
    });
});

req.on('error', (e) => {
    console.log(`❌ Connection error: ${e.message}`);
});

req.end();
