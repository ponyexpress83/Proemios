#!/bin/sh
# Postgres locale per sviluppo e test di integrazione.
#
#   sh scripts/postgres.sh start|stop|reset
#
# Ascolta sulla 5433 con socket in /tmp, per non collidere con un eventuale
# Postgres di sistema. Le credenziali sono `trust`: è un'istanza usa e getta in
# un container, non un ambiente che contiene dati veri.
PGDATA=${PGDATA:-/tmp/pgdata}
BIN=/usr/lib/postgresql/16/bin
PORT=5433

case "${1:-start}" in
  start)
    [ -d "$PGDATA" ] || { mkdir -p "$PGDATA"; chown -R postgres:postgres "$PGDATA" 2>/dev/null
      su postgres -c "$BIN/initdb -D $PGDATA -U postgres --auth=trust" >/dev/null; }
    su postgres -c "$BIN/pg_ctl -D $PGDATA -l /tmp/pg.log -o '-p $PORT -k /tmp' start" || exit 1
    sleep 2
    for db in proemios_dev proemios_test; do
      psql -h /tmp -p $PORT -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$db'" \
        | grep -q 1 || psql -h /tmp -p $PORT -U postgres -c "CREATE DATABASE $db" >/dev/null
    done
    echo "postgres pronto su $PORT (proemios_dev, proemios_test)"
    ;;
  stop) su postgres -c "$BIN/pg_ctl -D $PGDATA stop" ;;
  reset)
    psql -h /tmp -p $PORT -U postgres -c "DROP DATABASE IF EXISTS proemios_test" >/dev/null
    psql -h /tmp -p $PORT -U postgres -c "CREATE DATABASE proemios_test" >/dev/null
    echo "proemios_test ricreato"
    ;;
esac
