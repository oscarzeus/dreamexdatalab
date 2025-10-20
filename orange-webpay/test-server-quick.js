// Quick test to verify server starts
const PORT = process.env.PORT || 8080;
console.log('🔍 Testing server startup...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CWD:', process.cwd());

try {
    const server = require('./server.js');
    console.log('✅ Server module loaded successfully');
} catch (err) {
    console.error('❌ Error loading server:', err.message);
    console.error(err.stack);
    process.exit(1);
}
