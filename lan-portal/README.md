# LAN Portal

Lightweight LAN portal — serve a PWA on your local network so any device on the same Wi‑Fi can open the app in the browser without installing anything.

Features (MVP)
- Hosts a static PWA frontend and a Node.js backend
- Detects local IP(s) and displays LAN URLs
- Generates a QR code for quick access
- Optional mDNS/Bonjour advertising
- Real-time messaging, presence and typing indicators (Socket.IO)
- PWA manifest + service worker (installable offline-capable shell)

Quick start (local)
1. Open a terminal in `lan-portal/backend`
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

4. On the host machine you'll see the LAN URL(s) printed, and a QR endpoint at `http://<your-ip>:3000/api/qr`.
5. Scan the QR or open the URL on any device on the same Wi‑Fi.

Run with Docker (optional)
```bash
docker-compose up --build
```

Notes & next steps
- TURN / WebRTC, voice/video and advanced features can be added on top of this scaffold.
- mDNS uses the `bonjour` package — on some platforms extra system packages may be required.

WebRTC (voice/video) notes
- The frontend now includes a real WebRTC one-to-one calling flow (offer/answer, ICE, candidates) using Socket.IO for signaling.
- Important: modern browsers require a secure context (HTTPS) to access microphone/camera on non-localhost origins. If you want to test calling between phones and other devices on the same Wi‑Fi, you have these options:
  1. Use `ngrok` to expose a secure HTTPS tunnel to your local server:

     ```bash
     # run your local server (port 3000)
     npm start
     # in a separate terminal (install ngrok first)
     ngrok http 3000
     ```

     Ngrok gives you an `https://...` URL you can open on mobile devices and the camera/mic will work.

  2. Create a locally-trusted certificate with `mkcert` (or similar) and run the server with HTTPS bound to your LAN IP. Then trust the generated CA on your mobile devices.

  3. For quick tests on a single machine, `localhost` is treated as secure — open two tabs and call between them.

TURN servers
- This project uses public STUN servers for NAT traversal by default. For calls across complex NATs or mobile networks, set up a TURN server (coturn) and configure its URL in the client `ICE_SERVERS` list.

Security
- The app is designed for local testing and demo use. Do not expose it to public networks without adding proper authentication, HTTPS, and rate limiting.

Folder layout
```
lan-portal/
  backend/
    server.js
    package.json
    public/ (frontend files)
    Dockerfile
  docker-compose.yml
  README.md
```

If you want, I can:
- Start the server here and test it on your LAN.
- Add voice/video (WebRTC) or a TURN/coturn guide for NAT traversal.
- Make the UI match a specific visual style.
