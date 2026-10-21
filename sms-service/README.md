# SMS Service (send-only)

A minimal Node.js microservice that sends SMS by bridging to the **SMS Gateway for Android**
app (Local Server mode) running on your phone.

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your phone's current local IP, port, and Local Server credentials
```

## Run standalone

```bash
npm start
```

Service listens on `PORT` from `.env` (default `7001`).

## API

### `POST /send-sms`

**Request body**
```json
{
  "phoneNumber": "8888608739",
  "message": "Hello from my web app"
}
```

- `phoneNumber` can be given with or without `+91` — it's normalized automatically.
  Spaces and dashes are stripped first.
- `message` is sent as-is.

**Success response — `200`**
```json
{
  "success": true,
  "data": { "...": "raw response from SMS gateway" }
}
```

**Validation error — `400`**
```json
{ "success": false, "error": "phoneNumber is required" }
```

**Gateway unreachable / failed — `502`**
```json
{
  "success": false,
  "error": "Failed to send SMS via gateway",
  "detail": "...",
  "gatewayStatus": 401
}
```

## Integrating into an existing Express app

Instead of running `server.js` standalone, mount the router directly:

```js
const smsRouter = require('./sms-service/routes/smsRouter');
app.use('/sms', smsRouter); // now exposed at POST /sms/send-sms
```

Make sure `express.json()` middleware and the same `.env` variables
(`GATEWAY_HOST`, `GATEWAY_PORT`, `GATEWAY_USER`, `GATEWAY_PASS`) are available
wherever this router is mounted.

## Notes

- If your phone's local IP changes (Wi-Fi reconnect), update `GATEWAY_HOST` in
  `.env` and restart — or better, reserve a static IP for the phone in your
  router's DHCP settings so this never changes.
- This service is **send-only** by design. Receiving SMS (webhooks) can be
  added later as a separate `/receive-sms` route without touching this one.
