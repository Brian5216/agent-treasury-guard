import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getProjectRoot() {
  return path.resolve(__dirname, "..", "..");
}

export async function readJson(relativePath) {
  const target = path.join(getProjectRoot(), relativePath);
  const raw = await fs.readFile(target, "utf8");
  return JSON.parse(raw);
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function scale(value, min, max) {
  if (max === min) {
    return 0;
  }

  return clamp((value - min) / (max - min), 0, 1);
}

export function inverseScale(value, min, max) {
  return 1 - scale(value, min, max);
}

export function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(toNumber(value));
}

export function formatToken(value, symbol, digits = 4) {
  const numeric = toNumber(value);
  return `${numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits
  })} ${symbol}`;
}

export function titleCase(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function nowIso() {
  return new Date().toISOString();
}

export function toMinimalUnits(amount, decimals) {
  const [wholePart, fractionPart = ""] = String(amount).split(".");
  const safeFraction = fractionPart.padEnd(decimals, "0").slice(0, decimals);
  const whole = BigInt(wholePart || "0");
  const fraction = BigInt(safeFraction || "0");
  return (whole * 10n ** BigInt(decimals) + fraction).toString();
}

export function fromMinimalUnits(amount, decimals) {
  const raw = String(amount);
  if (!raw) {
    return 0;
  }

  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  const padded = digits.padStart(decimals + 1, "0");
  const split = padded.length - decimals;
  const whole = padded.slice(0, split);
  const fraction = padded.slice(split).replace(/0+$/, "");
  const merged = fraction ? `${whole}.${fraction}` : whole;
  const value = Number(negative ? `-${merged}` : merged);
  return Number.isFinite(value) ? value : 0;
}

export function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

export function isAddressLike(value) {
  return /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,64})$/.test(String(value || ""));
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}
