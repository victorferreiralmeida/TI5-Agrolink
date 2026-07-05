/**
 * Expõe o Vite (5173) em https://zoom-gallstone-bootleg.ngrok-free.dev
 *
 * Requer ngrok >= 3.20 (ngrok update). Authtoken: ngrok config add-authtoken ...
 */
import { spawn } from 'node:child_process';

const DOMAIN = 'zoom-gallstone-bootleg.ngrok-free.dev';
const PORT = 5173;

// ngrok v3.20+: ngrok http --url=DOMINIO 5173
const child = spawn('ngrok', ['http', `--url=${DOMAIN}`, String(PORT)], {
  stdio: 'inherit',
});

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error(
      '\n[agrolink] ngrok não encontrado. Instale: https://ngrok.com/download\n' +
        'Depois: ngrok config add-authtoken SEU_TOKEN\n' +
        'Se der erro de versão: ngrok update\n',
    );
  } else {
    console.error('[agrolink] Falha ao iniciar ngrok:', err.message);
  }
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
