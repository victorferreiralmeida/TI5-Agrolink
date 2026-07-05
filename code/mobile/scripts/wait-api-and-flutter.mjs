import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const flutterRoot = path.join(mobileRoot, 'agrolink');
const isWin = process.platform === 'win32';

function getApiPort() {
  const raw = process.env.AGROLINK_API_URL ?? process.env.MOBILE_API_URL;
  if (!raw) return 8080;
  try {
    const u = new URL(raw);
    if (u.port) return parseInt(u.port, 10);
    return u.protocol === 'https:' ? 443 : 80;
  } catch {
    return 8080;
  }
}

const WEB_DEVICES = new Set([
  'chrome',
  'edge',
  'firefox',
  'web-server',
  'web-javascript',
  'web',
]);

function inferTargetFromFlutterArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let device = null;

    if (arg === '-d' || arg === '--device-id') {
      device = argv[i + 1]?.toLowerCase();
    } else if (arg.startsWith('--device-id=')) {
      device = arg.slice('--device-id='.length).toLowerCase();
    }

    if (!device) continue;
    if (WEB_DEVICES.has(device) || device.startsWith('web')) return 'chrome';
    if (device === 'windows') return 'windows';
    if (device.startsWith('emulator') || device.includes('android')) return 'emulator';
  }
  return null;
}

function parseFlutterArgs(argv) {
  const flutterArgs = [];
  let chromeMode = false;

  for (const arg of argv) {
    if (arg === '--chrome' || arg === '--web') {
      chromeMode = true;
      continue;
    }
    flutterArgs.push(arg);
  }

  if (chromeMode) {
    process.env.MOBILE_TARGET = 'chrome';
    if (!flutterArgs.includes('-d') && !flutterArgs.some((a) => a.startsWith('--device-id'))) {
      flutterArgs.push('-d', 'chrome');
    }
  }

  return { flutterArgs, chromeMode };
}

function resolveTarget(flutterArgs, chromeMode = false) {
  if (chromeMode) return 'chrome';
  const envTarget = process.env.MOBILE_TARGET?.trim().toLowerCase();
  if (envTarget) return envTarget;
  return inferTargetFromFlutterArgs(flutterArgs) ?? 'emulator';
}

function spawnFlutter(args) {
  if (isWin) {
    return spawn('cmd.exe', ['/d', '/s', '/c', 'flutter', ...args], {
      cwd: flutterRoot,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env },
    });
  }

  return spawn('flutter', args, {
    cwd: flutterRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });
}

function resolveApiBaseUrl(port, target) {
  const explicit =
    process.env.MOBILE_API_BASE_URL ??
    process.env.API_BASE_URL ??
    process.env.AGROLINK_API_URL;
  if (explicit) {
    try {
      const u = new URL(explicit);
      return u.origin;
    } catch {
      return explicit.replace(/\/$/, '');
    }
  }

  switch (target) {
    case 'physical':
    case 'device': {
      const ip = process.env.MOBILE_LAN_IP;
      if (!ip) {
        console.error(
          '[mobile] MOBILE_TARGET=physical exige MOBILE_LAN_IP (IPv4 do PC na Wi‑Fi).',
        );
        console.error('[mobile] Ex.: set MOBILE_LAN_IP=192.168.0.15');
        process.exit(1);
      }
      return `http://${ip}:${port}`;
    }
    case 'windows':
    case 'desktop':
      return `http://127.0.0.1:${port}`;
    case 'chrome':
    case 'web':
      return `http://127.0.0.1:${port}`;
    case 'emulator':
    case 'android':
    default:
      return `http://10.0.2.2:${port}`;
  }
}

function isPortListening(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(1500);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

async function isApiHealthy(port) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => ({}));
    return body?.status === 'UP';
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function waitForApi(port, maxAttempts = 90) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isApiHealthy(port)) return true;
    if (i === 0) {
      console.log(`[mobile] Aguardando API em http://127.0.0.1:${port}/api/health ...`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

function logRunHint(target) {
  switch (target) {
    case 'chrome':
    case 'web':
      console.log('[mobile] Abrindo no navegador (Flutter Web).');
      break;
    case 'windows':
    case 'desktop':
      console.log('[mobile] Abrindo app desktop Windows.');
      break;
    case 'physical':
    case 'device':
      console.log('[mobile] Celular físico na mesma Wi‑Fi (MOBILE_LAN_IP configurado).');
      break;
    default:
      console.log(
        '[mobile] Emulador Android deve estar ligado (Android Studio → Device Manager → Play).',
      );
  }
}

async function main() {
  const { flutterArgs, chromeMode } = parseFlutterArgs(process.argv.slice(2));
  const port = getApiPort();
  const target = resolveTarget(flutterArgs, chromeMode);
  const apiBase = resolveApiBaseUrl(port, target);

  if (!(await waitForApi(port))) {
    console.error(
      '[mobile] API não respondeu a tempo. Confira o terminal [api] ou rode `npm run dev:api`.',
    );
    console.error('[mobile] Para subir API + app juntos: `npm run dev` ou `npm run dev:chrome`.');
    process.exit(1);
  }

  console.log(`[mobile] API OK. Iniciando Flutter com API_BASE_URL=${apiBase}`);
  logRunHint(target);

  const args = [
    'run',
    `--dart-define=API_BASE_URL=${apiBase}`,
    ...flutterArgs,
  ];

  const child = spawnFlutter(args);

  child.on('error', (err) => {
    console.error('[mobile] Não foi possível executar `flutter`:', err.message);
    console.error('[mobile] Instale o Flutter e adicione `flutter` ao PATH.');
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error('[mobile]', err);
  process.exit(1);
});
