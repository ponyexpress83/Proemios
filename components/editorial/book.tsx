export function Book({ small = false }: { small?: boolean }) {
  return (
    <div className={"physical-book" + (small ? " small-book" : "")} aria-hidden="true">
      <div className="book-shadow" />
      <div className="book-volume">
        <div className="book-pages" />
        <div className="book-spine">
          <span>PROEMIOS · LA FORMA DELLE STORIE</span>
        </div>
        <div className="book-cover">
          <span className="book-imprint">PROEMIOS / UN NUOVO CAPITOLO</span>
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
          <span className="book-author">LA TUA VOCE, IN UN LIBRO.</span>
        </div>
      </div>
    </div>
  );
}
