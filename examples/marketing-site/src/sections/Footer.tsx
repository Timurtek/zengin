import { NPM, REPO } from "../content";

/** The same foot on every page of this site. The why page used to simply stop at its last section. */
export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <span>Zengin is MIT licensed. Built on Zengin UI, checked by Zengin.</span>
        <span className="footer__links">
          <a href={REPO} target="_blank" rel="noreferrer">github.com/Timurtek/zengin</a>
          <a href={NPM} target="_blank" rel="noreferrer">npmjs.com/org/zenginui</a>
        </span>
      </div>
    </footer>
  );
}
