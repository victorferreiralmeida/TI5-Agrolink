import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backRoot = path.resolve(__dirname, '../../../back');
const isWin = process.platform === 'win32';

const WAIT_HEALTH_MS = 120_000;
const POLL_MS = 1_500;
/** Quanto esperamos pelo /api/health antes de considerar o processo travado e matá-lo. */
const STALE_PROCESS_GRACE_MS = 12_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiPort() {
  const raw = process.env.AGROLINK_API_URL;
  if (!raw) return 8080;
  try {
    const u = new URL(raw);
    if (u.port) return parseInt(u.port, 10);
    return u.protocol === 'https:' ? 443 : 80;
  } catch {
    return 8080;
  }
}

/** Se já houver algo escutando (ex.: outro terminal com `bootRun`), não subimos outro Spring. */
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

/**
 * Descobre PIDs em LISTEN na porta informada (Windows: Get-NetTCPConnection / netstat;
 * Linux/macOS: lsof). Retorna lista de PIDs únicos > 0.
 */
function findListeningPids(port) {
  try {
    if (isWin) {
      // PowerShell é o caminho mais confiável; cai para netstat se PS não estiver presente.
      const ps = spawnSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
        ],
        { encoding: 'utf8' },
      );
      const out = (ps.stdout || '').trim();
      if (out) {
        return [...new Set(out.split(/\s+/).map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n) && n > 0))];
      }
      const ns = spawnSync('cmd', ['/c', `netstat -ano | findstr :${port}`], { encoding: 'utf8' });
      const lines = (ns.stdout || '').split(/\r?\n/);
      const pids = new Set();
      for (const line of lines) {
        if (!/LISTENING/i.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (Number.isInteger(pid) && pid > 0) pids.add(pid);
      }
      return [...pids];
    }
    const lsof = spawnSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' });
    const out = (lsof.stdout || '').trim();
    if (!out) return [];
    return [...new Set(out.split(/\s+/).map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n) && n > 0))];
  } catch {
    return [];
  }
}

/**
 * Mata processos da lista. No Windows usa `taskkill /F`; em outros, `kill -9`.
 * Logs amigáveis. Retorna quantos foram encerrados (0 se nenhum).
 */
function killPids(pids) {
  let count = 0;
  for (const pid of pids) {
    try {
      if (isWin) {
        const r = spawnSync('taskkill', ['/PID', String(pid), '/F'], { encoding: 'utf8' });
        if (r.status === 0) count++;
      } else {
        process.kill(pid, 'SIGKILL');
        count++;
      }
    } catch {
      // Ignora; pode já ter saído.
    }
  }
  return count;
}

/**
 * Aguarda backend já em subida (outro `npm run dev`, web+mobile ao mesmo tempo, etc.).
 * Se nada respondeu /api/health dentro de {@link STALE_PROCESS_GRACE_MS}, mata o processo
 * travado automaticamente — primeira execução em uma máquina nova fica realmente plug-and-play.
 */
async function waitForExistingApi(port) {
  const deadline = Date.now() + WAIT_HEALTH_MS;
  const staleDeadline = Date.now() + STALE_PROCESS_GRACE_MS;
  let loggedWait = false;
  let attemptedKill = false;

  while (Date.now() < deadline) {
    if (!(await isPortListening(port))) {
      await sleep(POLL_MS);
      continue;
    }
    if (await isApiHealthy(port)) {
      console.log(
        `[api] Porta ${port} já em uso — reutilizando o backend existente (não inicia outro bootRun).`,
      );
      console.log(
        '[api] Dica: use um único `npm run dev` (web ou mobile); ambos compartilham a mesma API.',
      );
      await new Promise(() => {});
      return true;
    }
    if (!loggedWait) {
      console.log(
        `[api] Porta ${port} ocupada — aguardando /api/health (outro bootRun pode estar subindo)…`,
      );
      loggedWait = true;
    }
    if (!attemptedKill && Date.now() > staleDeadline) {
      const pids = findListeningPids(port);
      if (pids.length > 0) {
        console.warn(
          `[api] /api/health não respondeu em ${STALE_PROCESS_GRACE_MS / 1000}s — encerrando processo(s) travado(s) na porta ${port}: ${pids.join(', ')}`,
        );
        const killed = killPids(pids);
        if (killed > 0) {
          // Aguarda o SO liberar a porta antes de continuar.
          for (let i = 0; i < 10; i += 1) {
            await sleep(500);
            if (!(await isPortListening(port))) break;
          }
          return false;
        }
      }
      attemptedKill = true;
    }
    await sleep(POLL_MS);
  }

  if (await isPortListening(port)) {
    console.error(
      `[api] Porta ${port} continua ocupada após ${WAIT_HEALTH_MS / 1000}s, mas /api/health não respondeu.`,
    );
    console.error(
      '[api] Encerre o processo manualmente. PowerShell: Get-NetTCPConnection -LocalPort 8080 -State Listen | %% { Stop-Process -Id $_.OwningProcess -Force }',
    );
    process.exit(1);
  }

  return false;
}

/** Perfil local padrão: MySQL (application-mysql.properties). Use SPRING_PROFILES_ACTIVE=dev para H2. */
function springEnv() {
  const profile = process.env.SPRING_PROFILES_ACTIVE?.trim() || 'mysql';
  const env = {
    ...process.env,
    SPRING_PROFILES_ACTIVE: profile,
  };
  // Paridade com o antigo perfil dev: seed demo na subida local, salvo se já definido.
  if (profile === 'mysql' && !process.env.AGROLINK_DEMO_SEED?.trim()) {
    env.AGROLINK_DEMO_SEED = 'true';
  }
  return env;
}

function startBootRun() {
  if (isWin) {
    const safeRoot = backRoot.replace(/"/g, '""');
    const line = `cd /d "${safeRoot}" && gradlew.bat bootRun --no-daemon`;
    return spawn(line, {
      shell: true,
      stdio: 'inherit',
      env: springEnv(),
      windowsHide: true,
    });
  }

  const gradlew = path.join(backRoot, 'gradlew');
  return spawn(gradlew, ['bootRun', '--no-daemon'], {
    cwd: backRoot,
    stdio: 'inherit',
    shell: false,
    env: springEnv(),
  });
}

async function main() {
  const port = getApiPort();

  if (await isPortListening(port)) {
    if (await waitForExistingApi(port)) return;
  }

  // Outra instância pode ter iniciado bootRun entre o check e o spawn.
  for (let i = 0; i < 3; i += 1) {
    if (await isPortListening(port)) {
      if (await waitForExistingApi(port)) return;
      break;
    }
    await sleep(400);
  }

  const child = startBootRun();

  child.on('error', (err) => {
    console.error('[api] Não foi possível iniciar o Gradle/Spring Boot:', err.message);
    console.error(
      '[api] Confira se o JDK 21+ está disponível (ou deixe o Gradle baixar via Foojay) e se a pasta',
      backRoot,
      'existe.',
    );
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error('[api]', err);
  process.exit(1);
});
