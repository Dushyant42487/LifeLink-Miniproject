require('dotenv').config({ path: '../.env' });
console.log('URL:', process.env.SUPABASE_URL);
console.log('KEY:', process.env.SUPABASE_SECRET_KEY ? 'exists' : 'missing');
