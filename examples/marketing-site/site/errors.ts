/**
 * The site's error reporting and its failure screen, added to every page by vite.config.ts.
 *
 * It lives outside src/ on purpose: src/ is also the marketing template, copied into the projects people
 * create, and those projects must neither send anything to Zengin's PostHog nor depend on this package.
 */
import { showErrorScreenOnCrash, startErrorReporting } from "site-errors";

void startErrorReporting({ surface: "site" });
showErrorScreenOnCrash({ home: "/" });
