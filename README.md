# Stat Fighter ’89

An arcade-themed sample size and power calculator that runs entirely in the browser. There is no build step, no server-side code and no network traffic: every calculation happens on your device, and once the footer says **OFFLINE READY** the app works without a connection and can be installed to a phone's home screen.

## Methods

Fifteen fighters, one planning method each:

| Fighter | Method |
| --- | --- |
| Maverick | Pooled two-sample t-test |
| Mirror | Paired t-test |
| Iwan | One-sample t-test |
| Nova | Balanced one-way ANOVA |
| Bastion | Non-inferiority, parallel t-test |
| Tess | TOST equivalence, parallel t-tests |
| Ratio | Log-normal TOST, parallel bioequivalence |
| Volt | Pearson correlation |
| Vector | Multiple linear regression (overall F-test) |
| Rook | Mann–Whitney (approximate) |
| Echo | Wilcoxon signed-rank (approximate) |
| Pip | Two proportions (approximate) |
| Chi | Chi-square (approximate) |
| Harbor | Log-rank event planning (approximate) |
| Aegis | Bonferroni family planning |

Methods marked *approximate* use explicitly stated large-sample models; each fighter's screen explains its assumptions.

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

The numerical tests compare against fixtures computed independently in R with base `stats` only. To regenerate them, run the `Rscript tests/reference/generate*.R` scripts from the project root; [`tests/reference/README.md`](tests/reference/README.md) describes each fixture set and its conventions.

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

Stat Fighter ’89 is a planning aid. Results depend entirely on the assumptions you enter and on each method’s stated model. It comes with no warranty and is not a substitute for review by a qualified statistician, particularly for clinical, regulatory or bioequivalence studies.

## Licence

The code is released under the [MIT Licence](LICENSE). The character and stage artwork in `assets/` is not licensed for reuse. The Press Start 2P font is distributed under the SIL Open Font Licence ([`assets/fonts/OFL.txt`](assets/fonts/OFL.txt)).

Character and stage artwork was AI-generated.
