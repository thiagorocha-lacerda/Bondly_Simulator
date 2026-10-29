#!/usr/bin/env node
/**
 * Gerador de hash de código de perfil (2º fator §7.2/§7.3).
 * Replica EXATAMENTE o scryptHasher de apps/auth-proxy/src/profileCodes.ts
 * (scrypt nativo, N=16384 r=8 p=1, keylen=32, formato scrypt$N$r$p$salt$derived em base64url).
 *
 * Uso:   node scripts/gen-profile-hash.mjs '<codigo-em-texto-puro>'
 * Saída: a string de hash para colar em PROFILE_CODE_HASH_<PAPEL> no painel da Render.
 *
 * NUNCA commite o código em texto puro nem o hash num arquivo versionado — só env var (sync:false).
 */
import { scryptSync, randomBytes } from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 32;
const b64url = (buf) => buf.toString('base64url');

function hash(secret) {
  const salt = randomBytes(16);
  const derived = scryptSync(secret, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${b64url(salt)}$${b64url(derived)}`;
}

const code = process.argv[2];
if (!code) {
  console.error('Uso: node scripts/gen-profile-hash.mjs \'<codigo>\'');
  process.exit(1);
}
process.stdout.write(hash(code) + '\n');
