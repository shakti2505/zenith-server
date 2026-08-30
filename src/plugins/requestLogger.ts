import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ANSI Color definitions
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  
  // Foreground
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  
  // Bright Foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgMagenta: '\x1b[45m',
};

// Method Sign & Color styling
export function getMethodBadge(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return `${colors.bold}${colors.brightCyan}📥 GET   ${colors.reset}`;
    case 'POST':
      return `${colors.bold}${colors.brightGreen}✨ POST  ${colors.reset}`;
    case 'PUT':
      return `${colors.bold}${colors.brightYellow}🔄 PUT   ${colors.reset}`;
    case 'PATCH':
      return `${colors.bold}${colors.brightMagenta}⚡ PATCH ${colors.reset}`;
    case 'DELETE':
      return `${colors.bold}${colors.brightRed}🗑️ DELETE${colors.reset}`;
    case 'OPTIONS':
      return `${colors.bold}${colors.gray}⚙️ OPTION${colors.reset}`;
    default:
      return `${colors.bold}${colors.brightWhite}📌 ${method.padEnd(6)}${colors.reset}`;
  }
}

// Status Code Sign & Color styling
export function getStatusBadge(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) {
    return `${colors.bold}${colors.brightGreen}✅ ${statusCode} OK${colors.reset}`;
  }
  if (statusCode >= 300 && statusCode < 400) {
    return `${colors.bold}${colors.brightCyan}↪️ ${statusCode}${colors.reset}`;
  }
  if (statusCode >= 400 && statusCode < 500) {
    return `${colors.bold}${colors.brightYellow}⚠️ ${statusCode} CLIENT ERR${colors.reset}`;
  }
  return `${colors.bold}${colors.brightWhite}${colors.bgRed} 💥 ${statusCode} SERVER ERR ${colors.reset}`;
}

// Format duration with color thresholds
export function getDurationBadge(durationMs: number): string {
  const rounded = durationMs.toFixed(1);
  if (durationMs < 50) {
    return `${colors.green}${rounded}ms${colors.reset}`;
  }
  if (durationMs < 250) {
    return `${colors.yellow}${rounded}ms${colors.reset}`;
  }
  return `${colors.bold}${colors.brightRed}${rounded}ms (SLOW)${colors.reset}`;
}

// Sanitize body object (e.g. truncate large base64 strings so terminal stays clean)
export function sanitizePayload(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  try {
    const clone = JSON.parse(JSON.stringify(body));
    if (clone.imageBase64 && typeof clone.imageBase64 === 'string') {
      const lengthKb = Math.round(clone.imageBase64.length / 1024);
      clone.imageBase64 = `<Base64 Image Payload ~${lengthKb}KB>`;
    }
    return `${colors.gray}Body: ${JSON.stringify(clone)}${colors.reset}`;
  } catch {
    return '';
  }
}

export function attachRequestLogger(fastify: FastifyInstance) {
  // 1. Global Incoming Request Hook
  fastify.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done) => {
    (request as any).startTime = process.hrtime();
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    const methodBadge = getMethodBadge(request.method);
    const ip = request.ip || request.socket.remoteAddress || '127.0.0.1';

    console.log(
      `[${colors.gray}${timeStr}${colors.reset}] ${methodBadge} ${colors.bold}${colors.brightWhite}${request.url}${colors.reset} ${colors.gray}(from ${ip})${colors.reset}`
    );

    // If query params exist, log them
    const query = request.query as Record<string, unknown>;
    if (query && Object.keys(query).length > 0) {
      console.log(`       ${colors.cyan}↳ Query:${colors.reset} ${colors.gray}${JSON.stringify(query)}${colors.reset}`);
    }
    done();
  });

  // 2. Global Outgoing Response Hook
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const startTime = (request as any).startTime;
    let durationMs = 0;
    if (startTime) {
      const diff = process.hrtime(startTime);
      durationMs = diff[0] * 1e3 + diff[1] * 1e-6;
    }

    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    const methodBadge = getMethodBadge(request.method);
    const statusBadge = getStatusBadge(reply.statusCode);
    const durationBadge = getDurationBadge(durationMs);

    // Log payload snippet if POST/PATCH/PUT
    let bodySnippet = '';
    if (['POST', 'PATCH', 'PUT'].includes(request.method) && request.body) {
      bodySnippet = ` ${sanitizePayload(request.body)}`;
    }

    console.log(
      `[${colors.gray}${timeStr}${colors.reset}] ${methodBadge} ${colors.bold}${request.url}${colors.reset} ➔ ${statusBadge} in ${durationBadge}${bodySnippet}`
    );
    done();
  });
}
