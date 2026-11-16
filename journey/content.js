'use strict';
{
  const worldMap = { image: './assets/web/earth-world-v1.webp', width: 1774, height: 887, alt: 'Arcade mission map of Earth, showing the Americas, Europe, Africa, Asia and Oceania on a dark ocean grid.' };
  // Four districts. Retired district ids from earlier links resolve through regionAliases.
  const regions = [
    { id: 'means', name: 'Mean Streets', tag: 'Means and linear models', x: 24, y: 29, number: '01', roster: ['two-sample', 'paired', 'one-sample', 'anova', 'ancova', 'correlation', 'regression'], tagline: 'The average is only the beginning.', introduction: 'Independent groups, paired measurements, a single mean, a crowd of groups, a baseline adjustment, a correlation or a whole regression model: the linear model on a continuous outcome, in all its outfits.', quote: 'Choose your question. Then choose your fighter.', description: 'Where every average has an attitude. t-tests, ANOVA, ANCOVA, correlation and regression: one family, many fighting styles.' },
    { id: 'frequency', name: 'Frequency Frontier', tag: 'Proportions, counts and ranks', x: 53, y: 58, number: '02', roster: ['proportions', 'chi-square', 'ni-proportions', 'mann-whitney', 'signed-rank'], tagline: 'Every observation counts.', introduction: 'Outcomes that are not analysed as means: binary events, categorical tables and rank orderings. Check rare outcomes, sparse cells and ties before committing to a study.', quote: 'A count is only as good as its denominator.', description: 'Binary, categorical and rank-based outcomes. Proportions, chi-square tables, a margin on a risk difference, and the rank fighters.' },
    { id: 'survival', name: 'Survival Coast', tag: 'Events over time', x: 85, y: 73, number: '03', roster: ['log-rank', 'vaccine-efficacy', 'negative-binomial'], tagline: 'Time is part of the question.', introduction: 'Studies that count events as they accrue: time to a first event, cases in a vaccine trial, and recurrent events per participant. Plan the event count first, then convert it to enrolment.', quote: 'Events first. Then the people who carry them.', description: 'Events over time: log-rank event counts, case-driven vaccine efficacy, and negative binomial rates for recurrent events.' },
    { id: 'boundary', name: 'Boundary Citadel', tag: 'Margins, error budgets and interim looks', x: 74, y: 31, number: '04', roster: ['bonferroni', 'non-inferiority', 'tost', 'tost-lognormal', 'tost-crossover', 'gsd-efficacy', 'gsd-futility'], tagline: 'Every line was drawn before the first bell.', introduction: 'Every fighter here defends a line fixed before the trial starts: a non-inferiority margin, a pair of equivalence limits, a shared alpha budget, or the stopping boundaries of interim looks. Move the line afterwards and the fight is void.', quote: 'Draw the line first. Then defend it.', description: 'Non-inferiority, equivalence and bioequivalence, the family error budget, and group sequential designs with interim looks.' },
  ];
  const regionAliases = { association: 'means', ranks: 'frequency', multiplicity: 'boundary' };
  const fighters = {
    'two-sample': {
      name: 'Maverick', region: 'means', number: '01', image: './assets/web/maverick-arcade-v2.webp', stageImage: './assets/web/sunset-airfield-v1.webp',
      alt: 'Maverick in her blue flight jacket, lowering her aviator sunglasses at sunset.', stageAlt: 'Dark hangar, amber runway lights and a jet silhouetted against the dusk sky.',
      title: 'The independent variable', move: 'Critical Difference', quote: 'Your means don’t stand a chance.',
      bio: 'Her aviator lenses reflect two runways at once, one per group, and she lands on both. Maverick brings two independent crews to the airfield, then insists they settle their differences with a common standard deviation.',
      joke: '“I work independently. So should your groups.”', stage: 'Sunset Airfield', test: 'Pooled two-sample t-test',
      choose: 'You’re planning a comparison of two independent means with a common population SD.', avoid: 'Paired measurements need Mirror. Unequal variances? Pick Welch mode in the arena. A baseline measurement to adjust for needs Anchor.',
      waiting: 'Your study is on the runway.', resultTitle: 'Flight plan ready.', scoreTitle: 'FLIGHT PLAN', trait: 'SWAGGER', weakness: 'SMALL TALK',
    },
    paired: {
      name: 'Mirror', region: 'means', number: '02', image: './assets/web/mirror-arcade-v2.webp', stageImage: './assets/web/mirror-stage-v1.webp', stageFraming: 'full',
      alt: 'Mirror with a black ponytail, rose jacket and loose dark trousers, balancing with one knee raised and an open palm.', stageAlt: 'Rain-dark arcade plaza with glass reflections and muted rose lighting.',
      title: 'The before-and-after image', move: 'Difference Drive', quote: 'I knew you before your intervention.',
      bio: 'Mirror’s reflection arrives one second early and fights beside her. She never forgets a face, especially when it appears twice in the dataset, and she measures every dramatic entrance against its own follow-up visit.',
      joke: '“We should do this again. Preferably on the same people.”', stage: 'Reflection Arcade', test: 'Paired t-test',
      choose: 'You’re planning two measurements on the same units, or deliberately matched pairs, and can specify the SD of their differences.', avoid: 'Two unrelated groups need Maverick. A marginal SD alone does not describe the variability of paired differences.',
      waiting: 'Your before is waiting for its after.', resultTitle: 'Pairs accounted for.', scoreTitle: 'PAIR PLAN', trait: 'FOLLOW-THROUGH', weakness: 'PERSONAL SPACE',
    },
    'one-sample': {
      name: 'Iwan', region: 'means', number: '03', image: './assets/web/iwan-arcade-v1.webp', stageImage: './assets/web/iwan-stage-v1.webp', stageFraming: 'full',
      alt: 'Iwan, a broad muscular man with dark shaggy hair and an indigo sleeveless vest, standing with folded arms.', stageAlt: 'An empty industrial rooftop with a radio mast, skyline and a solitary searchlight.',
      title: 'The lone benchmark', move: 'Reference Strike', quote: 'One mean. Absolutely no backup.',
      bio: 'Iwan stands so still at the Reference Outpost that compasses point at him. He keeps one battered notebook and an unwavering attachment to a fixed benchmark. He once requested reinforcements. Headquarters sent a second pencil.',
      joke: '“I brought a control group. It’s a number.”', stage: 'Reference Outpost', test: 'One-sample t-test',
      choose: 'You’re planning to compare one population mean with a fixed reference value.', avoid: 'If the reference is estimated from another sample, its uncertainty needs a different design.',
      waiting: 'One population. One point to prove.', resultTitle: 'Mission sized.', scoreTitle: 'MISSION PLAN', trait: 'RESOLVE', weakness: 'ASKING FOR HELP',
    },
    anova: {
      name: 'Nova', region: 'means', number: '04', image: './assets/web/nova-arcade-v1.webp', stageImage: './assets/web/nova-stage-v1.webp', stageFraming: 'full',
      alt: 'Nova, a dark-skinned fighter with voluminous curls, a black-and-gold jacket and folded arms, giving a confident sideways smile.', stageAlt: 'A night festival terrace with several distinct pavilions and a quiet open central floor.',
      title: 'The overall impression', move: 'F-Fury', quote: 'Three groups? I booked a bigger arena.',
      bio: 'When Nova speaks, car alarms go off in three districts, one per group. She hosts the loudest gathering in Mean Streets: every crew gets the same number of seats, and nobody leaves until the overall question has had its moment.',
      joke: '“I can tell someone’s different. Names cost extra.”', stage: 'Variance Pavilion', test: 'Balanced one-way ANOVA',
      choose: 'You’re planning an overall comparison of independent group means, with equal group sizes and a common within-group SD.', avoid: 'This powers the overall F-test. It does not guarantee power for every pairwise comparison or accommodate unequal allocation.',
      waiting: 'Every group deserves a place in the spotlight.', resultTitle: 'The lineup is balanced.', scoreTitle: 'GROUP PLAN', trait: 'STAGE PRESENCE', weakness: 'INDOOR VOICE',
    },
  };
  Object.assign(fighters, {
    correlation: {
      name: 'Volt', region: 'means', number: '05', image: './assets/web/volt-arcade-v1.webp', stageImage: './assets/web/volt-stage-v1.webp', stageFraming: 'full',
      alt: 'Volt, a curly-haired fighter in a long violet jacket, holding a low fighting guard.', stageAlt: 'A dark violet rooftop with an angular antenna, distant lightning and an open central floor.',
      title: 'The unexpected connection', move: 'Covariance Surge', quote: 'We have chemistry. That proves nothing.',
      bio: 'Volt’s hair stands on end whenever two variables move together. She listens for patterns from the highest aerial in the district, then spends the evening explaining why moving together does not make either one the boss.',
      joke: '“My ex and I were highly correlated. Terrible experimental design.”', stage: 'Signal Spire', test: 'Pearson correlation',
      choose: 'You’re planning a test of Pearson correlation against zero using independent complete observations of X and Y.', avoid: 'Rank correlation, repeated measurements, partial correlation and a nonzero null need different methods. Planning here uses an explicit Fisher-z approximation.',
      waiting: 'Two signals. One question about their connection.', resultTitle: 'Signal plan connected.', scoreTitle: 'SIGNAL PLAN', trait: 'CHEMISTRY', weakness: 'CAUSAL CLAIMS',
    },
    regression: {
      name: 'Vector', region: 'means', number: '06', image: './assets/web/vector-arcade-v1.webp', stageImage: './assets/web/vector-stage-v1.webp', stageFraming: 'full',
      alt: 'Vector, a lean gray-haired man with glasses and a slate-teal coat, gripping his lapel with a calculating half-smile.', stageAlt: 'A teal engineering terrace with an observatory dome, geometric structural beams and a quiet open floor.',
      title: 'The model citizen', move: 'Projection Strike', quote: 'I explain a lot. Never everything.',
      bio: 'Vector casts a shadow in as many dimensions as he has predictors. From the Projection Deck he assembles an entire predictor crew, checks that nobody is a perfect copy, and gives the intercept its own chair.',
      joke: '“The residuals and I have agreed to remain independent.”', stage: 'Projection Deck', test: 'Multiple linear regression',
      choose: 'You’re planning the overall F-test of a full-rank linear model with an intercept, using anticipated R² or Cohen’s f².', avoid: 'An individual slope, incremental block, binary outcome or design-specific random-X analysis needs a different power specification.',
      waiting: 'Give the full predictor crew a fair entrance.', resultTitle: 'Model mission planned.', scoreTitle: 'MODEL PLAN', trait: 'PERSPECTIVE', weakness: 'UNEXPLAINED DRAMA',
    },
  });
  Object.assign(fighters, {
    "mann-whitney": {"name": "Rook", "region": "frequency", "number": "07", "image": "./assets/web/rook-arcade-v1.webp", "stageImage": "./assets/web/rook-stage-v1.webp", "stageFraming": "full", "alt": "Rook, an angular young fighter with a copper forelock and burnt-orange jacket, gripping their lapel with a sly smirk.", "stageAlt": "Ordered stone terraces and broad steps under warm evening light.", "title": "The order of things", "move": "Ordinal Strike", "quote": "I have ranked your excuses.", "bio": "Stairs reorder themselves by height when Rook walks past. They keep the Ordinal Steps in immaculate order and never confuse a high rank with a large measurement.", "joke": "“I know who is ahead. Distances are someone else’s department.”", "stage": "Ordinal Steps", "test": "Mann–Whitney · approximate", "choose": "You can specify P(X₁>X₂) for two independent continuous groups with no ties.", "avoid": "This is a large-sample null-variance approximation, not exact power or a universal test of medians.", "waiting": "Two groups. A question of ordering.", "resultTitle": "The ranks are assembled.", "scoreTitle": "RANK PLAN", "trait": "COMPOSURE", "weakness": "TIES"},
    "signed-rank": {"name": "Echo", "region": "frequency", "number": "08", "image": "./assets/web/echo-arcade-v1.webp", "stageImage": "./assets/web/echo-stage-v1.webp", "stageFraming": "full", "alt": "Echo, a woman with a short silver bob, teal martial-arts jacket and wrapped fist raised at her chest, smiling knowingly.", "stageAlt": "An empty teal-lit courtyard with twin bells and complete rooflines.", "title": "The returning difference", "move": "Walsh Wave", "quote": "Some differences deserve a second hearing.", "bio": "Every strike Echo throws lands twice, and the second one is the difference. She tends the Twin Bell Court, listens to the differences themselves, and politely declines to mistake two measurements for two independent people.", "joke": "“My plus-one is another independent difference. Long story.”", "stage": "Twin Bell Court", "test": "Wilcoxon signed-rank · approximate", "choose": "You have continuous symmetric paired differences and can specify the Walsh-sum probability, or a normal difference model.", "avoid": "The probability concerns D₁+D₂, not just D>0. Ties, zeros, asymmetry and small designs need another power model.", "waiting": "The court is waiting for your paired differences.", "resultTitle": "Paired ranks in formation.", "scoreTitle": "WALSH PLAN", "trait": "RESONANCE", "weakness": "UNPAIRED SOCKS"},
    "proportions": {"name": "Pip", "region": "frequency", "number": "09", "image": "./assets/web/pip-arcade-v1.webp", "stageImage": "./assets/web/pip-stage-v1.webp", "stageFraming": "full", "alt": "Pip, a sturdy freckled woman with cropped copper hair and a saffron vest, grinning with her arms folded.", "stageAlt": "A quiet signal market with amber awnings and an open central floor.", "title": "The event counter", "move": "Arcsine Advance", "quote": "Tell me what counts. Then count it.", "bio": "Pip counts every raindrop that hits the Signal Market, stall by stall. She keeps two ledgers and one very clear event definition, because sixty percent means little until someone says sixty percent of what.", "joke": "“I give a hundred percent. Please enter that as a decimal.”", "stage": "Signal Market", "test": "Two proportions · approximate", "choose": "You are planning two equally sized independent binary-outcome groups using Cohen’s h or anticipated proportions.", "avoid": "A non-inferiority margin on a risk difference needs Parry. Rare events, paired outcomes and exact tests need a different design calculation.", "waiting": "Two groups. One shared definition of success.", "resultTitle": "The proportions have a plan.", "scoreTitle": "BINARY PLAN", "trait": "ACCOUNTABILITY", "weakness": "ROUNDING EARLY"},
    "chi-square": {"name": "Chi", "region": "frequency", "number": "10", "image": "./assets/web/chi-arcade-v1.webp", "stageImage": "./assets/web/chi-stage-v1.webp", "stageFraming": "full", "alt": "Chi, a tall dark-skinned man with a flat-top haircut, round glasses and geometric cobalt coat, holding a compact fighting guard.", "stageAlt": "A cobalt-lit mosaic exchange with patterned walls and an empty tiled floor.", "title": "The pattern in the counts", "move": "Mosaic Break", "quote": "Expected is a starting point.", "bio": "Floor tiles rearrange themselves into a contingency table under Chi’s feet. He repairs the Mosaic Exchange one cell at a time, checks every margin, and lets nobody turn row percentages into joint probabilities by shouting.", "joke": "“My expectations are high. In every cell, ideally.”", "stage": "Mosaic Exchange", "test": "Chi-square · approximate", "choose": "You can specify Cohen’s w and appropriate degrees of freedom, or a 2×2 alternative joint-probability table.", "avoid": "Sparse cells, dependent observations and exact contingency tests require a different approach.", "waiting": "Give the whole table a fair count.", "resultTitle": "The count plan is set.", "scoreTitle": "CELL PLAN", "trait": "PATTERN SENSE", "weakness": "EMPTY CELLS"},
    "log-rank": {"name": "Harbor", "region": "survival", "number": "11", "image": "./assets/web/harbor-arcade-v1.webp", "stageImage": "./assets/web/harbor-stage-v1.webp", "stageFraming": "full", "alt": "Harbor, a sea-weathered woman with windswept silver hair, navy stormcoat and orange scarf, gripping her collar with a resolute smile.", "stageAlt": "A storm-lit coastal platform with a complete lighthouse and open deck.", "title": "The keeper of time", "move": "Event Horizon", "quote": "A long wait is still information.", "bio": "The tide waits for Harbor, and she has not blinked since enrolment opened. She records events carefully, treats censoring with respect, and refuses to promise an enrolment number without a proper follow-up plan.", "joke": "“I asked for events. They sent calendar invitations.”", "stage": "Tidal Beacon", "test": "Log-rank event planning · approximate", "choose": "You need an approximate event requirement for a two-group proportional-hazards log-rank comparison.", "avoid": "Participants come from an optional enrolment step with exponential event times and uniform accrual. Crossing hazards, competing risks and informative censoring need another model.", "waiting": "Watch the events. Respect the time.", "resultTitle": "The event target is charted.", "scoreTitle": "EVENT PLAN", "trait": "PATIENCE", "weakness": "SHORT FOLLOW-UP"},
    "bonferroni": {"name": "Aegis", "region": "boundary", "number": "12", "image": "./assets/web/aegis-arcade-v1.webp", "stageImage": "./assets/web/aegis-stage-v1.webp", "stageFraming": "full", "alt": "Aegis, a bald muscular fighter in a crimson high-collared jacket and dark forearm guards, gripping his jacket with a challenging smirk.", "stageAlt": "A crimson fortress gate with several illuminated entrances and an open forecourt.", "title": "The family guardian", "move": "Alpha Aegis", "quote": "Everyone gets a share. Nobody gets the whole budget.", "bio": "Aegis’s shield splits into m smaller shields, each exactly α/m. He keeps the Gate of Many with one error budget and a firm guest list: each hypothesis gets an equal allowance, and none may borrow from the neighbor.", "joke": "“We are a family. We still need boundaries.”", "stage": "Gate of Many", "test": "Bonferroni family planning", "choose": "You need marginal power for a specified pooled two-sample comparison in a prespecified Bonferroni family.", "avoid": "This does not calculate joint power, Holm power, graphical procedures or adjusted observed p-values.", "waiting": "Set the family. Share the alpha.", "resultTitle": "The family budget is guarded.", "scoreTitle": "FAMILY PLAN", "trait": "BOUNDARIES", "weakness": "SURPRISE HYPOTHESES"},
  });
  Object.assign(fighters, {
    "non-inferiority": {"name": "Bastion", "region": "boundary", "number": "13", "image": "./assets/web/bastion-arcade-v1.webp", "stageImage": "./assets/web/bastion-stage-v1.webp", "stageFraming": "full", "alt": "Bastion, a muscular Black woman with close-cropped silver hair, a sleeveless navy-and-ivory boxing jacket and terracotta wraps, smiling with folded arms.", "stageAlt": "An empty industrial lookout with a complete boundary floodlight and amber navy sky.", "title": "The prespecified line", "move": "Margin Guard", "quote": "I know exactly how much ground I can give.", "bio": "Bastion draws lines in concrete just by looking at it. She keeps Margin Watch with a boundary set before the first bell, can defend either direction, and refuses to move the line because the fight got awkward.", "joke": "“The margin was agreed in advance. Unlike your excuse.”", "stage": "Margin Watch", "test": "Non-inferiority · parallel t-test", "choose": "You need equal-group pooled-t planning against a prespecified allowed loss, with an explicit beneficial direction.", "avoid": "A non-significant superiority test does not establish non-inferiority. A binary outcome needs Parry; survival and unequal-variance designs need other models.", "waiting": "Choose the direction. Set the allowed loss.", "resultTitle": "The boundary has a study plan.", "scoreTitle": "MARGIN PLAN", "trait": "RESOLVE", "weakness": "MOVING GOALPOSTS"},
    "tost": {"name": "Tess", "region": "boundary", "number": "14", "image": "./assets/web/tess-arcade-v1.webp", "stageImage": "./assets/web/tess-stage-v1.webp", "stageFraming": "full", "alt": "Tess, a lean woman with an auburn bun and emerald jacket, folding her arms with a sly confident grin.", "stageAlt": "An empty industrial yard framed by two complete green-lit gates.", "title": "Both sides of the argument", "move": "Twin Limit Lock", "quote": "Both gates. Same round.", "bio": "Tess closes two gates at the same instant from across the yard. Getting past one gate impresses nobody: she celebrates only when both equivalence limits are cleared together, with the same pooled standard deviation.", "joke": "“I said close enough. I did not say identical.”", "stage": "Twin Gate Yard", "test": "TOST equivalence · parallel t-tests", "choose": "You have prespecified lower and upper acceptable mean differences and want power for both pooled one-sided tests to pass.", "avoid": "Ordinary non-significance is not equivalence. Log-normal ratios need Ratio, crossover trials need Switch; paired and unequal-variance designs need other models.", "waiting": "Two limits. One joint decision.", "resultTitle": "Both limits have a plan.", "scoreTitle": "TOST PLAN", "trait": "BALANCE", "weakness": "ONE-SIDED ARGUMENTS"},
    "tost-lognormal": {"name": "Ratio", "region": "boundary", "number": "15", "image": "./assets/web/ratio-arcade-v1.webp", "stageImage": "./assets/web/ratio-stage-v1.webp", "stageFraming": "full", "alt": "Ratio, an androgynous brown-skinned fighter with short dark curls, gripping the turquoise lapels of their cream jacket with gold-gloved hands.", "stageAlt": "An empty glassworks terrace with complete paired geometric towers under amber and teal lights.", "title": "The geometric mediator", "move": "Log Scale Link", "quote": "Keep the ratio. Respect the scale.", "bio": "Ratio thinks only in logarithms and hears multiplication as addition. They run the Ratio Foundry on the log scale and keep explaining why a parallel trial needs between-subject variability, even when a crossover spreadsheet looks tempting.", "joke": "“Our geometric means have excellent chemistry. Our arithmetic means need counseling.”", "stage": "Ratio Foundry", "test": "Log-normal TOST · parallel bioequivalence", "choose": "You need one-endpoint average-bioequivalence planning for independent parallel groups, using a geometric T/R ratio and total CV.", "avoid": "A crossover trial needs Switch. This is not a joint AUC/Cmax power calculation, and default limits do not establish regulatory suitability.", "waiting": "One ratio. Two parallel groups. Both limits.", "resultTitle": "The ratio plan is ready.", "scoreTitle": "RATIO PLAN", "trait": "PERSPECTIVE", "weakness": "WRONG-SCALE CVS"},
  });
  // Arcade wave. A fighter given artPending: true stays out of every menu until its portrait and
  // stage exist; direct links still open it with a placeholder silhouette for review.
  Object.assign(fighters, {
    ancova: {
      name: 'Anchor', region: 'means', number: '16', image: './assets/web/anchor-arcade-v1.webp', stageImage: './assets/web/anchor-stage-v1.webp', stageFraming: 'full',
      alt: 'Anchor, a heavyset bearded man in a rust-and-teal work jacket, one fist resting in his palm with a calm half-smile.', stageAlt: 'A night freight depot with one long level rail line, a signal cabin and stacked containers.',
      title: 'The immovable baseline', move: 'Baseline Lock', quote: 'Tell me where you started. I’ll tell you what changed.',
      bio: 'Anchor has not moved from his spot at Baseline Depot since 1974; the night freight routes around him. He measures every recruit on arrival and refuses to be impressed by any outcome until he has subtracted what was already there.',
      joke: '“I don’t do change scores. I do regression. Have a seat.”', stage: 'Baseline Depot', test: 'ANCOVA · approximate',
      choose: 'You’re comparing two randomized groups on a continuous outcome and have a baseline measurement (or a few prespecified covariates) that predicts it.',
      avoid: 'No baseline worth adjusting for? Maverick is simpler. Covariates measured after randomization are not covariates; they are trouble.',
      waiting: 'Baseline recorded. Bring me the follow-up.', resultTitle: 'The baseline holds.', scoreTitle: 'BASELINE PLAN', trait: 'STEADINESS', weakness: 'POST-BASELINE COVARIATES',
    },
    'tost-crossover': {
      name: 'Switch', region: 'boundary', number: '17', image: './assets/web/switch-arcade-v1.webp', stageImage: './assets/web/switch-stage-v1.webp', stageFraming: 'full',
      alt: 'Switch, a lean man with a moustache in a jacket split into amber and teal halves, standing light on his feet with one eyebrow raised.', stageAlt: 'A night tram junction where two tracks cross, lit amber on one side and teal on the other.',
      title: 'The double agent', move: 'Period Swap', quote: 'You get both. Just never at the same time.',
      bio: 'Switch’s jacket swaps its colours at every washout, and so does he. At Crossover Junction every subject rides both lines, Test one night and Reference the next; because each passenger is their own control, he needs a fraction of a parallel trial’s crowd.',
      joke: '“Carry-over? I wash out between rounds. Every time.”', stage: 'Crossover Junction', test: '2×2 crossover TOST',
      choose: 'You’re planning a two-period, two-sequence crossover bioequivalence study and know the within-subject CV.',
      avoid: 'Parallel groups need Ratio. Highly variable drugs need reference-scaled limits or a replicate design.',
      waiting: 'Both tracks are open. Pick your sequence.', resultTitle: 'Both periods are booked.', scoreTitle: 'CROSSOVER PLAN', trait: 'AGILITY', weakness: 'CARRY-OVER',
    },
    'ni-proportions': {
      name: 'Parry', region: 'frequency', number: '18', image: './assets/web/parry-arcade-v1.webp', stageImage: './assets/web/parry-stage-v1.webp', stageFraming: 'full',
      alt: 'Parry, a slim older man in an olive quilted jacket, turning aside an attack with one open gloved palm.', stageAlt: 'A dim training hall with tall arched windows and a single pale line painted across the wooden floor.',
      title: 'The measured concession', move: 'Margin Deflect', quote: 'I yield ten points. Not one more.',
      bio: 'In forty years nothing has crossed Parry’s line in Margin Hall; thrown objects curve around it. He will concede a few percentage points to a new treatment with fewer side effects, provided the concession was agreed before anyone threw a punch.',
      joke: '“Non-inferior is not the same as inferior. Please write that down.”', stage: 'Margin Hall', test: 'Non-inferiority · two proportions',
      choose: 'You’re showing that a new treatment’s response or event rate is no worse than a reference by more than a prespecified margin, or better by more than one.',
      avoid: 'A continuous outcome needs Bastion. A plain two-sided comparison of rates needs Pip.',
      waiting: 'The line is painted. Choose how much ground to give.', resultTitle: 'The margin is defended.', scoreTitle: 'MARGIN PLAN', trait: 'COMPOSURE', weakness: 'SHIFTING MARGINS',
    },
  });

  // Last wave: events over time and interim looks.
  Object.assign(fighters, {
    'vaccine-efficacy': {
      name: 'Jab', region: 'survival', number: '19', image: './assets/web/jab-arcade-v1.webp', stageImage: './assets/web/jab-stage-v1.webp', stageFraming: 'full',
      alt: 'Jab, a young boxer in an open white-and-scarlet robe, throwing a straight left with taped hands and a cocky grin.', stageAlt: 'An open-air boxing ring in a field camp at night, with lit canvas tents and a string of bulbs.',
      title: 'The first line of defence', move: 'Case Count Combo', quote: 'Count the cases. I’ll count the knockdowns.',
      bio: 'Jab throws a punch faster than an incubation period. In the Field Ring nobody keeps score in rounds: the bout ends when enough cases have landed, and the only number that matters is how many came from his corner.',
      joke: '“I don’t dodge the virus. I make it miss the vaccinated.”', stage: 'Field Ring', test: 'Vaccine efficacy · exact',
      choose: 'You’re planning a case-driven vaccine trial and want the number of cases, and then participants, to show efficacy above a bound such as 30%.',
      avoid: 'Time-to-event comparisons need Harbor. Recurrent infections per person need Scatter.',
      waiting: 'Gloves taped. Waiting for the cases.', resultTitle: 'Protection proven.', scoreTitle: 'CASE PLAN', trait: 'HAND SPEED', weakness: 'LOW ATTACK RATES',
    },
    'negative-binomial': {
      name: 'Scatter', region: 'survival', number: '20', image: './assets/web/scatter-arcade-v1.webp', stageImage: './assets/web/scatter-stage-v1.webp', stageFraming: 'full',
      alt: 'Scatter, a lanky man with a mop of curls and a mustard coat covered in uneven dots, grinning in a loose off-balance stance.', stageAlt: 'A night courtyard where paper lanterns hang in uneven clusters, crowded in places and sparse in others.',
      title: 'The overdispersed', move: 'Clump Flurry', quote: 'Some people get one flare-up. Some get twelve.',
      bio: 'Scatter arrives in three places at once, then nowhere for a month. He fights the way exacerbations arrive, in clumps, and the extra variance is the whole point. Poisson models try to predict him and lose.',
      joke: '“My variance exceeds my mean. My doctor calls it a lifestyle.”', stage: 'Lantern Yard', test: 'Negative binomial rate ratio · approximate',
      choose: 'You’re comparing event rates per participant (exacerbations, relapses, infections) where some participants have many more events than others.',
      avoid: 'Time to the first event needs Harbor. A single yes/no outcome per person needs Pip or Parry.',
      waiting: 'The lanterns are lit. Count every flare-up.', resultTitle: 'The rate is tamed.', scoreTitle: 'RATE PLAN', trait: 'UNPREDICTABILITY', weakness: 'SHORT FOLLOW-UP',
    },
    'gsd-efficacy': {
      name: 'Bell', region: 'boundary', number: '21', image: './assets/web/bell-arcade-v1.webp', stageImage: './assets/web/bell-stage-v1.webp', stageFraming: 'full',
      alt: 'Bell, a woman with a black bob and a white streak, in a gold jacket over a referee-striped collar, raising an open hand to stop the fight.', stageAlt: 'A mountain-top ring before dawn, with three lamp posts climbing the path and a bronze bell in a small pavilion.',
      title: 'The early finish', move: 'Final Bell', quote: 'I don’t need fifteen rounds to see a knockout.',
      bio: 'Bell hears a knockout three rounds before it happens. She referees the Summit Ring, checks the fight at each lamp on the path, and stops it early only when a boundary is crossed. She spent her alpha budget before the first round and never overspends.',
      joke: '“Stopping early isn’t quitting. It’s winning with a smaller crowd.”', stage: 'Summit Ring', test: 'Group sequential · efficacy',
      choose: 'You want one or two interim analyses that can stop the trial early for overwhelming efficacy while keeping the overall one-sided alpha.',
      avoid: 'If you also want to stop for futility, Towel throws in the towel. Several endpoints sharing alpha need Aegis.',
      waiting: 'Three lamps on the path. Ready at each one.', resultTitle: 'Ding ding. It’s over.', scoreTitle: 'LOOK PLAN', trait: 'TIMING', weakness: 'UNPLANNED LOOKS',
    },
    'gsd-futility': {
      name: 'Towel', region: 'boundary', number: '22', image: './assets/web/towel-arcade-v1.webp', stageImage: './assets/web/towel-stage-v1.webp', stageFraming: 'full',
      alt: 'Towel, a stout older corner man with a grey moustache and flat cap, gripping the towel on his shoulder and holding one hand out flat.', stageAlt: 'An old boxing gym with a ring corner, stool and bucket on one side and three blank easel boards on the other.',
      title: 'The corner man', move: 'Throw It In', quote: 'Some fights you win early. Some you stop early.',
      bio: 'Towel’s thrown towel always lands exactly on the futility bound. Between rounds he reads the cards on his three easels and decides: keep going, celebrate, or stop. His futility calls are advice, not law, so the referee’s alpha never changes.',
      joke: '“Non-binding means you can ignore me. Nobody ever does twice.”', stage: 'Corner Gym', test: 'Group sequential · efficacy + futility',
      choose: 'You want interim analyses that can stop early for efficacy or for futility, with non-binding futility bounds as regulators expect.',
      avoid: 'Efficacy-only stopping is Bell’s job. A single analysis needs the fighter for your endpoint.',
      waiting: 'Towel on the shoulder. Watching every round.', resultTitle: 'Right call, champ.', scoreTitle: 'CORNER PLAN', trait: 'JUDGEMENT', weakness: 'SUNK COSTS',
    },
  });

  // Challenge-card data. stats: hand scores (1–10) with the reason shown on focus.
  // CALC ACCURACY: whether the app computes power and sample size exactly under the method's model,
  // or by a large-sample approximation. It says nothing about whether the test itself is exact. ROBUSTNESS: how few distributional assumptions.
  // EFFICIENCY: how little sample when its assumptions hold. FLEXIBILITY: allocation, tails and input modes.
  const card = (headline, challenge, accent, [accuracy, robustness, efficiency, flexibility]) => ({ headline, challenge, accent, stats: { accuracy, robustness, efficiency, flexibility } });
  const cards = {
    'two-sample': card('TWO-SAMPLE T-TEST', 'T-TEST', '#49b4c3', [[10, 'Exact noncentral-t power, pooled; Welch mode is approximate.'], [6, 'Needs roughly normal outcomes; Welch mode drops the equal-SD assumption.'], [9, 'Uses every measurement directly.'], [9, 'Any allocation, one or two tails, effect, means or Welch entry.']]),
    paired: card('PAIRED T-TEST', 'PAIR UP', '#d487a7', [[10, 'Exact noncentral-t power.'], [6, 'Needs roughly normal paired differences.'], [10, 'Each unit is its own control.'], [6, 'Tails and two entry modes; one design.']]),
    'one-sample': card('ONE-SAMPLE T-TEST', 'BEAT THE BENCHMARK', '#8daee0', [[10, 'Exact noncentral-t power.'], [6, 'Needs roughly normal observations.'], [9, 'No control group to pay for.'], [5, 'Tails and two entry modes against a fixed value.']]),
    anova: card('ONE-WAY ANOVA', 'ANOVA', '#bf99d4', [[10, 'Exact noncentral-F power.'], [5, 'Normal outcomes and a common SD in every group.'], [7, 'Omnibus power only; no pairwise guarantee.'], [6, 'Two to twenty groups; equal sizes only.']]),
    ancova: card('ANCOVA', 'ADJUST FOR BASELINE', '#d9825b', [[7, 'Standard approximation; slightly optimistic in small trials.'], [5, 'Linear covariate effect, equal slopes, normal residuals.'], [10, 'A good baseline can cut the sample by a third or more.'], [8, 'Covariate count, allocation, tails and two entry modes.']]),
    correlation: card('CORRELATION', 'CORRELATE', '#b58bdf', [[6, 'Fisher-z approximation with a t cutoff.'], [4, 'Bivariate normal, linear association only.'], [7, 'Fine for moderate correlations.'], [6, 'Tails, ρ or covariance entry.']]),
    regression: card('LINEAR REGRESSION', 'REGRESS', '#7fbebc', [[9, 'Exact noncentral F under the fixed-X convention.'], [5, 'Correct linear model, normal errors.'], [7, 'Overall F only, not a single slope.'], [6, 'Up to twenty predictor df; f² or R² entry.']]),
    'mann-whitney': card('MANN–WHITNEY', 'RANK THEM', '#f1ac68', [[4, 'Large-sample Noether approximation.'], [9, 'No normality needed, only continuous data without ties.'], [7, 'Nearly as efficient as t for normal data.'], [4, 'Equal groups; tails; probability entry.']]),
    'signed-rank': card('SIGNED-RANK', 'SIGN-RANK', '#77d2c5', [[4, 'Large-sample Noether approximation.'], [8, 'Symmetric differences, no normality.'], [8, 'Pairs, and close to t efficiency.'], [5, 'Tails; Walsh or normal-difference entry.']]),
    proportions: card('TWO PROPORTIONS', 'COMPARE PROPORTIONS', '#efc76f', [[5, 'Arcsine normal approximation.'], [7, 'Bernoulli outcomes need no distributional shape.'], [7, 'Binary outcomes carry less information per person.'], [4, 'Equal groups; tails; h or proportions entry.']]),
    'chi-square': card('CHI-SQUARE', 'CHI-SQUARE', '#86b9ff', [[5, 'Asymptotic noncentral χ².'], [7, 'Counts only; needs adequate expected cells.'], [6, 'Omnibus tests spread their power thinly.'], [7, 'Any df; Cohen’s w or a 2×2 table.']]),
    'ni-proportions': card('NON-INFERIORITY · PROPORTIONS', 'DEFEND THE MARGIN', '#a9b866', [[5, 'Farrington–Manning normal approximation.'], [7, 'Bernoulli outcomes; strained near 0 or 1.'], [7, 'Binary endpoints need more participants.'], [9, 'Non-inferiority or superiority, either direction, any allocation.']]),
    'log-rank': card('LOG-RANK', 'COUNT THE EVENTS', '#f5ae7d', [[5, 'Schoenfeld normal approximation.'], [6, 'Proportional hazards; censoring must be uninformative.'], [7, 'Information comes from events, not people.'], [7, 'Allocation, HR entry, optional enrolment step.']]),
    bonferroni: card('BONFERRONI', 'SHARE THE ALPHA', '#f595a3', [[10, 'Exact noncentral t at α/m.'], [6, 'Valid for any dependence between tests.'], [4, 'Conservative: every test pays full price.'], [6, 'One to a hundred tests; tails; two entry modes.']]),
    'non-inferiority': card('NON-INFERIORITY', 'HOLD THE LINE', '#d69b7e', [[10, 'Exact noncentral-t power.'], [5, 'Normal outcomes and a common SD.'], [8, 'One-sided: no power spent on the other tail.'], [6, 'Either beneficial direction; two entry modes.']]),
    tost: card('TOST EQUIVALENCE', 'PROVE EQUIVALENCE', '#7ecfa9', [[10, 'Exact joint TOST power.'], [5, 'Normal outcomes and a common SD.'], [7, 'Both limits must be cleared at once.'], [6, 'Asymmetric limits; two entry modes.']]),
    'tost-lognormal': card('BIOEQUIVALENCE · PARALLEL', 'MATCH THE RATIO', '#7ccfd1', [[10, 'Exact joint TOST power on the log scale.'], [5, 'Log-normal outcomes, common total CV.'], [5, 'Parallel groups carry between-subject variance.'], [6, 'Any ratio limits; CV or log-SD entry.']]),
    'tost-crossover': card('CROSSOVER BIOEQUIVALENCE', 'CROSS OVER', '#e9a93f', [[10, 'Exact joint TOST power; matches PowerTOST.'], [5, 'Log-normal outcomes, no carry-over.'], [10, 'Every subject is their own control.'], [5, 'Balanced 2×2 only; any ratio limits.']]),
    'vaccine-efficacy': card('VACCINE EFFICACY', 'PROVE PROTECTION', '#e0574f', [[10, 'Exact binomial power on the case split.'], [8, 'Conditional on cases: no model for when they occur.'], [7, 'Rare cases mean long, large trials.'], [7, 'Any efficacy bound, allocation, case-to-participant step.']]),
    'negative-binomial': card('NEGATIVE BINOMIAL', 'COUNT EVERY FLARE-UP', '#d9b23c', [[6, 'Normal approximation on the log rate ratio.'], [6, 'Allows over-dispersion; assumes a common dispersion.'], [8, 'Uses every event, not just the first.'], [8, 'Superiority or non-inferiority, follow-up, allocation.']]),
    'gsd-efficacy': card('GROUP SEQUENTIAL', 'STOP EARLY', '#f0c35a', [[9, 'Numerical integration under the normal approximation.'], [6, 'Normal test statistic with information ∝ size.'], [9, 'Small inflation; often stops early.'], [9, 'Two or three looks, four spending families, three inputs.']]),
    'gsd-futility': card('SEQUENTIAL + FUTILITY', 'KNOW WHEN TO QUIT', '#5fae7c', [[9, 'Numerical integration under the normal approximation.'], [6, 'Normal test statistic with information ∝ size.'], [9, 'Stops losing trials early too.'], [10, 'Separate efficacy and futility spending, any timing.']]),
  };
  for (const [id, extra] of Object.entries(cards)) Object.assign(fighters[id], extra);

  // The CPU opponent every fighter faces. Drawn as a CSS silhouette until its portrait exists.
  const cpu = { name: 'THE NULL', image: './assets/web/null-arcade-v1.webp', alt: 'The Null, a hooded figure in a charcoal coat with no visible face, arms folded.', quote: 'Nothing to see here. Prove otherwise.' };

  const help = {
    play: ['How to play', 'Tap a district on the map to read its briefing, and tap it again to enter. Pick a fighter from the select screen to see their challenge card, then press Start to enter the arena. Set your study parameters and press Fight: the fighter takes on The Null, the hypothesis of no effect, and the sample size they need to beat it is your score. Change a value and Rematch to calculate again. Quick Select shows every fighter at once. Each fighter keeps a separate draft. Nothing is locked behind a score.'],
    dropout: ['Dropout allowance', 'The expected proportion of enrolled participants who will not provide analyzable data. The calculated sample size is unchanged; Stat Fighter adds a separate line dividing it by (1 − dropout) and rounding up each group. Dropout that is related to treatment or outcome can bias the analysis, which no allowance fixes.'],
    effect: ['Standardized effect', 'The effect uses the population SD appropriate to this method. For paired data, use the SD of differences. For a one-sample test, compare the population mean to the fixed reference. For ANOVA, Cohen’s f uses the population SD of expected group means divided by the common within-group SD. Supported absolute d or positive f: 0.001 to 5.'],
    means: ['Alternative inputs', 'Enter anticipated population quantities, all in the same measurement units. Each input mode retains its own draft. A single standardized effect cannot uniquely reconstruct means or SDs. The displayed derived effect shows the conversion used.'],
    mean1: ['Expected means', 'Use anticipated population means for the study being planned. Group 1 minus Group 2 determines the sign. Both means and their common SD must use the same units.'],
    mean2: ['Expected means', 'Use anticipated population means for the study being planned. Group 1 minus Group 2 determines the sign. Both means and their common SD must use the same units.'],
    mean: ['Expected population mean', 'The anticipated mean of your sampled population. The effect direction is population mean minus the fixed reference.'],
    reference: ['Fixed reference mean', 'A known benchmark treated as fixed, with no sampling uncertainty. An estimate from a separate sample requires a different design.'],
    difference: ['Mean paired difference', 'Choose a consistent pair order in advance, such as after minus before. Enter the anticipated population mean of those differences. Positive and negative values refer to that order.'],
    sdDifference: ['SD of paired differences', 'Use the population SD of after-minus-before differences, or the SD for your predefined pair order. This is neither the SD at one occasion nor a standard error. Separate marginal SDs also require the within-pair correlation; that entry mode is not included here.'],
    sd: ['Population standard deviation', 'A positive population SD, not a standard error or variance. Independent groups and ANOVA assume one common within-group SD. Paired calculations instead use their dedicated SD-of-differences field.'],
    groups: ['Balanced group count', 'Choose 2 to 20 groups. Every group receives the same sample size. In means mode, enter one expected population mean per group. Increasing or reducing the count retains each group’s draft so you can restore it.'],
    groupMean: ['Expected group mean', 'Enter one anticipated population mean for this group, using the common within-group SD’s measurement units. All groups have equal weight. Cohen’s f = square root of the mean squared deviations of the group means from their grand mean, divided by the common within-group SD. The divisor is k, not k−1. Identical means imply zero effect and cannot reach the supported power target.'],
    alpha: ['Alpha · Type I error', 'The rejection probability under the null hypothesis for the planned test. 0.05 means 5%. Two-sided t-tests split alpha between both tails. ANOVA uses the upper F tail. Supported range: 0.0001 to 0.20.'],
    power: ['Target power', 'The chance the planned test rejects the null if your specified effect and model assumptions hold. Enter a decimal: 0.80 means 80%. It is not the probability that a hypothesis is true. Supported range: 0.50 to 0.999.'],
    ratio: ['Allocation ratio', 'Group 2 sample size divided by Group 1 sample size. 2 means roughly twice as many in Group 2. Group 2 is rounded to the nearest integer, half ties up, with at least two per group. Displayed counts show the actual allocation. Supported ratio: 0.1 to 10.'],
    alternative: ['Choose your direction', 'Two-sided detects a difference in either direction. Greater and less refer to the effect’s stated subtraction order. The signed effect must agree. Choose your hypothesis before observing data. ANOVA has an overall upper-tail F test and no directional switch.'],
    covariance: ['Population covariance', 'Enter the anticipated covariance of X and Y in the product of their measurement units. Dividing by the two positive population SDs gives Pearson ρ. The implied absolute correlation must be 0.001–0.99. These are planning quantities, not observed study data.'],
    sdX: ['Population SD of X', 'The anticipated population standard deviation of X, in X’s units. It must be positive. Do not use a standard error or variance.'],
    sdY: ['Population SD of Y', 'The anticipated population standard deviation of Y, in Y’s units. It must be positive. Do not use a standard error or variance.'],
    predictors: ['Predictor degrees of freedom', 'Count the slope parameters in the complete model, excluding the fitted intercept. A categorical factor with L levels usually contributes L−1; interactions or spline terms can contribute several. Supported total: 1–20. This powers all slopes together, not a selected slope or block.'],
    rSquared: ['Anticipated whole-model R²', 'The population proportion of outcome variance explained by the entire predictor set. Use unadjusted R². For the test against an intercept-only model, f² = R²/(1−R²). Supported f² is 0.001–5, corresponding approximately to R² 0.000999–0.833333. Zero is not a detectable alternative.'],
    verification: ['Engine verification', 'Each method states its probability model and approximation. Independent R fixtures verify implementation of that model, including integer results and predecessor power. They do not establish approximation accuracy for your study. Independent R reference cases check sample sizes, achieved power and previous allocations. Input conversions are tested separately. Run node --test tests/*.test.mjs. Passing these examples is not a domain-wide numerical error guarantee. See tests/reference/README.md.'],
  };
  // Rotating lines. Per fighter: [waitingMore, resultTitleMore, jokeMore]; the fighter's own single
  // string stays the first choice in each pool (kit.pool). Bubble lines ≤ 80 characters, jokes ≤ 110.
  const more = {
    "two-sample": [["Two crews, one runway. Give me numbers.","I don’t taxi. Enter an effect size."], ["Difference confirmed. Tower, we are significant.","Two groups went up. One hypothesis came down."], ["“My groups never talk to each other. That’s not attitude. That’s independence.”"]],
    "paired": [["Bring everyone back for round two. Same faces.","Before is here. After is running late."], ["Every subject met their match: themselves.","Twice the measurements, half the drama."], ["“I never fight strangers. I fight you, then you again.”"]],
    "one-sample": [["One sample. One number to beat. Speak.","The benchmark does not move. Neither do I."], ["The reference has been informed of its defeat.","Alone, and still sufficiently powered."], ["“They offered me a control group. I said: I am the control group.”"]],
    "anova": [["Every crew on stage! Equal seats, no favourites.","I can’t hear you over all these group means."], ["Somebody here is different, and the whole arena knows it.","F for fabulous. Also for the test statistic."], ["“Post-hoc? Darling, that’s the after-party.”"]],
    "ancova": [["Weigh in first. Everyone weighs in first.","No baseline, no bout."], ["Subtracted what you walked in with. The rest is real.","Variance explained. Politely, and in full."], ["“Change from baseline? I AM the baseline.”"]],
    "correlation": [["Two signals in the air. Tune me in.","I feel a connection. Could be nothing. Enter ρ."], ["They move together. I’m still not saying who leads.","Signal locked. Causation not included."], ["“Ice cream sales and shark attacks walk into a bar. Summer was driving.”"]],
    "regression": [["Line up your predictors. Intercept, take your chair.","Tell me how much you plan to explain."], ["The model stands. The residuals have been seated separately.","Projected, fitted, and ready to be over-interpreted."], ["“All my models are wrong. Some of them fit the budget.”"]],
    "proportions": [["Yes or no. I don’t sell maybes.","Two stalls, one event. Name your proportions."], ["Counted twice. Still different.","The ledger balances. The null doesn’t."], ["“Fifty-fifty? That’s not a hypothesis. That’s a coin.”"]],
    "chi-square": [["Every tile needs a count. No empty cells.","Show me the table you expect. I’ll bring the one I observe."], ["Observed met expected. They did not get along.","Pattern broken. Sweep up the residuals."], ["“I expected nothing. Then I divided by it. Never again.”"]],
    "ni-proportions": [["Name the margin. Then never speak of moving it.","I give ground by appointment only."], ["Not one step past the line. Non-inferior, as agreed.","Conceded exactly what was promised. Nothing else."], ["“Not worse is not a compliment. It is a confidence bound.”"]],
    "mann-whitney": [["Line up. Tallest claim at the back.","I don’t need your units. Just your order."], ["Everyone in their place. Yours is ahead.","Ranked, summed, settled."], ["“Outliers? To me you’re just last in line.”"]],
    "signed-rank": [["Say it once. I’ll hear it twice.","Bring pairs. Singles wait outside."], ["The differences came back, and they agree.","Signed, ranked, delivered."], ["“I asked for symmetry. I got opinions.”"]],
    "log-rank": [["Tell me the hazard. I’ll watch the horizon.","Nothing yet. Nothing is also data. Censored data."], ["Enough events in the log. Light the beacon.","The curves parted. I saw it happen."], ["“Lost to follow-up? Not on my coast. I have a lighthouse.”"]],
    "vaccine-efficacy": [["Ring’s open. Send the cases, I’ll sort the corners.","Tell me the efficacy. I’ll tell you how long we dance."], ["Count it! Most of those landed on placebo.","Lower bound’s off the canvas. Efficacy stands."], ["“I don’t count rounds. I count cases. Rounds are for people with time.”"]],
    "negative-binomial": [["Could be zero flare-ups. Could be nine. Enter k.","I rattle. Count how often."], ["Every flare-up counted. Even the ones that came in a clump.","Poisson called. I let it ring. Twelve times."], ["“I’m not inconsistent. I’m overdispersed.”"]],
    "bonferroni": [["How many hypotheses at the gate? Count them all.","One budget. Tell me how many mouths."], ["Every test got its slice. Nobody got seconds.","Family protected. Wallet empty."], ["“I split the bill evenly. Even with the hypothesis who only had water.”"]],
    "non-inferiority": [["Draw the line. I’ll stand on it.","How much can you afford to lose? Be specific."], ["Held the line. Didn’t even need the other tail.","Margin intact. Not one inch more."], ["“I don’t win. I refuse to lose by more than Δ.”"]],
    "tost": [["Two gates. You pass both or you pass neither.","Give me a lower and an upper. I have two hands."], ["Both gates closed behind you. Welcome to equivalence.","Not different enough to matter. That’s the trophy."], ["“Failing to find a difference is a hobby. Proving there isn’t one is a job.”"]],
    "tost-lognormal": [["Give me a ratio. Keep your differences.","Eighty to one-twenty-five. Stay inside."], ["Geometric means, matched. The furnace approves.","Inside the limits on the log scale, where it counts."], ["“I’m 95% the fighter the reference is. Give or take a confidence interval.”"]],
    "tost-crossover": [["Everybody rides both lines. Pick who goes first.","Tell me the within-subject CV. Not the other one."], ["Same passengers, both tracks, no difference worth a ticket.","Crossed over, washed out, signed off."], ["“I’m my own control. My therapist says that’s the problem.”"]],
    "gsd-efficacy": [["Alpha’s packed in three envelopes. Tell me when to open them.","I only ring on schedule. Set the looks."], ["Boundaries set. I’ll ring the moment it’s over.","Three looks, one budget, zero peeking."], ["“Peeking is free. Stopping costs alpha.”"]],
    "gsd-futility": [["I know a lost fight when I see one. Set the looks.","Efficacy up top, futility down low. Where do I stand?"], ["Now we know when to cheer and when to go home.","Plan’s set, champ. Towel’s ready. Hope we don’t need it."], ["“Conditional power is just hope with a denominator.”"]],
  };
  for (const [id, [waitingMore, resultTitleMore, jokeMore]] of Object.entries(more)) Object.assign(fighters[id], { waitingMore, resultTitleMore, jokeMore });
  Object.assign(cpu, {
    taunts: ["Nothing happened. Nothing ever happens.","I am the default. You are the paperwork.","Fail to reject me. Everyone does.","Your effect size called. It’s smaller in person.","I’ve been retained more often than you’ve been funded.","Go on. Add more subjects. I have all day.","I don’t need power. I have the benefit of the doubt.","You can’t prove me. You can’t lose me either.","Another underpowered hero. Adorable.","I am not true. I am just very hard to embarrass.","The effect is zero until your budget says otherwise.","p = 0.06. Sleep well."],
    defeats: ["Rejected. On paper. See you at replication.","Fine. But I’m keeping the 5%.","Enjoy it. Type I says hello.","You needed THAT many?","With those assumptions, anyone could."],
  });
  // Every stale line must contain “Rematch” (browser QA checks it).
  const lines = { stale: ["You changed the rules. Rematch?","New numbers, old result. Rematch?","That’s a different fight now. Rematch?"], taglines: ["Big hair. Small p-values.","Insert coin. Reject null.","No guts. Just good assumptions.","Winners prespecify."] };

  // Matchmaker: three questions, first matching rule wins. step(answers) is pure: it returns the next
  // question with its options, a fighter id, or { none: true } when no fighter covers the answers.
  const matchmaker = {
    goals: [
      ['difference', 'A difference', 'Groups, conditions or a benchmark differ.'],
      ['not-worse', 'Not worse', 'A new option is no worse than the standard by more than a margin (non-inferiority).'],
      ['same', 'The same', 'Two options are equivalent within limits (equivalence, bioequivalence).'],
      ['early', 'Early stopping', 'Interim looks that may stop the trial early.'],
      ['many', 'Many comparisons', 'Several tests sharing one alpha.'],
      ['relationship', 'A relationship', 'How variables move together or predict an outcome.'],
    ],
    outcomes: [
      ['continuous', 'A measurement', 'Blood pressure, a score, a concentration.'],
      ['binary', 'Yes or no', 'Responder, cured, event happened.'],
      ['ordinal', 'Ranks or badly skewed', 'Ordinal scales, or data far from normal.'],
      ['time', 'Time to an event', 'Survival, time to relapse.'],
      ['counts', 'Repeated events per person', 'Exacerbations, seizures, falls.'],
      ['cases', 'Vaccine cases', 'Cases of disease in a vaccine trial.'],
    ],
    noOutcome: ['early', 'many', 'relationship'],
    rules: [
      { goal: 'relationship', design: 'two-variables', label: 'Two variables, one correlation', fighter: 'correlation' },
      { goal: 'relationship', design: 'predictors', label: 'An outcome and several predictors', fighter: 'regression' },
      { goal: 'many', fighter: 'bonferroni' },
      { goal: 'early', design: 'efficacy', label: 'Stop early for efficacy only', fighter: 'gsd-efficacy' },
      { goal: 'early', design: 'futility', label: 'Stop early for efficacy or futility', fighter: 'gsd-futility' },
      { goal: 'same', outcome: 'continuous', design: 'parallel-means', label: 'Parallel groups, difference in means', fighter: 'tost' },
      { goal: 'same', outcome: 'continuous', design: 'parallel-ratio', label: 'Parallel groups, ratio of geometric means (PK)', fighter: 'tost-lognormal' },
      { goal: 'same', outcome: 'continuous', design: 'crossover', label: 'Crossover: everyone gets both', fighter: 'tost-crossover' },
      { goal: 'not-worse', outcome: 'continuous', fighter: 'non-inferiority' },
      { goal: 'not-worse', outcome: 'binary', fighter: 'ni-proportions' },
      { goal: 'not-worse', outcome: 'counts', fighter: 'negative-binomial', tip: 'Set the null rate ratio above 1 in the arena.' },
      { goal: 'difference', outcome: 'continuous', design: 'two-groups', label: 'Two independent groups', fighter: 'two-sample' },
      { goal: 'difference', outcome: 'continuous', design: 'baseline', label: 'Two groups, adjusting for a baseline', fighter: 'ancova' },
      { goal: 'difference', outcome: 'continuous', design: 'paired', label: 'Before and after, or matched pairs', fighter: 'paired' },
      { goal: 'difference', outcome: 'continuous', design: 'one-group', label: 'One group against a fixed value', fighter: 'one-sample' },
      { goal: 'difference', outcome: 'continuous', design: 'many-groups', label: 'Three or more groups', fighter: 'anova' },
      { goal: 'difference', outcome: 'binary', design: 'two-groups', label: 'Two groups', fighter: 'proportions' },
      { goal: 'difference', outcome: 'binary', design: 'table', label: 'A larger table', fighter: 'chi-square' },
      { goal: 'difference', outcome: 'ordinal', design: 'two-groups', label: 'Two independent groups', fighter: 'mann-whitney' },
      { goal: 'difference', outcome: 'ordinal', design: 'paired', label: 'Paired measurements', fighter: 'signed-rank' },
      { goal: 'difference', outcome: 'time', fighter: 'log-rank' },
      { goal: 'difference', outcome: 'counts', fighter: 'negative-binomial' },
      { goal: 'difference', outcome: 'cases', fighter: 'vaccine-efficacy' },
    ],
    step(answers = {}) {
      const { goal, outcome, design } = answers;
      if (!this.goals.some(([id]) => id === goal)) return { ask: 'goal', options: this.goals };
      const needsOutcome = !this.noOutcome.includes(goal);
      if (needsOutcome && !this.outcomes.some(([id]) => id === outcome)) return { ask: 'outcome', options: this.outcomes };
      const candidates = this.rules.filter(r => r.goal === goal && (!needsOutcome || r.outcome === outcome));
      if (!candidates.length) return { none: true };
      if (candidates.length === 1 && !candidates[0].design) return { fighter: candidates[0].fighter, rule: candidates[0] };
      const chosen = candidates.find(r => r.design === design);
      if (chosen) return { fighter: chosen.fighter, rule: chosen };
      return { ask: 'design', options: candidates.map(r => [r.design, r.label, '']) };
    },
  };

  // One source for the disclaimer. index.html repeats short and full as static text (keep them equal).
  const disclaimer = {
    short: 'FOR FUN. NO WARRANTY. NOT VALIDATED. NOT ENDORSED BY ANY REGULATOR.',
    full: 'Stat Fighter ’89 is a hobby project made for fun. It comes with no warranty of any kind. It is not validated software, and no regulatory agency, ethics committee or professional body has reviewed or endorsed it. Results depend entirely on the assumptions you enter and on each method’s stated model, and they may be wrong. Do not base a study, a protocol or any decision on it without independent verification by a qualified statistician using validated software.',
    copy: '[Generated by Stat Fighter ’89, a hobby project. No warranty; not validated software; no regulatory endorsement. Verify independently before use.]',
  };
  // App version; tests/content.test.mjs keeps it equal to package.json.
  const version = '1.1.0';
  globalThis.StatFighter.content = { version, worldMap, regions, regionAliases, fighters, cpu, help, disclaimer, lines, matchmaker };
}
