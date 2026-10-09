import { Button, Icon } from "@zenginui/ui";
import { FIGMA } from "../content";

/**
 * The Figma file, as the design side of the same system: its variables are generated from the token files
 * and its components carry the React props, so the claim here is the one the rest of the page makes.
 */
export function Figma() {
  return (
    <section className="section" id="figma">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Figma</span>
          <div className="section__head-text">
            <h2 className="title">The same system in Figma</h2>
            <p className="lead">Variables named like the tokens, six themes in light and dark, and all 39 components with the props the code has. Duplicate it from the Figma Community.</p>
          </div>
        </div>
        <div className="system">
          <div className="system__copy">
            <p>
              <strong>Generated, not redrawn.</strong> The variables come from the same token files the engine checks, with each CSS variable as its code syntax, so Dev Mode
              shows <code>var(--color-primary)</code> where a designer picked primary.
            </p>
            <p>
              <strong>One picker re-themes a design.</strong> A Theme collection holds default, zengin, meadow, plex, spec-sheet and brutal; set it and Light or Dark on a frame and
              every component, text style and icon follows.
            </p>
            <p>
              <strong>It goes both ways.</strong> <code>zengin figma import</code> reads a designer&rsquo;s changes back into the token files, with a report, and every component is
              mapped to its React snippet with Code Connect.
            </p>
            <div className="hero__actions">
              <Button asChild tone="primary" trailingIcon={<Icon.ExternalLink />}>
                <a href={FIGMA} target="_blank" rel="noreferrer">
                  Get the Figma file
                </a>
              </Button>
              <Button asChild variant="soft">
                <a href="/docs/#figma">How it stays in sync</a>
              </Button>
            </div>
          </div>
          <a className="figma-shot" href={FIGMA} target="_blank" rel="noreferrer" aria-label="The Zengin Design System on the Figma Community">
            <img src="/media/zengin-figma.png" width={1920} height={1080} alt="The Zengin Design System file: the same panel of components in the zengin, meadow, brutal and plex dark themes." loading="lazy" />
          </a>
        </div>
      </div>
    </section>
  );
}
