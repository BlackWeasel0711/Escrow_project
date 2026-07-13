import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { app } from './app';

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

// If TLS cert paths are provided, serve HTTPS directly. Otherwise serve HTTP
// (the normal setup behind a TLS-terminating proxy such as Render/Nginx/Cloudflare).
const keyPath = process.env.TLS_KEY_PATH;
const certPath = process.env.TLS_CERT_PATH;

if (keyPath && certPath) {
  const options = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  https.createServer(options, app).listen(port, () => {
    console.log(`Escrow API listening on https://localhost:${port} (native TLS)`);
  });
} else {
  http.createServer(app).listen(port, () => {
    console.log(`Escrow API listening on http://localhost:${port}`);
  });
}
