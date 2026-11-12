# Independent numerical references

Run from the project root:

```sh
Rscript tests/reference/generate.R
node --test tests/*.test.mjs
```

The generator uses R's `stats::qt` and noncentral `stats::pt`, independently of the JavaScript implementation. `provenance.txt` records the installed R/stats versions and conventions. No additional R packages are needed. The committed CSV allows ordinary Node tests without R installed.

The 101 two-sample cases cover three effects, two alpha levels, two power targets, four allocation ratios and two alternatives, plus negative one-sided effects, extreme alpha/power, minimum n and rounding half ties. Tests compare exact integer allocation and achieved power at both the selected and preceding admissible allocations, with absolute power tolerance 2e-9. At n=2 there is no allowed predecessor. Cases with targets within numerical tolerance of a threshold should be investigated with an independent reference before expanding precision claims; no domain-wide error bound is asserted.

The existing 27 regression tests remain, covering all four prototype methods. Journey tests additionally check input-mode equivalence, sign and unit conversion, invalid inputs, fixed-N symmetry, and paired/one-sample correspondence. The scientific/input suite passes 132 tests. The full suite now also includes six service-worker tests (138 total); see `../../VERIFICATION.md` for browser and offline evidence. The new grid is for Maverick; ANOVA continues to use the original embedded references.

## Step 4 entry modes

Run `Rscript tests/reference/generate-journey.R` to regenerate `journey-modes.csv`. `journey-provenance.txt` records the independent R/stats versions and conventions. It supplies 32 paired, 32 one-sample and 16 ANOVA group-means cases, including negative differences, tails, alpha/power variation and different group counts/mean patterns. Expected effects are derived in R from natural-unit inputs; allocations and achieved/predecessor powers use R qt/pt or qf/pf.

The full suite now passes 228 tests. ANOVA means use equal weights and the population divisor k; paired SD inputs refer specifically to within-pair differences. These modes normalize to the existing engines. No new numerical approximation was introduced during step 4. Browser/asset/offline verification and its limits are recorded in ../../VERIFICATION.md.

## Association Heights

Run `Rscript tests/reference/generate-association.R` to regenerate `association.csv`. The provenance file records the model conventions and R/stats versions. Its 75 correlation and 180 regression cases cover multiple tails/signs, effect sizes, predictor counts, alpha/power levels and minimum sample sizes. JavaScript power at the selected and preceding integer N is compared directly with independent R calculations within 2e-9.

Correlation follows the explicitly approximate bias-corrected Fisher-z / central-t-cutoff convention described in CRAN pwr.r.test. Overall regression uses p slope df, N−p−1 residual df and N × f² noncentrality, as in pwr.f2.test. The full suite now passes 491 tests. ../../ASSOCIATION.md gives primary sources, scientific scope and entry-mode specifications; ../../VERIFICATION.md records 375 browser checks and offline/direct-file evidence.


## Remaining-continent planning models

`Rscript tests/reference/generate-remaining.R` regenerates `remaining.csv` (645 cases) and `remaining-provenance.txt` using base R stats. The documented approximate rank, arcsine and Schoenfeld models use pnorm/qnorm; chi-square uses qchisq/pchisq; Bonferroni uses qt/pt at family alpha/m, down to 1e-6. Fixtures include integer solution and predecessor power (except minimum admissible counts). Grids include signs/tails, alpha .0001/.05/.2, power .5/.8/.99, chi-square df1/3/20/100, allocation .1/.5/.9, and family1/5/100. Cases exceeding the million-unit total cap are excluded from fixtures and explicitly tested as failures in Node. See CONTINENTS.md and REMAINING-REVIEW.md for formulas and primary references. Matching R verifies the stated models, not empirical accuracy for arbitrary populations.


## Non-inferiority and equivalence

`Rscript tests/reference/generate-equivalence.R` regenerates 422 parallel-group NI/TOST/lognormal TOST cases and provenance. Base R qt/pt evaluates NI; integrate() independently computes the joint conditional-normal interval probability against dchisq for TOST. No JavaScript is used. Selected balanced integer n, achieved power, and predecessor n are verified to2e-9; the direct-variance R integration uses a different integration variable from the JS log-variance implementation. Small-N, large-N, asymmetric bounds, alpha, target, CV, ratios and both NI directions are covered. The published PowerTOST original-scale parallel example agrees (N48,power.815435 rounded); PowerTOST was not installed. Full definitions, sources and scope are in EQUIVALENCE.md / EQUIVALENCE-REVIEW.md.
