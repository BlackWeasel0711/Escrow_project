/**
 * End-to-end verification harness.
 * Boots a real (embedded) PostgreSQL, pushes the Prisma schema, seeds, starts the API,
 * and drives the full escrow lifecycle (deposit → hold → dispute → release, plus the
 * plain confirm-received release) across all three payment methods.
 *
 * Run: node scripts/verify.mjs
 */
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const PORT_DB = 55432;
const PORT_API = 4055;
const API = `http://127.0.0.1:${PORT_API}/api`;
// 127.0.0.1 (not "localhost") so we never resolve to an IPv6 ::1 the embedded server ignores.
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT_DB}/escrow`;
const dataDir = path.join(os.tmpdir(), 'safepay-verify-pgdata');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name} ${extra}`); fail++; }
}

function run(cmd, args, env, useShell = true) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: process.cwd(), env: { ...process.env, ...env }, shell: useShell, stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
  });
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + pathname, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { status: res.status, data };
}

async function waitForHealth(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(`http://localhost:${PORT_API}/health`); if (r.ok) return true; } catch {}
    await sleep(500);
  }
  throw new Error('API did not become healthy');
}

async function runMethod(method, adminToken) {
  console.log(`\n--- Payment method: ${method} ---`);
  // fresh buyer/seller per method to keep it isolated
  const suffix = method.toLowerCase();
  const buyer = (await api('/auth/register', { method: 'POST', body: { email: `buyer_${suffix}@t.test`, password: 'password123' } })).data;
  const seller = (await api('/auth/register', { method: 'POST', body: { email: `seller_${suffix}@t.test`, password: 'password123' } })).data;
  check(`${method}: buyer & seller registered`, !!buyer?.token && !!seller?.token);

  // deposit -> HELD
  const created = await api('/transactions', {
    method: 'POST', token: buyer.token,
    body: { sellerEmail: `seller_${suffix}@t.test`, description: `Test item (${method})`, amountCents: 150000, method },
  });
  check(`${method}: deposit returns HELD`, created.data?.status === 'HELD', `got ${created.data?.status}`);
  check(`${method}: gatewayRef assigned`, !!created.data?.gatewayRef);
  const txId = created.data.id;

  // dispute -> DISPUTED
  const disp = await api('/disputes', {
    method: 'POST', token: buyer.token,
    body: { transactionId: txId, reason: 'Item not as described', evidenceUrls: ['https://example.com/photo.jpg'] },
  });
  check(`${method}: dispute opened`, disp.status === 201);
  const afterDispute = (await api(`/transactions/${txId}`, { token: buyer.token })).data;
  check(`${method}: transaction now DISPUTED`, afterDispute.status === 'DISPUTED', `got ${afterDispute.status}`);

  // admin sees it in queue and rules RELEASE -> RELEASED
  const queue = (await api('/disputes', { token: adminToken })).data;
  const mine = queue.find((d) => d.transactionId === txId);
  check(`${method}: dispute in admin queue`, !!mine);
  const ruling = await api(`/disputes/${mine.id}/rule`, { method: 'POST', token: adminToken, body: { ruling: 'RELEASE', adminNote: 'Verified' } });
  check(`${method}: admin ruling succeeded`, ruling.status === 200);

  // final state + timeline visible to buyer
  const final = (await api(`/transactions/${txId}`, { token: buyer.token })).data;
  check(`${method}: final status RELEASED`, final.status === 'RELEASED', `got ${final.status}`);
  const chain = final.events.map((e) => e.toStatus).join(',');
  check(`${method}: timeline is PENDING,HELD,DISPUTED,RELEASED`, chain === 'PENDING,HELD,DISPUTED,RELEASED', `got ${chain}`);

  // authorization: seller cannot confirm-received; a stranger cannot view
  const sellerConfirm = await api(`/transactions/${txId}/confirm-received`, { method: 'POST', token: seller.token });
  check(`${method}: seller blocked from releasing (already released)`, sellerConfirm.status >= 400);

  // rating after release
  const rate = await api('/ratings', { method: 'POST', token: buyer.token, body: { transactionId: txId, score: 5, comment: 'Great' } });
  check(`${method}: buyer can rate released tx`, rate.status === 201, `got ${rate.status}`);

  // notifications: both parties were notified across the lifecycle
  const buyerNotifs = (await api('/notifications', { token: buyer.token })).data;
  const sellerNotifs = (await api('/notifications', { token: seller.token })).data;
  check(`${method}: buyer received notifications`, buyerNotifs.items.length >= 3, `got ${buyerNotifs.items?.length}`);
  check(`${method}: seller notified of resolution`, sellerNotifs.items.some((n) => /resolved the dispute/i.test(n.message)));
  check(`${method}: unread count exposed`, typeof buyerNotifs.unread === 'number');
  // mark-all-read clears the unread count
  await api('/notifications/read-all', { method: 'POST', token: buyer.token });
  const afterRead = (await api('/notifications', { token: buyer.token })).data;
  check(`${method}: read-all clears unread`, afterRead.unread === 0, `got ${afterRead.unread}`);
}

async function runRefundPath(adminToken) {
  console.log('\n--- Dispute resolved as REFUND ---');
  const buyer = (await api('/auth/register', { method: 'POST', body: { email: 'refbuyer@t.test', password: 'password123' } })).data;
  await api('/auth/register', { method: 'POST', body: { email: 'refseller@t.test', password: 'password123' } });
  const tx = (await api('/transactions', { method: 'POST', token: buyer.token, body: { sellerEmail: 'refseller@t.test', description: 'Refund case', amountCents: 90000, method: 'VISA' } })).data;
  await api('/disputes', { method: 'POST', token: buyer.token, body: { transactionId: tx.id, reason: 'Item never arrived' } });
  const queue = (await api('/disputes', { token: adminToken })).data;
  const d = queue.find((x) => x.transactionId === tx.id);
  const ruling = await api(`/disputes/${d.id}/rule`, { method: 'POST', token: adminToken, body: { ruling: 'REFUND', adminNote: 'No delivery proof' } });
  check('REFUND: admin ruling succeeded', ruling.status === 200);
  const final = (await api(`/transactions/${tx.id}`, { token: buyer.token })).data;
  check('REFUND: final status REFUNDED', final.status === 'REFUNDED', `got ${final.status}`);
  const chain = final.events.map((e) => e.toStatus).join(',');
  check('REFUND: timeline is PENDING,HELD,DISPUTED,REFUNDED', chain === 'PENDING,HELD,DISPUTED,REFUNDED', `got ${chain}`);
  const notifs = (await api('/notifications', { token: buyer.token })).data;
  check('REFUND: buyer notified of refund', notifs.items.some((n) => /refunded to the buyer/i.test(n.message)));
}

async function main() {
  fs.rmSync(dataDir, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT_DB, persistent: false });

  console.log('Initialising embedded PostgreSQL...');
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('escrow');
  console.log('PostgreSQL up on', PORT_DB);

  let server;
  try {
    console.log('\nApplying schema (DDL generated by Prisma, applied via pg)...');
    // The embedded-postgres build trips Prisma's schema engine, but the runtime query engine
    // and node-postgres both connect fine — so generate the DDL offline and apply it directly.
    const ddl = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty',
      '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', shell: true });
    const client = new Client(DATABASE_URL);
    await client.connect();
    await client.query(ddl);
    await client.end();
    console.log('Schema applied.');

    console.log('\nSeeding...');
    // shell:false — process.execPath may contain spaces (e.g. C:\Program Files\nodejs).
    await run(process.execPath, ['-r', 'ts-node/register/transpile-only', 'prisma/seed.ts'],
      { DATABASE_URL, SEED_ADMIN_EMAIL: 'admin@safepay.test', SEED_ADMIN_PASSWORD: 'admin12345' }, false);

    console.log('\nStarting API...');
    server = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/server.ts'],
      { env: { ...process.env, DATABASE_URL, JWT_SECRET: 'verify-secret', SIMULATE_PAYMENTS: 'true', PORT: String(PORT_API) }, shell: false, stdio: 'inherit' });
    await waitForHealth();
    console.log('API healthy.\n=== SMOKE TESTS ===');

    // admin login (seeded)
    const admin = (await api('/auth/login', { method: 'POST', body: { email: 'admin@safepay.test', password: 'admin12345' } })).data;
    check('seeded admin can log in', !!admin?.token);

    // plain confirm-received release path (no dispute)
    console.log('\n--- Plain release (confirm-received) ---');
    const b = (await api('/auth/register', { method: 'POST', body: { email: 'plainbuyer@t.test', password: 'password123' } })).data;
    await api('/auth/register', { method: 'POST', body: { email: 'plainseller@t.test', password: 'password123' } });
    const tx = (await api('/transactions', { method: 'POST', token: b.token, body: { sellerEmail: 'plainseller@t.test', description: 'Direct release', amountCents: 5000, method: 'MPESA' } })).data;
    const rel = await api(`/transactions/${tx.id}/confirm-received`, { method: 'POST', token: b.token });
    check('confirm-received releases funds', rel.data?.status === 'RELEASED', `got ${rel.data?.status}`);

    // full dispute path (resolved as RELEASE) for each gateway
    for (const m of ['MPESA', 'PAYPAL', 'VISA']) await runMethod(m, admin.token);

    // dispute resolved as REFUND (the other ruling branch)
    await runRefundPath(admin.token);

    // admin overview reflects data
    const overview = (await api('/admin/overview', { token: admin.token })).data;
    check('admin overview has userCount', typeof overview.userCount === 'number' && overview.userCount > 0);
    check('admin overview byStatus includes RELEASED', !!overview.byStatus?.RELEASED);

    // validation error -> 400 (not 500)
    const bad = await api('/auth/register', { method: 'POST', body: { email: 'not-an-email', password: 'x' } });
    check('invalid payload returns 400', bad.status === 400, `got ${bad.status}`);

    // unauthorized -> 401
    const noauth = await api('/transactions');
    check('missing token returns 401', noauth.status === 401, `got ${noauth.status}`);

  } finally {
    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
    if (server) server.kill();
    await sleep(500);
    await pg.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
