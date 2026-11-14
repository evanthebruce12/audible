# Changelog

All notable changes to Audible. Newest first.

## 1.5.2 — Two fixes
*Nov 14, 2026*

- **Stale colour band on player cards.** A strip of `#f2f2f7`, the light theme's `--bg`, could sit frozen across a card in dark mode. Theme switching only swaps CSS variables, so a layer the compositor had already rasterised kept the old palette. `applyTheme` now forces a reflow on the sheet, chat and app after the switch. The permanent `will-change:transform` on `.sheet` that made the sheet a long-lived layer in the first place went in 1.4.9.
- **Deep passes left the field.** The arc height was `min(60, 18 + dist*.35) * 1.25` for scores, up to 75, against a ball sitting at y=75 in a 150-unit viewBox, so the peak hit y=0 and the ball clipped out the top. Capped at 44 (×1.1 for scores); measured peak is now y=27.

 The tour lets you touch things
*Nov 14, 2026*

- **The spotlight passes touches through.** `.tour` was a full-screen overlay with `touch-action:none`, so it described a feature while making it untouchable. It is now `pointer-events:none`, and four blocker panels positioned around the spotlight swallow taps instead. The highlighted control is the only live part of the screen. Verified: a tap on the highlighted element reaches it, a tap anywhere else does not.
- **Steps finish by doing, not by pressing Next.** Steps marked `act` listen for a real click on the target and advance from that. Next becomes "Skip this", and relabels itself if you hesitate.
- **Opening something pauses the tour.** Tapping a player during the tour opens his card for real; the overlay hides, a watcher waits for the sheet to close, then the tour resumes and advances. Verified end to end.
- **A big-play demo step.** A canned touchdown with real yard lines, rendered on a field inside the tip and looping, so a new user watches a replay rather than reading about one. Works with no live games.

 Big plays
*Nov 14, 2026*

- **Plays are tiered rather than flagged.** `big` was `scored || 20+ yards`, so a 60-yard touchdown and a 21-yard catch rendered identically. `playTier()` now ranks every play: TD, INT, Fumble, Safety, Explosive (40+), Big play (20+), long field goals, big sacks, 4th-down conversions. Each gets its own chip colour, a left rule and a background wash. Nullified plays and missed kicks are correctly excluded. Verified against 16 real ESPN play strings.
- **Touchdowns replay with weight.** Longer duration (capped at 1.75s), a higher arc, a full-brightness ball glow, a white endzone flash, a green TOUCHDOWN plate sized to its text, and Audible switching to his `hyped` face. Turnovers get the same treatment in red.
- **Big plays on NFL game cards.** The game sheet showed only the current drive and scoring plays. It now also lists the highest-rated non-scoring plays of the game, newest first, each replayable on the field.
- **Row markers on My Team and Matchup.** `bigBadge()` reads the week stats already in memory and marks players who scored, hit a 50+ yard field goal, or forced a turnover, so you can tell at a glance who is worth opening. Costs no extra requests.

 Smooth all the way up
*Nov 14, 2026*

- **Sheets no longer catch at the end of the slide.** Frame analysis of a 60fps recording: through the 25-frame slide the frame-to-frame delta decelerates smoothly, then climbs back up twice in the last ~100ms (3.8 → 5.3, and 1.7 → 4.2). A compositor-driven ease-out only ever decreases, so that was main-thread work landing mid-animation: the game log, the news and the week stats each resolving and rebuilding the sheet while it moved. Rebuilds are now held until the slide finishes, released on `transitionend` with a timeout as backstop.
- **`will-change: transform` on `.sheet` was permanent**, keeping every sheet promoted to its own compositing layer for its whole life. That is the same condition that was rasterising the chat header below device resolution in 1.4.6. It is applied only while the sheet is actually moving now.

 Updates in one open, and a ready first run
*Nov 14, 2026*

- **One open per update, not two.** Cache-first serving meant a new build only appeared on the launch after next. The boot animation runs for ~2s regardless, so the page now fetches the live document during it, compares the `VERSION` constant, writes the new copy into the cache and reloads before the splash ever lifts. If the app is already interactive it shows a tap-to-update banner instead.
- **Prefetch during the launch animation.** The first run pulls headshots for both rosters, this week's team logos and league avatars while the animation plays, bounded at 2.6s so it can never hang. The rest of the league's photos warm on idle afterwards. A new user no longer meets a grid of empty circles.
- **Fixed `addAll` precaching.** It rejects as a unit, so a single missing asset left the whole shell cache empty and silently fell back to the network. Each asset is cached independently now.
- **The update check needs a network escape hatch.** `isShell` was intercepting the check itself and serving it from cache, so it compared the old version against itself and never detected anything. Requests carrying `?fresh=` now bypass the worker.

 Photos stop flashing
*Nov 14, 2026*

- **Images are cached on device.** Headshots and team logos from sleepercdn went to the network on every render, and iOS discards decoded image data when an app is backgrounded, so returning from the app switcher blanked every photo. The service worker now serves them cache-first from a dedicated store that survives shell updates.
- **Initials stay until the photo lands.** `.hs:has(img)` turned the initials transparent the moment the element existed rather than when it loaded, leaving an empty circle during the fetch. Now driven by an `.ok` class set on `load`, and pre-applied when the image is already decoded so a re-render has no gap at all.
- **A live `Image()` cache** keeps decoded bitmaps alive across the `innerHTML` replacements that every render performs.
- **The player sheet rebuilds once, not three times.** The game log, news and week stats each arrived separately and each triggered a full rebuild. Coalesced into one frame.
- **Fixed the shell matcher.** `ASSETS` contains `"./"`, which became `""`, and `endsWith("")` is always true, so the shell handler was intercepting every same-origin GET. It matches real filenames now.

 The chat header is sharp
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
