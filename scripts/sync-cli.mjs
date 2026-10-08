#!/usr/bin/env node
/**
 * CLI Helper to trigger synchronization of InfoCVE data feeds.
 * Usage: npm run sync
 */

import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
  }
  return env;
}

const rootDir = process.cwd();
const localEnv = loadEnvFile(path.join(rootDir, ".env.local"));
const defaultEnv = loadEnvFile(path.join(rootDir, ".env"));

const adminSecret = process.env.ADMIN_SECRET || localEnv.ADMIN_SECRET || defaultEnv.ADMIN_SECRET;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || localEnv.NEXT_PUBLIC_SITE_URL || defaultEnv.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

console.log("\n=======================================================");
console.log(" 🔄 InfoCVE Data Synchronization CLI");
console.log("=======================================================\n");

if (!adminSecret) {
  console.error("❌ ADMIN_SECRET belum dikonfigurasi.");
  console.error("   Tambahkan ADMIN_SECRET di file .env.local Anda untuk mengamankan sinkronisasi.");
  console.error("   Contoh:");
  console.error("   ADMIN_SECRET=rahasia_admin_anda_disini\n");
  process.exit(1);
}

const syncUrl = `${baseUrl.replace(/\/$/, "")}/api/sync`;
console.log(`📡 Menghubungi endpoint sinkronisasi: ${syncUrl}...`);

try {
  const startTime = Date.now();
  const res = await fetch(syncUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminSecret}`,
      "Content-Type": "application/json",
      "User-Agent": "InfoCVE-CLI/0.1.0",
    },
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (res.status === 401 || res.status === 403) {
    console.error(`❌ Gagal otorisasi (HTTP ${res.status}). Pastikan ADMIN_SECRET di .env.local cocok.`);
    process.exit(1);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ Sinkronisasi gagal dengan status HTTP ${res.status}: ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`✅ Sinkronisasi berhasil diselesaikan dalam ${duration} detik!\n`);
  console.log(`📊 Total CVE disinkronkan: ${data.totalSynced ?? 0}`);

  if (Array.isArray(data.results)) {
    console.log("📋 Rincian feed sumber:");
    for (const r of data.results) {
      const statusIcon = r.success ? "✓" : "✗";
      console.log(`   ${statusIcon} [${r.sourceId}]: ${r.itemsSynced} entri (${(r.durationMs / 1000).toFixed(2)}s)`);
    }
  }
  console.log("\n=======================================================\n");
} catch (err) {
  console.error("❌ Gagal terhubung ke server InfoCVE:");
  console.error(`   ${err.message}`);
  console.error("\n💡 Pastikan server InfoCVE sedang berjalan terlebih dahulu (misal: npm run dev atau npm run start).");
  console.error(`   URL yang dihubungi: ${syncUrl}\n`);
  process.exit(1);
}
