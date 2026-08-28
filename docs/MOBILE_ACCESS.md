# Mobile Access

## Same Wi-Fi Access

When PQ COMMAND is running locally, mobile Safari users on the same Wi-Fi can open the host machine's LAN URL.

Current example:

- `http://192.168.1.188:3001`

Requirements:

- The laptop must be on.
- The app must be running.
- The phone must be on the same Wi-Fi network.
- Windows firewall must allow the Node.js app on the local network.

## Not The Same As Public Hosting

LAN access is not public internet access.

- Same Wi-Fi only: use the LAN URL.
- Public access from anywhere: deploy the app and worker on a host with a real domain and HTTPS.

## Recommended Public Setup

Use the hosted deployment shape documented in `docs/HOSTED_DEPLOYMENT.md`:

- `web`: `npm start`
- `worker`: `npm run bot`

Then mobile Safari users can access the real HTTPS domain instead of the LAN IP.