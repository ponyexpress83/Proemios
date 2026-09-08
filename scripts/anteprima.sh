#!/bin/sh
# Avvia il server di produzione locale per le verifiche visive e di
# accessibilità. Non usa pkill: un pattern come "next start" corrisponde anche
# alla riga di comando della shell che lo lancia, e la sessione si suicida.
PORT=${1:-3130}
fuser -k "$PORT/tcp" >/dev/null 2>&1 && sleep 2
setsid npx next start -p "$PORT" > "/tmp/next-$PORT.log" 2>&1 < /dev/null &
for _ in $(seq 1 40); do
  sleep 1
  if curl -sf -o /dev/null "http://localhost:$PORT/"; then echo "pronto su $PORT"; exit 0; fi
done
echo "non parte"; tail -5 "/tmp/next-$PORT.log"; exit 1
