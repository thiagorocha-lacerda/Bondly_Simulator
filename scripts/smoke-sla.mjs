// Smoke e2e do SLA técnico contra o servidor REAL (auth-proxy buildado + SQLite).
// Sobe o server, minta um cookie tech, exercita submeter→sla→pause→resume→reunião→complete.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { createSessionToken } from '../apps/auth-proxy/dist/session.js';

const ROOT = process.cwd();
const SEC = 'smoke-secret-12345678901234567890';
const PORT = 8793;
const BASE = `http://127.0.0.1:${PORT}`;
// Dir efêmero sob KIROCREW_SCRATCH (reclamado pela sessão); cai em cwd se a env não existir.
const scratch = process.env.KIROCREW_SCRATCH || ROOT;
const dataDir = mkdtempSync(join(scratch, 'sla-e2e-'));

const srv = spawn(process.execPath, ['apps/auth-proxy/dist/server.js'], {
  cwd: ROOT,
  env: {
    ...process.env,
    DATA_DIR: dataDir,
    SESSION_SECRET: SEC,
    PORT: String(PORT),
    STATIC_DIR: join(dataDir, 'static'),
    PUBLIC_URL: BASE,
    GOOGLE_CLIENT_ID: 'dummy.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'dummy-secret',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let bootLog = '';
srv.stdout.on('data', (d) => (bootLog += d));
srv.stderr.on('data', (d) => (bootLog += d));

const cookieTech = 'bondly_sess=' + createSessionToken({ email: 'tech@minu.co', domain: 'minu.co', role: 'tech' }, SEC);
const cookieBiz = 'bondly_sess=' + createSessionToken({ email: 'biz@minu.co', domain: 'minu.co', role: 'business' }, SEC);
const H = { Cookie: cookieTech, 'Content-Type': 'application/json', Accept: 'application/json' };
const HB = { Cookie: cookieBiz, 'Content-Type': 'application/json', Accept: 'application/json' };
const results = [];
const check = (name, cond, detail) => results.push({ name, ok: !!cond, detail });

async function waitHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

try {
  const healthy = await waitHealth();
  check('server sobe e /healthz=200', healthy);
  check('boot usa SQLite', /"repo":"sqlite"/.test(bootLog), bootLog.match(/"repo":"\w+"/)?.[0]);
  if (!healthy) throw new Error('server não respondeu /healthz\n' + bootLog);

  const createRes = await fetch(`${BASE}/api/proposals`, { method: 'POST', headers: HB, body: JSON.stringify({ commercial: { users: 1000 } }) });
  const create = await createRes.json();
  const id = create.proposal?.id;
  check('cria proposta (business)', !!id, id ?? `status=${createRes.status} body=${JSON.stringify(create)}`);
  if (!id) throw new Error('criação falhou: status=' + createRes.status + ' body=' + JSON.stringify(create));

  await fetch(`${BASE}/api/proposals/${id}/transition`, { method: 'POST', headers: HB, body: JSON.stringify({ version: 1, transition: 'submeter_analise' }) });
  const s1 = (await (await fetch(`${BASE}/api/proposals/${id}/sla`, { headers: H })).json()).sla;
  check('submeter_analise inicia SLA (em_andamento, 5 dias)', s1.phase === 'em_andamento' && s1.businessDaysRemaining === 5, `phase=${s1.phase} rem=${s1.businessDaysRemaining}`);

  const sp = (await (await fetch(`${BASE}/api/proposals/${id}/sla/pause`, { method: 'POST', headers: H, body: JSON.stringify({ reason: 'faltam specs ERP' }) })).json()).sla;
  check('pause → pausado', sp.phase === 'pausado', `phase=${sp.phase}`);

  const sr = (await (await fetch(`${BASE}/api/proposals/${id}/sla/resume`, { method: 'POST', headers: H, body: JSON.stringify({}) })).json()).sla;
  check('resume → em_andamento, saldo preservado (5)', sr.phase === 'em_andamento' && sr.businessDaysRemaining === 5, `phase=${sr.phase} rem=${sr.businessDaysRemaining}`);

  const mt = await (await fetch(`${BASE}/api/proposals/${id}/meetings`, { method: 'POST', headers: H, body: JSON.stringify({ objective: 'esclarecer ERP' }) })).json();
  check('solicita reunião (solicitada, slaUnaffected)', mt.meeting?.state === 'solicitada' && mt.slaUnaffected === true, `state=${mt.meeting?.state} unaffected=${mt.slaUnaffected}`);

  const s2 = (await (await fetch(`${BASE}/api/proposals/${id}/sla`, { headers: H })).json()).sla;
  check('§6.4 reunião NÃO pausou o SLA (segue em_andamento)', s2.phase === 'em_andamento', `phase=${s2.phase}`);

  const sc = (await (await fetch(`${BASE}/api/proposals/${id}/sla/complete`, { method: 'POST', headers: H, body: JSON.stringify({ verdict: 'aprovado' }) })).json()).sla;
  check('complete → concluído, verdict, metSla', sc.phase === 'concluido' && sc.verdict === 'aprovado' && sc.metSla === true, `phase=${sc.phase} verdict=${sc.verdict} metSla=${sc.metSla}`);

  // RBAC: business não pode pausar
  const forbid = await fetch(`${BASE}/api/proposals/${id}/sla/pause`, { method: 'POST', headers: HB, body: JSON.stringify({ reason: 'x' }) });
  check('RBAC: business não pausa (403)', forbid.status === 403, `status=${forbid.status}`);
} finally {
  srv.kill();
}

let allOk = true;
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  if (!r.ok) allOk = false;
}
console.log(allOk ? '\nSMOKE SLA: PASS' : '\nSMOKE SLA: FAIL');
process.exit(allOk ? 0 : 1);
