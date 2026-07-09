# System Design — GuessMySketch ML 🎨🤖

This document describes the tools, technologies, and architecture used to build the
browser-based "draw → AI guesses" game.

---

## 1. High-Level Summary

GuessMySketch ML is a **100% client-side web app** — there is no backend server, no
database, and no accounts. Everything runs inside the browser: the drawing canvas, the
machine learning model, and the guessing logic. The only "server" involved is a static
host (GitHub Pages / Netlify) that serves the HTML, CSS, and JS files.

```
Everything runs in the browser  →  no backend, no database, no login
```

---

## 2. Tools & Technologies

| Layer | Tool / Technology | Role in the Project |
|---|---|---|
| **Drawing** | [p5.js](https://p5js.org) | Creates the canvas and captures mouse/touch strokes |
| **Machine Learning** | [ml5.js](https://ml5js.org) | Friendly wrapper that loads and runs the model |
| **ML Model** | **DoodleNet** (pre-trained) | Neural network that classifies doodles into 345 categories |
| **ML Engine** | [TensorFlow.js](https://www.tensorflow.org/js) | Runs the model in the browser (used under the hood by ml5.js) |
| **Structure** | HTML5 | The page and the `<canvas>` element |
| **Styling** | CSS3 | Colors, layout, big kid-friendly fonts, responsive design |
| **Logic** | JavaScript (ES6) | Game flow: draw → classify → show guess → clear |
| **Libraries delivery** | CDN `<script>` tags | Loads p5.js and ml5.js — no build tools or npm needed |
| **Version control** | Git + GitHub | Source code storage and history |
| **Hosting** | GitHub Pages / Netlify | Free static hosting, shareable public link |
| **Dev tools** | VS Code + browser DevTools (F12) | Editing code and debugging in the console |

**Notes:**
- No build step (no Webpack/Vite), no package manager required — libraries load from a CDN.
- TensorFlow.js is included automatically by ml5.js; you don't call it directly.

### Why a CDN?

We load p5.js and ml5.js from a **CDN (Content Delivery Network)** with simple `<script>`
tags instead of installing them locally. Reasons:

- **No install / no build tools** — no npm, no bundler; just add a tag and open the HTML.
- **Tiny project** — the libraries live on the CDN, not in our repo.
- **Fast for users** — CDNs serve files from a server near each visitor.
- **Caching** — browsers can reuse cached copies already downloaded from other sites.
- **Reliable** — big CDNs (jsDelivr, unpkg) are highly available and maintained.

Trade-offs: it needs an **internet connection** (not fully offline) and depends on the CDN
being up, so we **pin a version** (e.g. `p5@1.9.0`) to avoid unexpected changes. The
DoodleNet **model** is also fetched over the network for the same reasons.

---

## 3. Block Diagram — System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                               │
│                                                                        │
│   ┌────────────────┐          ┌─────────────────────────────────┐     │
│   │   Kid (User)   │          │        style.css (CSS3)         │     │
│   │  mouse / touch │          │  colors • fonts • responsive    │     │
│   └───────┬────────┘          └─────────────────────────────────┘     │
│           │ draws                                                      │
│           ▼                                                            │
│   ┌────────────────────┐        ┌────────────────────────────────┐    │
│   │   Drawing Canvas   │        │        index.html (HTML5)      │    │
│   │      (p5.js)       │◄───────┤   loads scripts + <canvas>     │    │
│   │  captures strokes  │        └────────────────────────────────┘    │
│   └─────────┬──────────┘                                              │
│             │ pixels of the drawing                                   │
│             ▼                                                          │
│   ┌────────────────────┐        ┌────────────────────────────────┐    │
│   │   sketch.js (JS)   │        │            ml5.js              │    │
│   │  game logic:       │───────►│   imageClassifier('DoodleNet') │    │
│   │  draw→classify→show│        │            │                   │    │
│   └─────────┬──────────┘        │            ▼                   │    │
│             │                   │      TensorFlow.js             │    │
│             │                   │   (runs the neural network)    │    │
│             │                   │            │                   │    │
│             │   guess + score   │            ▼                   │    │
│             │◄──────────────────┤       DoodleNet model          │    │
│             ▼                   └────────────────────────────────┘    │
│   ┌────────────────────┐                                              │
│   │  Result on screen  │   "I think it's a CAT! — 91% sure 🐱"        │
│   │  (HTML text/p5)    │                                              │
│   └────────────────────┘                                              │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │  first visit: download files + model
                                   │
                    ┌──────────────┴───────────────┐
                    │   Static Host (GitHub Pages   │
                    │        / Netlify)             │
                    │  serves HTML, CSS, JS         │
                    └──────────────────────────────┘
```

---

## 4. Data Flow (Step by Step)

1. The kid opens the page — the **static host** serves `index.html`, `style.css`, `sketch.js`.
2. `index.html` loads **p5.js** and **ml5.js** from a CDN.
3. **ml5.js** downloads the **DoodleNet** model (runs on **TensorFlow.js**).
4. The kid draws on the **p5.js canvas** with mouse or touch.
5. **sketch.js** sends the canvas pixels to **ml5.js** (`classify()`).
6. **DoodleNet** predicts the most likely category + a confidence score (**inference**).
7. **sketch.js** displays the guess on screen in friendly language.
8. The **Clear** button wipes the canvas so the kid can try again.

---

## 5. Key Design Decisions

| Decision | Why |
|---|---|
| No backend server | The model runs in the browser, so nothing needs a server. Simpler + free. |
| Pre-trained model (DoodleNet) | No training data, no GPU, no ML expertise needed. |
| CDN libraries (no npm/build) | Kid- and beginner-friendly; open the file and it works. |
| Static hosting | Free, fast, and shareable with one link. |
| White canvas + black brush | Matches the *Quick, Draw!* data the model learned from → better accuracy. |
| Classify on a timer, not every frame | Keeps the drawing smooth and avoids overworking the CPU. |

---

## 6. Constraints & Limitations

- **Model accuracy** depends on drawings looking like Google's *Quick, Draw!* doodles (big, simple, centered).
- **First load is slower** because the model downloads once (then it's cached).
- **Only 345 categories** — the AI can only guess things it was trained on.
- **Runs on the device's CPU/GPU** — very old devices may feel slow.
