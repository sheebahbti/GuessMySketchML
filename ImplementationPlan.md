# Implementation Plan — GuessMySketch ML 🎨🤖

A step-by-step guide to building the browser-based "draw → AI guesses" game.
Each phase is small, testable, and builds on the previous one. Check off steps as you go.

---

## Overview

```
Phase 1  Project setup        →  empty page loads in browser        (~30 min)
Phase 2  Drawing canvas       →  kid can draw with mouse/touch       (~1 hr)
Phase 3  Load the AI model    →  DoodleNet loads and is ready        (~45 min)
Phase 4  Connect draw → AI    →  AI guesses the drawing              (~1 hr)
Phase 5  Show the guess       →  friendly result + confidence        (~1 hr)
Phase 6  Polish & kid-proof   →  clear button, colors, big text      (~2 hrs)
Phase 7  Deploy               →  share with a single link            (~30 min)
```

**Guiding rule:** finish and test one phase before starting the next.

---

## Time Estimates

Estimates assume a **beginner following along** and include time to test each phase.
An experienced developer could finish much faster.

| Phase | What you build | Estimate |
|---|---|---|
| 1 | Project setup | ~30 min |
| 2 | Drawing canvas | ~1 hr |
| 3 | Load the AI model | ~45 min |
| 4 | Connect drawing → AI | ~1 hr |
| 5 | Show the guess on screen | ~1 hr |
| 6 | Polish & kid-proofing | ~2 hrs |
| 7 | Deploy | ~30 min |
| **Total (core game)** | **Phases 1–7** | **~6–7 hrs** |
| Stretch goals (optional) | scoring, challenge mode, etc. | +2–4 hrs |

**Realistic schedule:** roughly **1–2 focused days**, or a handful of evenings if
building a little at a time. Phase 6 (polish) is the most flexible — you can spend
as little or as much time there as you like.

---

## Phase 1 — Project Setup

⏱ **Estimate:** ~30 min

Goal: a page that opens in the browser and shows "Hello".

- [ ] Create the file structure:
  ```
  GuessMySketchML/
    index.html      ← the page
    style.css       ← how it looks
    sketch.js       ← the game code (p5.js)
  ```
- [ ] In `index.html`, add the p5.js and ml5.js libraries via CDN `<script>` tags.
- [ ] Link `style.css` and `sketch.js` from `index.html`.
- [ ] Add a title and a placeholder heading ("Draw something!").
- [ ] Open `index.html` in a browser to confirm it loads.

**Done when:** the page opens with no errors in the browser console (F12).

---

## Phase 2 — Drawing Canvas

⏱ **Estimate:** ~1 hr

Goal: a white box the kid can draw on.

- [ ] In `sketch.js`, create a p5.js `setup()` that makes a square canvas (e.g. 400×400).
- [ ] Give the canvas a white background.
- [ ] In `draw()` or `mouseDragged()`, draw a thick black line that follows the mouse.
- [ ] Make the brush thick (e.g. `strokeWeight(12)`) so doodles are bold.
- [ ] Test: you can draw a cat/house/tree with the mouse.

**Done when:** you can draw freely on the canvas and it looks like a doodle.

---

## Phase 3 — Load the AI Model (DoodleNet)

⏱ **Estimate:** ~45 min

Goal: the DoodleNet classifier is loaded and ready.

- [ ] In `setup()`, load the model: `ml5.imageClassifier('DoodleNet', modelReady)`.
- [ ] Add a `modelReady()` callback that logs "Model loaded!" and updates the heading.
- [ ] Show a "Loading AI…" message until the model is ready.
- [ ] Test: the "Model loaded!" message appears after a moment.

**Done when:** the console shows the model loaded and no errors appear.

---

## Phase 4 — Connect Drawing → AI

⏱ **Estimate:** ~1 hr

Goal: the AI looks at the canvas and produces a guess.

- [ ] Add a function `guess()` that calls `classifier.classify(canvas, gotResult)`.
- [ ] Add a `gotResult(error, results)` callback that stores the top guess.
- [ ] Call `guess()` on a timer (e.g. every second) or when drawing stops.
- [ ] `console.log` the top result to confirm it works.

**Done when:** drawing a shape prints a sensible guess (label + confidence) to the console.

---

## Phase 5 — Show the Guess On Screen

⏱ **Estimate:** ~1 hr

Goal: the kid sees the AI's guess in friendly language.

- [ ] Display the top guess as big text: `"I think it's a CAT! 🐱"`.
- [ ] Convert the confidence to a percentage: `"91% sure"`.
- [ ] Update the text live as the drawing changes.
- [ ] (Optional) Show the top 3 guesses in a small list.

**Done when:** the on-screen text updates with the AI's best guess as you draw.

---

## Phase 6 — Polish & Kid-Proofing

⏱ **Estimate:** ~2 hrs

Goal: make it fun, colorful, and easy for kids.

- [ ] Add a big **"Clear / Try Again"** button that wipes the canvas.
- [ ] Use large, playful fonts and bright colors in `style.css`.
- [ ] Add **touch support** so it works on tablets (p5 touch events).
- [ ] Add simple encouragement text ("Nice drawing!", "Draw a tree!").
- [ ] Make sure the layout fits on a phone/tablet screen (responsive).
- [ ] (Optional) Add a fun sound or emoji when the AI guesses.

**Done when:** a kid can draw, see a guess, and press Clear to start over — on both mouse and touch.

---

## Phase 7 — Deploy (Share It)

⏱ **Estimate:** ~30 min

Goal: anyone can play from a single link.

- [ ] Push the project to a GitHub repository.
- [ ] Enable **GitHub Pages** (or drag the folder into **Netlify**).
- [ ] Open the public link and confirm the game works online.
- [ ] Share the link! 🎉

**Done when:** the game runs from a public URL on someone else's device.

---

## Suggested Build Order (Quick Checklist)

1. [ ] Files + libraries load (Phase 1)
2. [ ] Can draw on canvas (Phase 2)
3. [ ] Model loads (Phase 3)
4. [ ] AI guesses in console (Phase 4)
5. [ ] Guess shows on screen (Phase 5)
6. [ ] Clear button + colors + touch (Phase 6)
7. [ ] Live online (Phase 7)

---

## Tips & Gotchas

- **Draw big and centered** — DoodleNet expects doodles that fill the canvas, like Quick, Draw!.
- **White background, black brush** — matches the data the model was trained on; other colors hurt accuracy.
- **Don't classify every frame** — run the guess on a timer (once per second) to keep it smooth.
- **First load is slow** — the model downloads once; show a loading message so kids aren't confused.
- **Test in the browser console (F12)** early and often to catch errors.

---

## Stretch Goals (After It Works)

- [ ] Keep score: "You've stumped the AI 3 times!"
- [ ] A "challenge" mode: the game asks the kid to draw a specific thing.
- [ ] Show a fun emoji/picture matching the AI's guess.
- [ ] Save favorite drawings as images.
