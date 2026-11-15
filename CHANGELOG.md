# Changelog

All notable changes to Audible. Newest first.

## 1.9.4 — A cleaner launch
*Nov 15, 2026*

- **No flash between the launch screen and the splash.** In the iPad recording the screen went from the launch colour (#06080f) to a lighter grey for a frame or two around 0.57s, then back to navy. That grey is the web view painting its default background before the page's styles apply. The first thing in `<head>` is now `color-scheme: dark` and a one-line style that paints `html` navy, so the very first frame matches the launch screen.
- **The splash waits for the first screen's images to be decoded, not just requested.** It used to wait at most 2 seconds for a fixed list, and only for the bytes to arrive. `prewarmScreen()` now waits on every `<img>` in the first screen and a half of the rendered page, plus the critical list, through `decode()`, capped at 4 seconds. Measured with images artificially delayed by 3.5s: the old build revealed the app with 2 of 2 on-screen images still loading; the new one held the splash to 3.8s and revealed with 0 unready. When images arrive within the intro, the hand-off time is unchanged (2.2s).
- **League activity loads before the hand-off** (capped at 1.5s) and its requests are prefetched at launch, since on the two-column layout it is on the first screen. Its headshots are on the critical list.

## 1.9.3 — Tidier iPad and Mac details
*Nov 15, 2026*

- **Edit lineup matches the starters.** On the two-column layout the button sat below both columns, capped at 420px, so it didn't line up with anything. It now ends the starters column and spans it (491px each at 1180 wide). On a phone it stays below the bench.
- **Week arrows hug the week.** The Matchup week row stretched across the full page on wide screens, pushing the arrows hundreds of pixels apart. From 760px wide they sit either side of the label. The phone layout is unchanged.

## 1.9.2 — Cleaner big screens, clearer weeks
*Nov 15, 2026*

- **Every week picker says what week it is.** A `wkCtl()` control replaces three hand-built pickers: the week number plus a tag (Live, This week, Final, Upcoming), and a "Back to week N" link whenever you are off the current week. On the Matchup tab the update time sits under it.
- **League headers line up.** On the two-column layout the week picker sat between the Scores heading and its card, so Scores started lower than Standings. It now lives in the Scores heading, section headings in both columns share a 32px row, and both cards share a 12px top margin. Measured: both headings at the same y, both cards at the same y.
- **Columns end closer together.** On Today the side column (NFL slate plus league activity) ran far longer than the main one, leaving a blank area under the matchup. Activity and the trade button now sit under the matchup on the two-column layout. The League tab shows the latest six transactions with Show all.
- Buttons inside a column now span it.

## 1.9.1 — Only players who can play count
*Nov 15, 2026*

- **Game cards skip ruled-out players.** The blue "of your players" count included anyone on your roster from either team, so a starter listed Out or a player on IR still counted. A `sidelined()` check now leaves out Out, IR, PUP, Suspended, NA, DNR and COV statuses and anyone in a roster's reserve slots. Doubtful and Questionable still count, since they might play.
- **On the field includes the bench.** It only looked at starters, so a bench player in a live game never appeared. Bench players in live games now show under the starters, marked BN, with ruled-out players left off.
- **The game sheet lists ruled-out players last**, below the ones who are playing.

## 1.9 — Audible for iPad and Mac
*Nov 15, 2026*

One file, three shapes. Under 760px it is the phone app, pixel for pixel: a before-and-after comparison of all five tabs at 390px shows no difference.

- **From 760px (iPad portrait)** the tab bar becomes a rail down the left, sheets become a panel on the right, and the chat becomes a panel that closes when you tap outside it.
- **From 1100px (iPad landscape, Mac)** the rail opens into a sidebar with the league switcher and an Ask Audible button, and every section lays out in two columns: briefing beside the NFL slate and league activity, the matchup beside lineup check and the other scores, starters beside bench, players beside news, standings beside scores and activity.
- **The chat docks.** On the widest layout it sits beside the app and nothing is locked or made inert, so both stay usable. The page gives up the width instead of being covered, and drops to one column while it is docked on mid-size screens.
- **Views are built as main and side.** A `dash(main, side)` helper wraps the two halves. On a phone the wrappers are plain blocks in the original order, so nothing moves. `sideFirst` keeps the phone order where the side column belongs on top.
- **Keyboard.** 1 to 5 switch sections, Command-K toggles the chat, slash searches players, the bracket keys change weeks, R refreshes, Escape goes back a page then closes the panel, ? lists the shortcuts. Return sends a message on a hover-capable pointer; Shift-Return makes a new line.
- **Pointer.** Hover states, a pointer cursor, focus rings, styled scrollbars, and selectable text in chat and articles, all behind `(hover:hover) and (pointer:fine)` so touch devices are unaffected.
- **Gestures that only make sense on a phone are off on big screens:** the sliding lens on the tab bar and drag-to-dismiss on sheets.
- **Crossing a breakpoint redraws**, so rotating an iPad or resizing a Mac window swaps layouts cleanly.
- **The tour points at the sidebar** on big screens instead of the tab bar and floating button.
- **iPad launch screens** for nine iPad sizes in both orientations.
- **Install wording follows the device:** Add to Home Screen on iPad, Add to Dock on Mac.

## 1.8.1 — Chat header, rebuilt so it can't go missing
*Nov 15, 2026*

- **The header is the first row of the chat panel again.** It had been a separate fixed layer since 1.4.6, moved out to dodge a blur that turned out to be iOS's. Two fixed layers can be moved apart, and the keyboard was doing exactly that. One box cannot come apart.
- **The page behind is pinned** while the chat is open (`body` fixed at its scroll offset, restored on close), so iOS has nothing to scroll when it brings the text box into view.
- **Keyboard detection no longer trusts `innerHeight`.** Some iOS versions shrink the layout viewport with the keyboard and some only the visual one. It is judged against the tallest the screen has been since the chat opened, which also removes the gap that sat between the text box and the keyboard.
- **Nothing shows through above the keyboard.** The iOS 26 keyboard is translucent, and a strip of the Today tab was visible between the chat and the keyboard. The panel now paints a 100vh spread around itself once it has finished sliding up.
- **A stale pan is released.** If the view is still offset after the keyboard closes, it is scrolled back and re-measured.

## 1.8 — The blur, found. Plus a rebuilt field.
*Nov 15, 2026*

**The blur at the top of the screen**

- **It was never ours.** Since iOS 26.1, a Home Screen web app installed with `apple-mobile-web-app-status-bar-style=black-translucent` gets a system scroll-edge blur and a dark scrim over the top of the page. The page cannot turn it off, and an opaque header underneath does not stop it. Every earlier fix here (dropping `backdrop-filter`, un-promoting layers, moving the chat header out of its transformed panel) removed a real softness of our own, which is why each one helped a little and none of them ended it.
- **The tag is gone.** Without it iOS draws a solid status bar above the page, tinted by `theme-color`, and nothing sits under it to blur. `theme-color` now follows whatever is directly beneath the bar: splash, chat header, or page.
- **Existing installs need one re-add.** iOS reads the status bar style only when the icon is added. Settings > About > *Sharpen the top bar* appears on installs that still have the old style (detected as a non-zero top safe-area inset while standalone) and walks through backup, remove, re-add, restore.

**Chat**

- **Done and Clear no longer disappear.** The header became a sibling of the chat panel in 1.4.6, but only the panel was being moved to `visualViewport.offsetTop`. When the keyboard opened, iOS panned the viewport and the header stayed at the layout top, under the clock or off screen. iOS 26 also does not always pan back after the keyboard closes. The header now moves with the panel and is re-measured around focus changes.
- **Answers that ran out of room are retried.** A reply that hit `max_tokens` with no text (the whole allowance spent on reasoning) is asked again with 24,000 tokens and reasoning off before any error is shown. Default caps raised from 4,096 to 6,000 (Quick) and 8,192 (Balanced).

**Sheets**

- **A navigation stack.** Opening a page while a sheet is up pushes it with a slide; Back, or a swipe from the left edge, pops it; Done closes everything. A covered page keeps its real DOM, handlers and scroll position, so returning to a game does not rebuild or refetch it. The article reader's own "Back to player" button is replaced by this.
- **Late content eases in.** Play-by-play, game logs and news that arrive after the sheet is up fade up instead of popping. Numbers are left out of the comparison so a live stat ticking over is not treated as new content.

**Launch**

- **The player list never blocks a launch twice.** It was re-downloaded in front of the splash whenever the saved copy was over 12 hours old, which is every morning. A saved copy of any age is used at once and refreshed in the background.
- **Requests go out together.** Season state, league list, league, rosters, users, matchups, scoreboard and projections were a chain. They are now all requested when the script starts, predicted from the previous launch, and the chain just collects them. With 700ms per request, a returning launch went from about 5.6s to 2.4s, which is the length of the intro.
- **A working state.** If the app is not ready when the intro ends, Audible scans and blinks, the headset light pulses, and a bar tracks the real steps of the load.

**The field**

- **It fills its card.** `svg.field` shared a class name with the sign-in text box and had been inheriting 15px of padding and a background.
- **Surface.** Alternating five-yard mowing bands, hash marks and sideline ticks every yard, pylons, a contact shadow, yard numbers painted in the plane on both sides with the line running between the digits.
- **Team names** in the endzones instead of abbreviations, with the lettering colour chosen from the paint. A black primary falls back to the alternate colour.
- **The endzone angle was still two degrees off.** Matrix terms were rounded to one decimal. They carry three now.
- **Plays are read from the sentence.** Left, right or middle; short or deep; caught, dropped or picked; wide, short, blocked or off the upright. A completion is thrown to its side, caught, then run.
- **The ball has a shadow** that stays on the turf and shrinks as it climbs.
- **The gain is painted on the field** in team colour from the line of scrimmage, red for a loss.
- **Missed field goals animate.** So do punts, kickoffs, sacks, incompletions, interceptions and fumbles, each with its own plate. First downs are called.
- **New touchdown graphic.** Team colour, moving stripes, the word, the team, quarter and clock.
- **Replays cancel cleanly.** Starting one while another was running left two animation loops fighting over the ball.

## 1.7.2 — Endzone type and posts, measured
*Nov 14, 2026*

- **The lean is gone.** The old lettering was placed with a frame built from the field's two axes, which are 13.4 degrees off square at the endzones, so every letter was sheared like a bad italic. Worse, the shear flips sign between the two ends, so one endzone's type leaned with its slab and the other leaned against it. The frame is now orthonormal and built from the endzone's own edge: the baseline runs exactly parallel to that edge and the letters stand square to it.
- **The two ends are a 180 degree pair.** Each endzone reads toward its own endline, the way they are actually painted, instead of both facing the same way.
- **Glyphs are never stretched.** `lengthAdjust="spacingAndGlyphs"` was squashing the type sideways to hit a target width, which is what made the strokes look thick and soft. Type is now sized to the band and spaced out to fill the width, so the strokes stay the weight the typeface drew them. Weight dropped from 900 to 800. Long names shrink to fit instead of overflowing.
- **Centred on the right point.** The type was anchored at `FP(a, .5)`, which the perspective curve puts 5.7 units off the real screen midpoint between the two sidelines, so the paint sat low and clipped the endline. It now centres on the true midpoint, and fits inside the tighter of each pair of converging band edges.
- **Uprights are dead vertical.** They were splayed outward by hand, which is wrong: a camera at eye level keeps vertical lines vertical. Both uprights are now plumb and the same height.
- **The posts are round.** Every member is drawn as three strokes, shadow and body and highlight, off one light from the upper left, so the pipes read as pipes. The base is a tapered grey cylinder with an elliptical cap and a contact shadow.
- **Showcase page had two `fPost` definitions**, so it had been rendering a different goalpost from the app since 1.7. Deduped and resynced to the app's code.

## 1.6.2 — The field has the right shape
*Nov 14, 2026*

- **Retuned against the real thing.** Measured ESPN's drive graphic from a screen recording: far width / near width = 0.91, depth / near width = 0.17. The 1.6 field used 0.47 and 0.28, which is why it read as impossibly deep and stretched, with the goalposts appearing to sit near the 10. Now 144/158 half-widths over a 54-unit depth, with the perspective parameter dropped from 1.1 to 0.35 and the depth scale narrowed to 0.72–1.0. The canvas is 360×108 instead of 360×150.
- **Goalposts stand beyond each endline** at a = −0.045 and 1.045, taller and thinner, rather than planted on the goal line inside the field.
- **Endzone wordmarks are back in the endzones**, rotated 90° so they fit the narrow slanted shape, as ESPN draws them and as a real field is painted. They had been moved above the field in 1.6 because horizontal text spilled past the edges of a hard-tapered endzone; a gentle taper makes the rotated form fit.

 Field goals actually kick
*Nov 14, 2026*

- **A field goal replayed as nothing.** `pl.s` and `pl.e` are the same yard line on a kick, so the ball had nowhere to travel and the animation sat still. `animPlay` now detects the `fg` tier, retargets the end point to the uprights, adds a terminal lift so the ball finishes level with the crossbar instead of dropping back to the turf, spins it faster, and labels it in blue with the distance.

## 1.6 — The field in 3D
*Nov 14, 2026*

- **The field is projected, not flat.** One function, `FP(a, c)`, maps along-field and across-field coordinates to screen space through a perspective parameter, and everything else derives from it: the turf, the ten-yard bands, the endzones, the yard lines, the sidelines, the numbers, the red zone, the goalposts, the ball, the trail, the line of scrimmage and the first-down marker. Nothing can drift out of register because nothing has its own geometry.
- **Goalposts** stand at the back of each endzone with a ground shadow and a darker base stem, scaled by depth and leaning very slightly inward.
- **The ball travels on the ground plane.** It is positioned by projecting the interpolated yard line each frame rather than sliding along a fixed centre line, so it tracks the slope of the field and scales with distance. The arc is a lift measured off that projected ground position.
- **Yard markers lie on the grass.** `.los` and `.fdl` were vertical bars; they are now lines drawn sideline to sideline in perspective.
- Team abbreviations moved out of the endzones, which are now slanted parallelograms where horizontal text spills past the edges, and sit above the field where they stay legible.

 Two fixes
*Nov 14, 2026*

- **Stale colour band on player cards.** A strip of `#f2f2f7`, the light theme's `--bg`, could sit frozen across a card in dark mode. Theme switching only swaps CSS variables, so a layer the compositor had already rasterised kept the old palette. `applyTheme` now forces a reflow on the sheet, chat and app after the switch. The permanent `will-change:transform` on `.sheet` that made the sheet a long-lived layer in the first place went in 1.4.9.
- **Deep passes left the field.** The arc height was `min(60, 18 + dist*.35) * 1.25` for scores, up to 75, against a ball sitting at y=75 in a 150-unit viewBox, so the peak hit y=0 and the ball clipped out the top. Capped at 44 (×1.1 for scores); measured peak is now y=27.

## 1.5.1 — The tour lets you touch things
*Nov 14, 2026*

- **The spotlight passes touches through.** `.tour` was a full-screen overlay with `touch-action:none`, so it described a feature while making it untouchable. It is now `pointer-events:none`, and four blocker panels positioned around the spotlight swallow taps instead. The highlighted control is the only live part of the screen. Verified: a tap on the highlighted element reaches it, a tap anywhere else does not.
- **Steps finish by doing, not by pressing Next.** Steps marked `act` listen for a real click on the target and advance from that. Next becomes "Skip this", and relabels itself if you hesitate.
- **Opening something pauses the tour.** Tapping a player during the tour opens his card for real; the overlay hides, a watcher waits for the sheet to close, then the tour resumes and advances. Verified end to end.
- **A big-play demo step.** A canned touchdown with real yard lines, rendered on a field inside the tip and looping, so a new user watches a replay rather than reading about one. Works with no live games.

## 1.5 — Big plays
*Nov 14, 2026*

- **Plays are tiered rather than flagged.** `big` was `scored || 20+ yards`, so a 60-yard touchdown and a 21-yard catch rendered identically. `playTier()` now ranks every play: TD, INT, Fumble, Safety, Explosive (40+), Big play (20+), long field goals, big sacks, 4th-down conversions. Each gets its own chip colour, a left rule and a background wash. Nullified plays and missed kicks are correctly excluded. Verified against 16 real ESPN play strings.
- **Touchdowns replay with weight.** Longer duration (capped at 1.75s), a higher arc, a full-brightness ball glow, a white endzone flash, a green TOUCHDOWN plate sized to its text, and Audible switching to his `hyped` face. Turnovers get the same treatment in red.
- **Big plays on NFL game cards.** The game sheet showed only the current drive and scoring plays. It now also lists the highest-rated non-scoring plays of the game, newest first, each replayable on the field.
- **Row markers on My Team and Matchup.** `bigBadge()` reads the week stats already in memory and marks players who scored, hit a 50+ yard field goal, or forced a turnover, so you can tell at a glance who is worth opening. Costs no extra requests.

## 1.4.9 — Smooth all the way up
*Nov 14, 2026*

- **Sheets no longer catch at the end of the slide.** Frame analysis of a 60fps recording: through the 25-frame slide the frame-to-frame delta decelerates smoothly, then climbs back up twice in the last ~100ms (3.8 → 5.3, and 1.7 → 4.2). A compositor-driven ease-out only ever decreases, so that was main-thread work landing mid-animation: the game log, the news and the week stats each resolving and rebuilding the sheet while it moved. Rebuilds are now held until the slide finishes, released on `transitionend` with a timeout as backstop.
- **`will-change: transform` on `.sheet` was permanent**, keeping every sheet promoted to its own compositing layer for its whole life. That is the same condition that was rasterising the chat header below device resolution in 1.4.6. It is applied only while the sheet is actually moving now.

## 1.4.8 — Updates in one open, and a ready first run
*Nov 14, 2026*

- **One open per update, not two.** Cache-first serving meant a new build only appeared on the launch after next. The boot animation runs for ~2s regardless, so the page now fetches the live document during it, compares the `VERSION` constant, writes the new copy into the cache and reloads before the splash ever lifts. If the app is already interactive it shows a tap-to-update banner instead.
- **Prefetch during the launch animation.** The first run pulls headshots for both rosters, this week's team logos and league avatars while the animation plays, bounded at 2.6s so it can never hang. The rest of the league's photos warm on idle afterwards. A new user no longer meets a grid of empty circles.
- **Fixed `addAll` precaching.** It rejects as a unit, so a single missing asset left the whole shell cache empty and silently fell back to the network. Each asset is cached independently now.
- **The update check needs a network escape hatch.** `isShell` was intercepting the check itself and serving it from cache, so it compared the old version against itself and never detected anything. Requests carrying `?fresh=` now bypass the worker.

## 1.4.7 — Photos stop flashing
*Nov 14, 2026*

- **Images are cached on device.** Headshots and team logos from sleepercdn went to the network on every render, and iOS discards decoded image data when an app is backgrounded, so returning from the app switcher blanked every photo. The service worker now serves them cache-first from a dedicated store that survives shell updates.
- **Initials stay until the photo lands.** `.hs:has(img)` turned the initials transparent the moment the element existed rather than when it loaded, leaving an empty circle during the fetch. Now driven by an `.ok` class set on `load`, and pre-applied when the image is already decoded so a re-render has no gap at all.
- **A live `Image()` cache** keeps decoded bitmaps alive across the `innerHTML` replacements that every render performs.
- **The player sheet rebuilds once, not three times.** The game log, news and week stats each arrived separately and each triggered a full rebuild. Coalesced into one frame.
- **Fixed the shell matcher.** `ASSETS` contains `"./"`, which became `""`, and `endsWith("")` is always true, so the shell handler was intercepting every same-origin GET. It matches real filenames now.

## 1.4.6 — The chat header is sharp
*Nov 14, 2026*

- **Measured, then fixed.** On a native PNG screenshot, text in the chat header had a 20-80% edge width of 5 device px while body text 300px below it measured 1px, on the same screen at the same moment. `.chat` slides in on a `transform`, which promotes the whole panel to a compositing layer; `#chLog` scrolls so it kept repainting at device resolution, but the static header kept whatever scale the layer was rasterised at. The header is now a sibling of the panel rather than a child, fixed to the top and fading in, so it is never inside a transformed layer.

## 1.4.5 — Nothing blurry at the top
*Nov 14, 2026*

- **The top of the screen is sharp.** Measured on a device screenshot, text in the chat header had a 20-80% edge width of 6 device pixels where sharp text at 3x is 1-2, so it was genuinely being rasterised below device resolution. Anything at the top of the screen that forced a compositing layer is gone: `translateZ(0)` and `isolation` on the chat header (added in 1.4.2 trying to fix this and making it worse), and the `backdrop-filter` on the top bar. The bar is now an opaque colour rather than frosted glass. The floating tab bar at the bottom keeps its glass.

## 1.4.4 — No more blink on open
*Nov 14, 2026*

- **The blink after launch is gone.** Today appeared, went dark, then faded back in. Two fades ran at the handoff: the boot screen's is a CSS transition on opacity, which runs on the compositor and finished on time, while the app's fade-in is a CSS animation over the whole rendered page and needed a main-thread style recalc first. So the boot screen revealed Today, and a few frames later the app's animation snapped it to invisible and faded it back. Today is already rendered underneath an opaque boot screen, so it never needed its own fade. The boot screen now dissolves on its own.

## 1.4.3 — One clean entrance
*Nov 14, 2026*

- **No more double image on open.** iOS shows a static launch image while the page loads, and the app then draws its own copy of Audible. Two separate renderings of the same thing meant any mismatch between them appeared as a second head flickering during the handoff. The launch images are now plain dark, and Audible fades in as the animation's first beat, so there is nothing to collide with.
- **The animation waits until the app is ready.** It previously began the moment the stylesheet parsed, which is before the 200KB script runs. SVG transforms are not composited in Safari, so it ticked on the main thread while the parse blocked painting, then snapped forward. It now starts on a frame where the main thread is free.

## 1.4.2 — Opens in a blink
*Nov 14, 2026*

- **Much faster launch.** The service worker had no fetch handler, so every single open pulled the whole 263KB app over the network before anything could paint. On a phone that left the static launch image frozen for close to two seconds. The app shell is now cached, and first paint went from 216ms to 52ms in testing.
- **Works offline.** The app opens with no connection. Live scores still need the network.
- **Update notice.** Because the shell is served from cache, a new build would otherwise land silently. You now get a tap-to-reload banner when one is ready.
- **Sharper chat header.** The top bar's frosted layer was still being composited behind the chat, softening Done, Audible and Clear. Blur is switched off beneath any full-screen overlay.

## 1.4.1 — A new look, and a proper entrance
*Nov 14, 2026*

- **Audible got a redesign.** A graphite helmet with a lit visor, in place of the white dome. No smile: the eyes carry the expression now. He is sharper at every size, and the same face runs through the app, the icon, and your Home Screen.
- **A real launch animation.** Open the app and the headset builds itself on the way down, the band unfurling and the ear cups telescoping out, then it slams on and he powers up with a stutter and a sweep of light across the visor. The static launch image is the animation's first frame, so there is no jump between them.
- **Crisper top of screen.** The blur behind the header used to exist even while invisible, which smudged your profile picture. It now only exists once the header is actually showing.
- **Swipe a message away.** Flick a banner upward or tap it to dismiss, instead of waiting out the timer.
- **He reacts to good news, not just touchdowns.** Big plays, taking the lead, pulling away, and winning your week. A passing touchdown counts now too, which it did not before.
- **Always opens to Today.** The start screen setting is gone.

## 1.4 — Made to share
*Nov 14, 2026*

- **Your menu.** Tap your picture in the top left to switch leagues, refresh, open settings, or set up Audible AI.
- **League switcher.** In more than one league? See them all with your record in each, and switch with one tap.
- **Pull to refresh.** Pull down on any screen to update scores.
- **Guided tour.** New here? Audible walks you through the app. Replay it anytime from the menu.
- **A free Audible.** Ask Audible about your lineup, matchup, waivers, playoff odds or any player with no key at all. He answers from your real league numbers.
- **Audible AI your way.** Pick how hard Audible thinks (Auto, Quick, Balanced, Deep) and how long his answers run. Deep thinks a question all the way through and checks the latest news.
- **No surprise bills.** See what you've spent on AI this month and set a monthly limit.
- **Easier setup.** A friendlier welcome, a league picker, and a 4-step guide to getting your own Claude API key.

## 1.3.2 — Feels more like iPhone
*Nov 13, 2026*

- **Titles that tuck away.** Big page titles shrink into the top bar as you scroll, and stretch a little when you pull down.
- **Swipeable cards.** Player and game cards follow your finger. Pull down to half height, flick to close, or push back up to full.
- **Liquid Glass tab bar.** The tab bar floats as a glass capsule with a lens that glides to the tab you pick. Hold and slide to drag it: it stretches as it moves and tabs light up as it passes over them. The top buttons are glass too, and the top bar frosts in as you scroll.
- **Springy motion.** Buttons press and bounce back, tab icons pop, and toggles like Standings / Scores / Activity slide between options.
- **Cleaner chat.** The message box is one compact bubble that sits right on top of the keyboard, with no gap or page peeking through underneath.
- **Fixes.** Game cards line up with the rest of the page, the Refresh and Settings buttons are crisper, and stray initials no longer peek out behind player photos.
- **Richer game cards.** Tap any NFL game for team colors, the score by quarter, win odds, game leaders, and a side-by-side team stats comparison.
- **Matchup upgrades.** The Matchup tab has a football field icon, and win probability now plays out on a little football field: your territory is green turf, theirs is blue, with matching rings on each team's picture. Every starter shows his team, opponent and kickoff time on their own lines, and a blue dot flags news you haven't seen yet, on Matchup and My Team.
- **News you can read in the app.** Tap any headline to read the full story right in Audible, with no jump to another app and no dead links. A Back button returns you to the player you were on.
- **Cleaner numbers.** Trending adds read short, like 734.1K.
- **Deeper player cards.** Tap any player for Audible's quick take, position rank, hot or cold streak, full season stats, a game log with best and typical weeks, recent news, and a profile with depth chart spot.
- **Steadier screens.** The page behind a card or chat no longer scrolls when you touch an empty spot.
- **A smarter Audible.** Audible now reads the latest NFL news and depth charts, every team's roster with real numbers, last-3-weeks form, your remaining schedule, playoff rules and FAAB. Big questions like trades and playoff odds get a deeper answer from a stronger model.
- **Haptic taps.** A light tap when you switch tabs, toggle options, refresh, or swipe a card closed.
- **No more blank replies.** Audible has more room to think, so bigger questions get a full answer instead of "No answer came back."
- **Backup plan.** If a reply still comes back empty, Audible quietly asks again, and tells you why if it can't answer.

## 1.3.1 — Cleaner buttons
*Nov 13, 2026*

- **Refresh and Settings buttons.** Bigger, with a solid background and crisp white icons so they're easier to see and tap.
- **Audible button tucks away.** It slides out of the way while you scroll down so it never covers scores, and comes back when you scroll up.

## 1.3 — Meet Audible
*Nov 13, 2026*

- **New name, new face.** Gameday is now Audible, with a new app icon and a coach-in-a-headset mascot with an LED face.
- **Audible has moods.** He blinks, thinks with a head tilt while writing, hops on big plays, shakes his head when your lineup needs a fix, and sleeps late at night.
- **Notifications.** Lineup alerts, a Saturday night check, lead changes, close games, final results, waivers, trades, and a Tuesday briefing. Turn them on in Settings.
- **Quiet hours.** Nothing from 10pm to 8am except live game alerts. Adjustable.
- **Backup with a PIN.** Your settings, API key, league, and chats are saved. If your phone ever loses them, sign in and enter your PIN to restore.
- **Tap to jump.** Tapping a notification opens the right screen.

## 1.2 — Audible chat, My Team, and the game tracker
*Nov 13, 2026*

- **Chat with Audible.** Tap the sparkle button anywhere to ask about lineups, waivers, trades, or any player. Answers stream in live.
- **My Team.** A Sleeper-style roster view with starters, bench, IR, game times, and status flags.
- **Game tracker.** A live field on every player card. Tap any of his plays to replay it, with yards and fantasy points per play.
- **Full game view.** Tap any NFL game on Today for the field, current drive, and scoring plays.
- **Live box scores.** Passing, rushing, receiving, kicking, and defense stats, plus a scoring breakdown in your league's settings.
- **Smoother feel.** Screens slide in, buttons press, and cards swipe down to close.
- **Model setting.** Pick Haiku (cheapest) or Sonnet (smarter) for Audible.

## 1.1 — The Apple-style rebuild
*Nov 13, 2026*

- **New design.** Inspired by Apple Sports, with five tabs and light and dark mode.
- **Audible briefing.** A weekly rundown: lineup problems, byes, start/sit upgrades, win odds, and waiver targets.
- **Projections and win probability.** See projected scores and your chance to win.
- **NFL games, odds, and news.** Live scores, betting lines, and ESPN news filtered to your players.
- **League activity.** Trades, waiver claims, and adds/drops.
- **Settings.** Appearance, auto-refresh, animations, and your Claude API key.

## 1.0 — First release
*Nov 13, 2026*

- **Live matchup.** Your score against your opponent, refreshed every 30 seconds, with a pop-up when your players score.
- **Lineup check.** Flags empty slots and injured starters, and suggests bench swaps.
- **Waivers and standings.** Trending pickups available in your league, plus standings.
