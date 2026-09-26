// Salida hacia la tailnet desde el contenedor de Railway.
//
// tailscaled corre en modo userspace (no hay /dev/net/tun en un contenedor de
// PaaS), asi que el trafico no sale por la tabla de rutas del sistema: hay que
// mandarlo explicitamente a su proxy HTTP. Por eso el fetch hacia el worker
// necesita un dispatcher propio y no basta con poner la IP 100.x en la URL.
//
// Solo se enruta la llamada al worker. Gemini, Google Drive y Dropbox siguen
// saliendo por internet normal: mandarlos por la tailnet no aportaria nada y
// agregaria un salto.

import { ProxyAgent } from 'undici';

const PROXY_URL = process.env.TAILSCALE_HTTP_PROXY || 'http://127.0.0.1:1055';

let agente = null;
let avisado = false;

/**
 * Devuelve el dispatcher para hablar con la tailnet, o null si no corresponde.
 *
 * Solo aplica cuando la URL destino es una direccion de la tailnet (100.64/10,
 * el rango CGNAT que usa Tailscale) o un nombre .ts.net. En desarrollo local el
 * worker esta en host.docker.internal y no hay proxy que usar.
 */
export function dispatcherParaTailnet(targetUrl) {
  let host;

  try {
    host = new URL(targetUrl).hostname;
  } catch {
    return null;
  }

  const esTailnet = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) || host.endsWith('.ts.net');

  if (!esTailnet) return null;

  if (!agente) {
    agente = new ProxyAgent(PROXY_URL);

    if (!avisado) {
      console.log(`[tailnet] Saliendo hacia ${host} por el proxy ${PROXY_URL}`);
      avisado = true;
    }
  }

  return agente;
}
