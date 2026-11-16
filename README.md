# Stat Fighter ’89

An arcade-themed sample size and power calculator that runs entirely in the browser. There is no build step, no server-side code and no network traffic: every calculation happens on your device, and once the footer says **OFFLINE READY** the app works without a connection and can be installed to a phone's home screen.

## Methods

Twenty-two fighters live in four districts, and every one of them faces The Null, the CPU opponent. Each one plans one method:

| District | Fighter | Method |
| --- | --- | --- |
| Mean Streets | Maverick | Two-sample t-test: pooled, or Welch for unequal SDs (approximate) |
| | Mirror | Paired t-test |
| | Iwan | One-sample t-test |
| | Nova | Balanced one-way ANOVA |
| | Anchor | ANCOVA with baseline covariates (approximate) |
| | Volt | Pearson correlation (approximate) |
| | Vector | Multiple linear regression (overall F-test) |
| Frequency Frontier | Pip | Two proportions (approximate) |
| | Chi | Chi-square (approximate) |
| | Parry | Non-inferiority or superiority by a margin, two proportions (Farrington–Manning, approximate) |
| | Rook | Mann–Whitney (approximate) |
| | Echo | Wilcoxon signed-rank (approximate) |
| Survival Coast | Harbor | Log-rank event planning, with an optional enrolment step (approximate) |
| | Jab | Vaccine efficacy from case counts, exact conditional binomial test, with a cases-to-participants step |
| | Scatter | Negative binomial rate ratio for recurrent events (approximate) |
| Boundary Citadel | Aegis | Bonferroni family planning |
| | Bastion | Non-inferiority, parallel t-test |
| | Tess | TOST equivalence, parallel t-tests |
| | Ratio | Log-normal TOST, parallel bioequivalence |
| | Switch | 2×2 crossover TOST, average bioequivalence |
| | Bell | Group sequential design with efficacy stopping (two or three looks, four spending functions) |
| | Towel | Group sequential design with efficacy and non-binding futility stopping |

A future fighter can be marked `artPending: true` in `journey/content.js`: it stays out of the menus, and its direct link opens it with a placeholder silhouette.

Methods marked *approximate* use explicitly stated large-sample models; each fighter's arena explains its assumptions. Every result can show an optional dropout allowance, a power curve and the sample size at 80, 90 and 95 percent power; none of these changes the verified number.

## The interface

Title → World → District select → Challenge card → Arena. Tap a district on the map to read its briefing and tap it again to enter. The select screen works like a fighting-game character select: arrow keys move the cursor, Enter or a second tap picks. Each fighter's challenge card shows the test, five stat bars and The Null, the CPU opponent. In the arena the fighter's bar is power, The Null's bar is the type II error that remains, and the clock shows alpha. Group sequential designs fight one round per look, each with its efficacy boundary, and show a per-look boundary table. The fight sequence is skippable, honours reduced motion and the Effects option, and never delays the result. The hi-score table keeps your last ten plans in this browser only.

Portraits come in three sizes: full size in `assets/` (precached for offline use), half size in `assets/web/` (what pages request), and 192 × 288 thumbnails in `assets/thumb/` for tiles and avatars. After adding or replacing a portrait, run `scripts/make-thumbs.sh` (needs ImageMagick) and add the new files to `sw.js`.

The screens are classic scripts in `journey/screens/`, sharing state through `journey/core.js`; `journey/journey.js` is the router.

Not sure which fighter you need? **Find my fighter** on the title screen opens the Matchmaker: up to three questions (what you want to show, the kind of outcome, the design) lead to a fighter, or to Quick Select when no fighter covers the combination. The rules live in `content.matchmaker` and are tested so that every fighter is reachable.

Left alone for 20 seconds, the title screen runs an attract-mode demo through the roster. It never runs with Effects off or reduced motion, and any key or tap stops it.

## Training Room

The Training Room (`#convert`, from the title menu or the arena) converts what a paper reports into what a fighter asks for. Nothing in it is a sample size. Seven tools:

- **Log-normal scales:** arithmetic mean and SD, CV, geometric mean and SD, log-scale μ and σ.
- **Standard deviation:** from a CV, a standard error, a confidence interval of a mean (t quantile), two group SDs (pooled) or an IQR (normal data only).
- **Paired differences:** SD of differences from two SDs and their correlation, and dz.
- **Effect sizes:** Cohen's d, probability of superiority Φ(d/√2), R² ↔ f², η² → f.
- **Risks and ratios:** treatment risk from an odds ratio or risk ratio, risk difference, NNT, Cohen's h.
- **Survival and hazards:** hazard ratio, medians and survival at a time point, exponential or Weibull with a common shape.
- **Rates and counts:** rate ↔ probability over a period, negative binomial dispersion k ↔ R's θ, vaccine efficacy ↔ relative risk.

Fields such as an SD, a CV, a hazard ratio or a dispersion carry a `convert ⇄` link. It opens the matching tool, and **USE IN … ARENA** writes the converted value back into that fighter's field (an existing result is marked stale). Each tool states its model assumption under the table. The maths is in `journey/convert.js` and is cross-checked against base R (`tests/reference/generate-convert.R`).

## Protocol text and R code

After a fight, the arena offers a **protocol text** for the sample size section of a protocol or statistical analysis plan. It restates the hypothesis and test, the assumptions, the per-group and total numbers, target and achieved power, a method-specific caveat, the dropout allowance if one is entered, and the software (Stat Fighter ’89 and its version). Everything the app cannot know is left in [brackets]. Every number in it is one the arena already shows. Templates are in `journey/protocol.js`.

Two more panels give **R code**. *Verify this result* recomputes the sample size and the power at the app's own sizes with an independent CRAN package (pwr, PowerTOST, gsDesign, MKpower or MESS), using the app's rounding rule. *Analyse the data* is the matching analysis for a data frame called `dat`. Each panel states how close the check is. For three fighters (Anchor, Rook, Echo) no package implements the app's model, so the code restates the formula in base R and adds a simulation. The protocol text mentions the R appendix only when a package check reproduces the result. Snippets are in `journey/rcode.js`.

Every snippet is run against R before release:

```sh
Rscript -e 'install.packages(c("pwr", "PowerTOST", "gsDesign", "MKpower", "MESS"), repos = "https://cloud.r-project.org")'
npm run check:r
```

`npm run check:r` runs 88 cases (every input mode, alpha 0.01 with 90% power, unequal allocation and direction variants), runs each analysis snippet on simulated data, and writes the table to `tests/reference/rcode-provenance.txt`. It needs a local R installation and is not part of `npm test`.

## Run locally

Any static file server works. From the project root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8765/>. Opening `index.html` directly from disk also works, without offline support.

## Tests

The tests need Node.js 18 or newer and no dependencies:

```sh
npm test
```

`tests/browser-qa.html` is a manual in-browser check page that drives the real app in an iframe; serve the project as above and open `/tests/browser-qa.html`.

### Reference values

The numerical tests compare against fixtures computed independently in R with base `stats` only (no add-on packages). To regenerate them, run the `Rscript tests/reference/generate*.R` scripts from the project root; [`tests/reference/README.md`](tests/reference/README.md) describes each fixture set and its conventions.

## Publishing

Every push to `main` runs `.github/workflows/pages.yml`: it runs the tests, assembles `_site/` from an explicit allowlist of app files with `scripts/build-site.sh` (no tests, notes or Markdown are published), stamps the service-worker cache version with the short commit SHA so returning visitors always pick up a new build, and deploys it to GitHub Pages.

To publish:

1. Create an empty repository on GitHub, for example `stat-fighter`.
2. Add it as the remote and push the `main` branch only:

   ```sh
   git remote add origin git@github.com:<user>/stat-fighter.git
   git push -u origin main
   ```

3. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The next push (or re-running the workflow) deploys the site to `https://<user>.github.io/stat-fighter/`.

Publish it as a **project site** like this, not as the root `<user>.github.io` repository: the offline service worker controls everything under the folder it is served from, so at the root of your user site it would also intercept every other project on that origin.

To preview the deployable build locally, run `scripts/build-site.sh _site` and serve `_site/`.

## Disclaimer

Stat Fighter ’89 is a hobby project made for fun. It comes with no warranty of any kind. It is not validated software, and no regulatory agency, ethics committee or professional body has reviewed or endorsed it. Results depend entirely on the assumptions you enter and on each method’s stated model, and they may be wrong. Do not base a study, a protocol or any decision on it without independent verification by a qualified statistician using validated software.

## Licence

The code is released under the [MIT Licence](LICENSE). The character and stage artwork in `assets/` is not licensed for reuse. The Press Start 2P font is distributed under the SIL Open Font Licence ([`assets/fonts/OFL.txt`](assets/fonts/OFL.txt)).

Character and stage artwork was AI-generated.
