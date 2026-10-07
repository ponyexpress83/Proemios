export function Book({ small = false, phase }: { small?: boolean; phase?: number }) {
  return (
    <div className={"physical-book" + (small ? " small-book" : "")} aria-hidden="true">
      <div className="book-shadow" />
      <div
        className={
          "book-volume" +
          (phase !== undefined ? " studio-book-volume studio-book-phase-" + phase : "")
        }
      >
        <div className="book-pages" />
        <div className="book-spine">
          <span>PROEMIOS · LA FORMA DELLE STORIE</span>
        </div>
        <div className="book-cover">
          <span className="book-imprint">PROEMIOS</span>
          <div className="book-cover-lines">
            <i />
            <i />
            <i />
          </div>
          <strong>
            La forma
            <br />
            delle
            <br />
            <em>storie.</em>
          </strong>
          {phase !== undefined && (
            <span className="studio-book-status">
              {
                [
                  "LA PRIMA BOZZA",
                  "LA VOCE SI AFFINA",
                  "LE PAROLE SI ACCORDANO",
                  "L’IDENTITÀ PRENDE FORMA",
                  "PAGINE DA LEGGERE",
                  "PRONTO PER I LETTORI",
                ][phase]
              }
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
