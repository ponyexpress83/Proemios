#!/bin/sh
# Verifica che un DOCX sia apribile da un lettore OOXML reale.
#
# LibreOffice non è Word, ma è un consumatore indipendente e severo: se il
# documento è malformato, la conversione fallisce. È la verifica più vicina a
# "Word lo apre senza chiedere di ripararlo" che si possa fare senza Word.
#
#   sh scripts/verifica-docx.sh file.docx [altri.docx...]
#
# Esce con codice 0 se tutti i file si aprono.
set -e
USCITA=$(mktemp -d)
ESITO=0

for FILE in "$@"; do
  NOME=$(basename "$FILE" .docx)
  if timeout 180 libreoffice --headless --convert-to txt:Text --outdir "$USCITA" "$FILE" \
      >"$USCITA/$NOME.log" 2>&1 && [ -s "$USCITA/$NOME.txt" ]; then
    RIGHE=$(wc -l < "$USCITA/$NOME.txt")
    echo "ok    $NOME ($RIGHE righe di testo estratte)"
  else
    echo "FALLITO $NOME"
    tail -5 "$USCITA/$NOME.log" 2>/dev/null || true
    ESITO=1
  fi
done

rm -rf "$USCITA"
exit $ESITO
