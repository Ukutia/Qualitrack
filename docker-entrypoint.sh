#!/bin/sh
# Arranque del contenedor en Railway.
#
# Levanta tailscaled antes que la aplicacion para que el backend pueda alcanzar
# al worker, que corre en una maquina domestica sin IP publica. Sin TS_AUTHKEY
# el contenedor arranca igual: en entornos donde el worker es local (docker
# compose) no hace falta tailnet.
set -e

if [ -n "$TS_AUTHKEY" ]; then
  echo "[tailscale] Iniciando tailscaled en modo userspace..."

  # userspace-networking porque un contenedor de PaaS no tiene /dev/net/tun.
  # El proxy HTTP es la unica forma de que el trafico saliente de Node entre a
  # la tailnet: ver src/services/tailnet.service.js.
  /usr/local/bin/tailscaled \
    --tun=userspace-networking \
    --socks5-server=localhost:1055 \
    --outbound-http-proxy-listen=localhost:1055 \
    --state=/var/lib/tailscale/tailscaled.state \
    &

  # Un hostname estable evita que cada despliegue aparezca como una maquina
  # nueva en la tailnet.
  TS_HOSTNAME="${TS_HOSTNAME:-qualitrack-backend}"

  # --accept-routes no hace falta: solo se habla con una IP 100.x directa.
  /usr/local/bin/tailscale up \
    --authkey="$TS_AUTHKEY" \
    --hostname="$TS_HOSTNAME" \
    --accept-dns=false

  echo "[tailscale] Conectado como $TS_HOSTNAME"
  /usr/local/bin/tailscale ip -4 || true
else
  echo "[tailscale] TS_AUTHKEY no definido: se omite la tailnet."
fi

npx prisma migrate deploy
node prisma/seed.js
exec node src/server.js
