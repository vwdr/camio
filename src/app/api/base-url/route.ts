import os from 'os';
import { NextResponse } from 'next/server';

function getLanIp(): string | null {
  const nets = os.networkInterfaces();
  const candidates: string[] = [];

  for (const name of Object.keys(nets)) {
    const net = nets[name];
    if (!net) continue;
    for (const addr of net) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const ip = addr.address;
        // Prefer private LAN ranges
        if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.match(/^172\.(1[6-9]|2\d|3[0-1])\./)) {
          candidates.push(ip);
        }
      }
    }
  }

  // Prefer a private IP if found
  if (candidates.length > 0) return candidates[0];
  return null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hostHeader = request.headers.get('host') || url.host; // e.g., localhost:3001
    const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'http';

    let port = '';
    const parts = hostHeader.split(':');
    if (parts.length > 1) port = parts[1];

    const lanIp = getLanIp();
    const isLan = Boolean(lanIp);
    const baseHost = lanIp ?? parts[0];
    const baseUrl = `${proto}://${baseHost}${port ? `:${port}` : ''}`;

    return NextResponse.json({ baseUrl, isLan, host: hostHeader });
  } catch (e) {
    return NextResponse.json({ baseUrl: null, isLan: false }, { status: 500 });
  }
}
