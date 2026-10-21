import "server-only";
import fs from "node:fs";
import zlib from "node:zlib";
import ipaddr from "ipaddr.js";
import { gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { ipBans } from "@/lib/db/schema";

/** /24 for IPv4, /48 for IPv6: the unit a single customer usually controls. */
export function subnetOf(ip: string) {
  try {
    const addr = ipaddr.process(ip);
    if (addr.kind() === "ipv4") return `${addr.toByteArray().slice(0, 3).join(".")}.0/24`;
    const parts = (addr as ipaddr.IPv6).toNormalizedString().split(":");
    return `${parts.slice(0, 3).join(":")}::/48`;
  } catch {
    return "unknown";
  }
}

/* ── IP bans (CIDR) ── */

let bansCache: { at: number; list: [ipaddr.IPv4 | ipaddr.IPv6, number][] } | null = null;

export async function isBannedIp(ip: string) {
  if (!bansCache || Date.now() - bansCache.at > 60_000) {
    const rows = await db
      .select({ cidr: ipBans.cidr })
      .from(ipBans)
      .where(or(isNull(ipBans.expiresAt), gt(ipBans.expiresAt, new Date())));
    const list: [ipaddr.IPv4 | ipaddr.IPv6, number][] = [];
    for (const r of rows) {
      try {
        list.push(r.cidr.includes("/") ? ipaddr.parseCIDR(r.cidr) : [ipaddr.parse(r.cidr), ipaddr.parse(r.cidr).kind() === "ipv4" ? 32 : 128]);
      } catch {}
    }
    bansCache = { at: Date.now(), list };
  }
  try {
    const addr = ipaddr.process(ip);
    return bansCache.list.some(([range, bits]) => range.kind() === addr.kind() && addr.match(range, bits));
  } catch {
    return false;
  }
}

/* ── ASN lookup (optional ip2asn database, https://iptoasn.com, public domain) ── */

type AsnTable = { starts: Uint32Array; ends: Uint32Array; asn: Uint32Array; names: string[]; nameIdx: Uint32Array };
let asnTable: AsnTable | null | undefined;

/** Hosting, cloud and VPN networks: sign-ups from these get stricter limits and no free credits. */
const HOSTING_RE =
  /amazon|aws|google|microsoft|azure|digitalocean|linode|akamai|ovh|hetzner|scaleway|online s\.a\.s|contabo|vultr|choopa|constant|leaseweb|m247|datacamp|cdn77|ionos|1&1|hostinger|godaddy|oracle|alibaba|tencent|huawei|cloudflare|fastly|packet|equinix|zenlayer|psychz|quadranet|colocrossing|hostwinds|hostpapa|nforce|serverius|worldstream|xtom|aeza|pq hosting|timeweb|selectel|g-core|gcore|kamatera|ramnode|buyvm|frantech|incapsula|stackpath|tzulo|hivelocity|servers\.com|limestone|interserver|nexeon|tor|vpn|proxy|privacy|nord|surfshark|mullvad|proton|expressvpn|private internet|cyberghost|hide\.me|ipvanish|windscribe/i;

function loadAsn(): AsnTable | null {
  const file = process.env.FORGED_IP2ASN_PATH;
  if (!file || !fs.existsSync(file)) return null;
  try {
    let raw = fs.readFileSync(file);
    if (file.endsWith(".gz")) raw = zlib.gunzipSync(raw);
    const lines = raw.toString("utf8").split("\n");
    const starts = new Uint32Array(lines.length);
    const ends = new Uint32Array(lines.length);
    const asn = new Uint32Array(lines.length);
    const nameIdx = new Uint32Array(lines.length);
    const names: string[] = [];
    const nameMap = new Map<string, number>();
    let n = 0;
    for (const line of lines) {
      const [s, e, a, , desc] = line.split("\t");
      if (!s || !e || !a || a === "0") continue;
      const si = v4ToInt(s);
      const ei = v4ToInt(e);
      if (si === null || ei === null) continue;
      starts[n] = si;
      ends[n] = ei;
      asn[n] = Number(a);
      let idx = nameMap.get(desc ?? "");
      if (idx === undefined) {
        idx = names.push(desc ?? "") - 1;
        nameMap.set(desc ?? "", idx);
      }
      nameIdx[n] = idx;
      n++;
    }
    console.log(`[abuse] loaded ${n} ASN ranges`);
    return { starts: starts.slice(0, n), ends: ends.slice(0, n), asn: asn.slice(0, n), names, nameIdx: nameIdx.slice(0, n) };
  } catch (err) {
    console.warn("[abuse] could not load ASN database", (err as Error).message);
    return null;
  }
}

function v4ToInt(ip: string) {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  return ((Number(p[0]) << 24) >>> 0) + (Number(p[1]) << 16) + (Number(p[2]) << 8) + Number(p[3]);
}

export function lookupAsn(ip: string): { asn: string; name: string; hosting: boolean } | null {
  if (asnTable === undefined) asnTable = loadAsn();
  if (!asnTable) return null;
  let addr: string;
  try {
    const parsed = ipaddr.process(ip);
    if (parsed.kind() !== "ipv4") return null;
    addr = parsed.toString();
  } catch {
    return null;
  }
  const x = v4ToInt(addr);
  if (x === null) return null;
  const t = asnTable;
  let lo = 0;
  let hi = t.starts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t.starts[mid] <= x) lo = mid + 1;
    else hi = mid - 1;
  }
  const i = hi;
  if (i < 0 || x > t.ends[i]) return null;
  const name = t.names[t.nameIdx[i]];
  return { asn: `AS${t.asn[i]}`, name, hosting: HOSTING_RE.test(name) };
}

export function isPrivateOrLocal(ip: string) {
  try {
    return ipaddr.process(ip).range() !== "unicast";
  } catch {
    return true;
  }
}

