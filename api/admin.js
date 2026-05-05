import crypto from 'crypto';

const ALLOWED_FILES = ['productos.json', 'promociones.json'];

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run the comparison to avoid timing leak
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function unauthorized(res) {
  res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function badRequest(res, message) {
  res.status(400).json({ ok: false, error: message });
}

async function githubRequest(path, options = {}) {
  const url = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!token || !timingSafeEqual(token, adminPassword)) {
    return unauthorized(res);
  }

  const { action, file, content, sha } = req.body || {};

  // --- verify-auth ---
  if (action === 'verify-auth') {
    return res.status(200).json({ ok: true });
  }

  // --- get-file ---
  if (action === 'get-file') {
    if (!ALLOWED_FILES.includes(file)) {
      return badRequest(res, 'Archivo no permitido');
    }
    const branch = process.env.GITHUB_BRANCH || 'master';
    const { status, data } = await githubRequest(`${file}?ref=${branch}`);

    if (status !== 200) {
      return res.status(502).json({ ok: false, error: 'Error al leer el archivo de GitHub', detail: data.message });
    }

    const decoded = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
    return res.status(200).json({ ok: true, data: decoded, sha: data.sha });
  }

  // --- save-file ---
  if (action === 'save-file') {
    if (!ALLOWED_FILES.includes(file)) {
      return badRequest(res, 'Archivo no permitido');
    }
    if (!Array.isArray(content)) {
      return badRequest(res, 'El contenido debe ser un array JSON válido');
    }
    if (!sha) {
      return badRequest(res, 'SHA requerido para guardar');
    }

    const branch = process.env.GITHUB_BRANCH || 'master';
    const jsonString = JSON.stringify(content, null, 2);
    const encoded = Buffer.from(jsonString, 'utf-8').toString('base64');

    const now = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });
    const commitMessage = `admin: actualizar ${file} — ${now}`;

    const { status, data } = await githubRequest(file, {
      method: 'PUT',
      body: JSON.stringify({
        message: commitMessage,
        content: encoded,
        sha,
        branch,
      }),
    });

    if (status === 409) {
      return res.status(409).json({
        ok: false,
        error: 'conflict',
        message: 'El archivo fue modificado externamente. Recargá la página.',
      });
    }
    if (status !== 200 && status !== 201) {
      return res.status(502).json({ ok: false, error: 'Error al guardar en GitHub', detail: data.message });
    }

    return res.status(200).json({ ok: true, commit: data.commit?.sha });
  }

  return badRequest(res, 'Acción no reconocida');
}
