# GuessMySketch ML 🎨🤖

**You draw → the AI guesses what you drew!**

A fun, kid-friendly machine learning game that runs entirely in the browser. Draw a doodle on the screen (a cat, a house, a tree, a car...) and watch the AI try to guess what it is in real time — just like playing Pictionary against a computer.

---

## What We're Building

A simple web game where:

1. **A kid draws** a picture on a canvas using the mouse or a touchscreen.
2. **The AI looks** at the drawing as it's being made.
3. **The AI guesses** what the doodle is — e.g. *"I think that's a CAT! 🐱"* — and shows how confident it is.

The goal is to make machine learning feel like magic: the computer "sees" a rough sketch and recognizes it, teaching kids the core idea that computers can learn to understand pictures.

### Example

| The kid draws... | The AI says... |
|---|---|
| 🐱 (a cat shape) | "That's a CAT! — 91% sure" |
| 🏠 (a house shape) | "I think it's a HOUSE! — 84% sure" |
| 🌳 (a tree shape) | "Looks like a TREE! — 78% sure" |

---

## How It Works

The game uses a **pre-trained** machine learning model called **DoodleNet** (via [ml5.js](https://ml5js.org)), which has already learned to recognize **345 categories** of doodles from Google's *Quick, Draw!* dataset. That means:

- ✅ **No training required** — the model already knows how to recognize drawings.
- ✅ **No coding knowledge needed to play** — just open the page and draw.
- ✅ **Runs 100% in the browser** — nothing to install.

```
Kid draws on canvas  →  DoodleNet model (ml5.js)  →  Guess + confidence shown on screen
```

---

## Where Is Machine Learning Used?

The AI in this game is **DoodleNet**, a pre-trained image-classification neural network loaded through ml5.js. The machine learning happens in two steps:

1. **Loading the model** — `ml5.imageClassifier('DoodleNet', modelReady)` downloads the pre-trained neural network into the browser.
2. **Making a guess** — `classifier.classify(canvas, gotResult)` feeds the kid's drawing into that network, which predicts which of **345 categories** (cat, house, tree…) it most looks like, along with a confidence score.

### Using ML vs. Training ML

This project **uses** machine learning but does **not train** any model:

| | This project |
|---|---|
| Trains a model from data? | ❌ No |
| Uses a trained model to make predictions? | ✅ Yes (this is called *inference*) |
| Where the "learning" happened | Already done by Google on the *Quick, Draw!* dataset (50M+ drawings) |

The neural network already "learned" from millions of human doodles **before** the page is ever opened. The game simply runs that trained brain on new drawings — that prediction step is called **inference**, and it is the real machine learning happening live in your browser.

```
Google trains DoodleNet on millions of doodles   ← the "learning" (done already)
                    │
                    ▼
Game loads the trained model in the browser      ← ML step 1
                    │
                    ▼
Kid draws → model predicts "CAT 91%"             ← ML step 2 (inference = using ML)
```

---

## Tech Stack (all free)

| Layer | Technology | Why |
|---|---|---|
| Drawing canvas | [p5.js](https://p5js.org) | Simple, kid-friendly graphics + drawing |
| Machine learning | [ml5.js](https://ml5js.org) + DoodleNet | Pre-trained doodle classifier, no setup |
| Page | Plain HTML / CSS / JavaScript | No build tools, runs by opening a file |
| Hosting (optional) | GitHub Pages / Netlify | Free, share with a single link |

---

## Why This Project

- **Great for kids** — visual, interactive, and playful (drawing, not typing).
- **Teaches real ML concepts** — how a computer "learns from examples" to recognize images.
- **Small & fast to build** — no servers, no databases, no accounts.
- **100% free** — free tools, free hosting, no paid APIs.

---

## Running Locally

Because the game loads an AI model over the network, run it through a small local
web server (not by double-clicking the file):

```powershell
# From the project folder:
python -m http.server 5500
```

Then open **http://localhost:5500/index.html** in your browser.

> Tip: VS Code's **Live Server** extension works too — right-click `index.html` → *Open with Live Server*.

---

## Deployment

The game is a static site (HTML/CSS/JS), so hosting is free and simple.

### Option A — GitHub Pages
1. Push this folder to a GitHub repository.
2. In the repo: **Settings → Pages**.
3. Under *Build and deployment*, set **Source: Deploy from a branch**, pick your
   branch (e.g. `main`) and folder `/ (root)`, then **Save**.
4. Wait a minute, then open the URL GitHub shows (e.g. `https://you.github.io/GuessMySketchML/`).

*(The included `.nojekyll` file makes sure all files are served as-is.)*

### Option B — Netlify
1. Go to [netlify.com](https://www.netlify.com) and log in.
2. **Drag and drop** the project folder onto the Netlify dashboard, **or** connect the GitHub repo.
3. No build command is needed — the included `netlify.toml` publishes the folder as-is.
4. Netlify gives you a public link to share.

> **Not recommended:** Railway (it's built for backend apps/databases, which this project
> doesn't have). If you use Render, choose the **Static Site** type — not a Web Service.

---

## Status

✅ Core game complete — draw, colors, live AI guessing, Clear button, touch support.
Ready to deploy.

## License

MIT
