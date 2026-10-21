require('dotenv').config();
const express = require('express');
const smsRouter = require('./routes/smsRouter');

const app = express();
app.use(express.json());
app.use('/', smsRouter);

const PORT = process.env.PORT || 7001;

app.listen(PORT, () => {
  console.log(`SMS service listening on port ${PORT}`);
  console.log(`POST http://localhost:${PORT}/send-sms`);
});
