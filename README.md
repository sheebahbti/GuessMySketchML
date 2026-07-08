# AI Pictionary 🎨🤖

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

## Status

🚧 In progress — setting up the drawing canvas and connecting the AI model.

## License

MIT
