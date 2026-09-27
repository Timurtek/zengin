/**
 * The showreel: 45 seconds of what the page below explains. Rendered from scripts/showreel (reel.html,
 * score.mjs, render.mjs); the file here is its web encode. It waits for a click: it has a soundtrack, and
 * preload="none" keeps its 7.6MB off everyone who never presses play.
 */
export function Reel() {
  return (
    <section className="section" id="reel">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Showreel</span>
          <div className="section__head-text">
            <h2 className="title">Forty-five seconds of it</h2>
            <p className="lead">An agent writes a component, the engine catches six violations, the hook blocks the edit, and the fixes go back in. Then the surfaces, the rules and the system in six themes.</p>
          </div>
        </div>
        <figure className="reel">
          <video className="reel__video" controls preload="none" playsInline poster="/media/zengin-showreel.jpg" width={1920} height={1080}>
            <source src="/media/zengin-showreel.mp4" type="video/mp4" />
            <a href="/media/zengin-showreel.mp4">Download the showreel (MP4)</a>
          </video>
        </figure>
      </div>
    </section>
  );
}
