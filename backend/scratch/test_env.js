const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env.production.local') });
console.log('Value on disk is starts with:', process.env.MONGODB_URI.substring(0, 15));
