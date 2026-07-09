// GuessMySketch ML — game code (Phase 6)
// Draw in color, the AI guesses, plus a Clear button, touch support,
// and friendly encouragement messages.

const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 560;
const BRUSH_SIZE = 30; // thick brush so strokes survive shrinking to 28x28 for the AI
const GUESS_EVERY_MS = 1000; // how often the AI looks at the drawing

// Colors the kid can pick from (name + value).
const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#e6194b" },
  { name: "Blue", value: "#1f6feb" },
  { name: "Green", value: "#2ca02c" },
  { name: "Orange", value: "#ff8c00" },
  { name: "Purple", value: "#8b2fc9" },
  { name: "Brown", value: "#8b5a2b" },
  { name: "Pink", value: "#ff69b4" },
  { name: "Yellow", value: "#f5c518" },
  { name: "Teal", value: "#009e9e" },
];

// Fun encouragement messages shown as the kid draws.
const CHEERS = [
  "Nice drawing! 🎨",
  "Keep going! ✏️",
  "Great job! 🌟",
  "Ooh, I love it! 😄",
  "You're an artist! 🖼️",
];

// Common doodles suggested in the "What were you drawing?" box.
const DOODLE_SUGGESTIONS = [
  "cat", "dog", "house", "tree", "car", "sun", "star", "cup", "fish",
  "flower", "apple", "umbrella", "cloud", "boat", "bird", "bicycle",
  "book", "butterfly", "cake", "clock", "crown", "duck", "guitar", "hat",
  "ice cream", "key", "leaf", "moon", "mountain", "mushroom", "pencil",
  "pizza", "rainbow", "scissors", "snake", "snowman", "spider", "train",
  "banana", "carrot", "chair", "door", "ladder", "rabbit", "shoe",
  "smiley face", "sword", "wheel",
];

// Specific "how to draw" hints for popular doodles (emoji + one tip).
const SPECIFIC_TIPS = {
  cat: { emoji: "🐱", tip: "Draw a round head, two pointy triangle ears on top, and add whiskers." },
  dog: { emoji: "🐶", tip: "Draw a round head with two floppy ears hanging down and a little nose." },
  house: { emoji: "🏠", tip: "Draw a square box with a triangle roof on top, plus a door and a window." },
  tree: { emoji: "🌳", tip: "Draw a straight trunk with a big fluffy cloud shape on top for the leaves." },
  car: { emoji: "🚗", tip: "Draw a long body with a bump on top and two round wheels underneath." },
  sun: { emoji: "☀️", tip: "Draw a circle in the middle with straight lines poking out all around it." },
  star: { emoji: "⭐", tip: "Draw a five-point star with one point up — don't lift your pen!" },
  cup: { emoji: "☕", tip: "Draw a U-shape (like a bucket) with a little handle on the side." },
  fish: { emoji: "🐟", tip: "Draw an oval body and a triangle tail at the back." },
  flower: { emoji: "🌸", tip: "Draw a small circle in the middle with round petals all around it, and a stem." },
  apple: { emoji: "🍎", tip: "Draw a round shape with a tiny dip on top and a little stem." },
  umbrella: { emoji: "☂️", tip: "Draw a dome (half circle) on top with a curved handle going down." },
  cloud: { emoji: "☁️", tip: "Draw a bumpy, lumpy shape like a bunch of circles joined together." },
  boat: { emoji: "⛵", tip: "Draw a U-shape for the boat and a triangle sail on top." },
  bird: { emoji: "🐦", tip: "Draw a little body, a wing, a beak, and a fan-shaped tail." },
  star_default: { emoji: "🎨", tip: "Start with its most basic, recognizable shape." },
};

let canvas;            // the p5 canvas (what the kid sees, in color)
let mlBuffer;          // hidden black-on-white copy the AI looks at (for accuracy)
let classifier;        // the DoodleNet model
let modelLoaded = false;
let brushColor = COLORS[0].value; // current drawing color (starts black)
let hasDrawing = false; // true once the kid has drawn something
let lastLabel = "";     // the AI's most recent top guess
let awaitingFeedback = false; // true while showing the "how to draw" help (pauses guessing)
let demoTimer = null;   // timer used to animate the example drawing
let demoOnCanvas = false; // true while a blue example doodle is shown on the canvas

function setup() {
  // Create the drawing canvas and place it inside the #canvas-holder div.
  canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  canvas.parent("canvas-holder");

  // Start with a clean white background (matches the DoodleNet data).
  background(255);

  // Hidden buffer: same size, always BLACK strokes on a WHITE background.
  // DoodleNet was trained on black-on-white doodles, so the AI sees THIS
  // (not the colorful canvas) to guess accurately.
  mlBuffer = createGraphics(CANVAS_WIDTH, CANVAS_HEIGHT);
  mlBuffer.background(255);

  // Build the color palette buttons.
  buildPalette();

  // Fill the "What were you drawing?" suggestion list.
  buildDoodleList();

  // Wire up the Clear / Try Again button.
  const clearBtn = document.getElementById("clear-btn");
  if (clearBtn) clearBtn.addEventListener("click", clearCanvas);

  // Wire up the "Did I guess right?" feedback buttons.
  const yesBtn = document.getElementById("yes-btn");
  if (yesBtn) yesBtn.addEventListener("click", onCorrect);

  const noBtn = document.getElementById("no-btn");
  if (noBtn) noBtn.addEventListener("click", onWrong);

  const answerBtn = document.getElementById("answer-btn");
  if (answerBtn) answerBtn.addEventListener("click", onShowHow);

  // Stop the page from scrolling when kids draw with a finger on the canvas.
  canvas.elt.addEventListener("touchstart", (e) => e.preventDefault(), {
    passive: false,
  });
  canvas.elt.addEventListener("touchmove", (e) => e.preventDefault(), {
    passive: false,
  });

  // Tell the kid the AI is loading.
  setGuessText("Loading AI... please wait ⏳");

  // Load the pre-trained DoodleNet model. modelReady() runs when it's done.
  classifier = ml5.imageClassifier("DoodleNet", modelReady);

  console.log("p5.js is running — canvas ready to draw!");
}

// Called once the DoodleNet model has finished loading.
function modelReady() {
  modelLoaded = true;
  setGuessText("AI is ready! Draw something 🎨");
  console.log("Model loaded! DoodleNet is ready.");

  // Once the model is ready, let the AI look at the drawing on a timer
  // (not every frame — that would be slow and jumpy).
  setInterval(guess, GUESS_EVERY_MS);
}

function draw() {
  // Only draw while the pointer/finger is down and on the canvas.
  if (mouseIsPressed && isOnCanvas(mouseX, mouseY)) {
    // Drawing again means the kid is trying once more — resume guessing
    // and hide any "how to draw" help.
    if (awaitingFeedback) {
      awaitingFeedback = false;
      hideWrongPanel();
    }

    // If a blue example is on the canvas, wipe it so the kid starts fresh.
    if (demoOnCanvas) {
      stopDemo();
      background(255);
      mlBuffer.background(255);
      demoOnCanvas = false;
    }

    // Visible canvas: draw with the chosen color, thick and round.
    stroke(brushColor);
    strokeWeight(BRUSH_SIZE);
    strokeCap(ROUND);
    line(pmouseX, pmouseY, mouseX, mouseY);

    // Hidden AI buffer: draw the SAME stroke, but always black on white
    // (that's the format DoodleNet expects).
    mlBuffer.stroke(0);
    mlBuffer.strokeWeight(BRUSH_SIZE);
    mlBuffer.strokeCap(ROUND);
    mlBuffer.line(pmouseX, pmouseY, mouseX, mouseY);

    hasDrawing = true;
  }
}

// Touch support: p5 fires this while a finger drags. Returning false
// stops the browser from scrolling the page during a drawing stroke.
function touchMoved() {
  if (isOnCanvas(mouseX, mouseY)) {
    return false;
  }
}

// Wipe both the visible canvas and the hidden AI buffer.
function clearCanvas() {
  stopDemo();
  demoOnCanvas = false;
  background(255);
  mlBuffer.background(255);
  hasDrawing = false;
  awaitingFeedback = false;
  hideWrongPanel();
  setGuessText("Cleared! Draw something new 🎨");
  setEncouragement("Tip: draw big and in the middle! ✏️");
}

// Kid says the guess was correct.
function onCorrect() {
  awaitingFeedback = false;
  hideWrongPanel();
  setEncouragement("Yay! I got it right! 🎉");
}

// Kid says the guess was wrong — ask what they meant and pause guessing.
function onWrong() {
  awaitingFeedback = true;
  const panel = document.getElementById("wrong-panel");
  if (panel) panel.hidden = false;
  const input = document.getElementById("answer-input");
  if (input) {
    input.value = "";
    input.focus();
  }
  const tips = document.getElementById("tips");
  if (tips) tips.innerHTML = "";
  setEncouragement("Oops! Tell me what it was ⬇️");
}

// Kid submitted what they were drawing — show how to draw it.
function onShowHow() {
  const input = document.getElementById("answer-input");
  const answer = input ? input.value.trim() : "";
  if (!answer) return;
  showTips(answer);

  // Try to actually draw an example on the canvas.
  const drew = playDemo(answer.toLowerCase());
  if (drew) {
    setEncouragement("Watch the blue example, then draw it yourself! 💙");
  }
}

// Hide the "wrong" help panel and clear its contents.
function hideWrongPanel() {
  const panel = document.getElementById("wrong-panel");
  if (panel) panel.hidden = true;
  const tips = document.getElementById("tips");
  if (tips) tips.innerHTML = "";
}

// Show drawing tips + a gallery link for what the kid meant to draw.
function showTips(answer) {
  const tipsEl = document.getElementById("tips");
  if (!tipsEl) return;

  const clean = answer.toLowerCase();
  const info = SPECIFIC_TIPS[clean] || SPECIFIC_TIPS.star_default;
  const emoji = info.emoji;
  const specific = info.tip;

  // Real examples of how others drew this, from Google's Quick, Draw! gallery.
  const galleryUrl =
    "https://quickdraw.withgoogle.com/data/" + encodeURIComponent(clean);

  // Escape the kid's text before putting it in the page (safety).
  const safe = escapeHtml(answer.toUpperCase());
  const safeLink = escapeHtml(clean);

  tipsEl.innerHTML =
    '<p class="tips-title">' + emoji + " How to draw a " + safe + "</p>" +
    "<ul>" +
    "<li>" + escapeHtml(specific) + "</li>" +
    "<li>Draw it <b>big</b> so it fills the box.</li>" +
    "<li>Keep it in the <b>middle</b>.</li>" +
    "<li>Use <b>simple, bold lines</b> — skip the tiny details.</li>" +
    "</ul>" +
    '<a href="' + galleryUrl + '" target="_blank" rel="noopener">' +
    "See how others drew a " + safeLink + " →</a>";

  setEncouragement("Try drawing it again! 💪");
}

// Turn special HTML characters into safe text.
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

// ---------------------------------------------------------------------------
// "Show me how" — draw an example doodle on the canvas, part by part.
// ---------------------------------------------------------------------------

const DEMO_COLOR = "#2b7fff"; // blue, so the example stands out from the kid's drawing

// Each demo is a list of steps. We reveal one step every so often so it
// looks like the picture is being drawn. Coordinates fit the 560x560 canvas.
const DEMOS = {
  sun: [
    () => circle(280, 280, 170),
    () => rays(280, 280, 110, 160, 12),
  ],
  star: [() => drawStar(280, 285, 60, 150, 5)],
  house: [
    () => rect(180, 270, 200, 170),
    () => triangle(165, 270, 280, 150, 395, 270),
    () => rect(250, 350, 60, 90),
    () => rect(300, 300, 55, 55),
  ],
  tree: [
    () => rect(262, 320, 36, 150),
    () => circle(280, 260, 200),
  ],
  cat: [
    () => circle(280, 300, 220),
    () => triangle(195, 215, 205, 120, 265, 195),
    () => triangle(365, 215, 355, 120, 295, 195),
    () => { circle(242, 290, 26); circle(318, 290, 26); },
    () => {
      line(175, 320, 250, 330);
      line(175, 352, 250, 350);
      line(310, 330, 385, 320);
      line(310, 350, 385, 352);
    },
  ],
  cup: [
    () => {
      beginShape();
      vertex(210, 250);
      vertex(350, 250);
      vertex(332, 410);
      vertex(228, 410);
      endShape(CLOSE);
    },
    () => arc(350, 300, 90, 90, -HALF_PI, HALF_PI),
  ],
  flower: [
    () => circle(280, 250, 60),
    () => petals(280, 250, 62, 56, 8),
    () => line(280, 285, 280, 460),
    () => { line(280, 380, 330, 350); line(280, 405, 232, 372); },
  ],
  fish: [
    () => ellipse(270, 290, 240, 140),
    () => triangle(150, 290, 90, 240, 90, 340),
    () => circle(330, 270, 20),
  ],
  boat: [
    () => {
      beginShape();
      vertex(170, 330);
      vertex(390, 330);
      vertex(350, 420);
      vertex(210, 420);
      endShape(CLOSE);
    },
    () => line(280, 330, 280, 170),
    () => triangle(280, 180, 280, 320, 372, 320),
  ],
  cloud: [
    () => arc(230, 300, 120, 120, PI, TWO_PI),
    () => arc(300, 288, 150, 150, PI, TWO_PI),
    () => arc(362, 300, 110, 110, PI, TWO_PI),
    () => line(175, 300, 416, 300),
  ],
  apple: [
    () => circle(280, 300, 190),
    () => line(280, 205, 286, 165),
    () => ellipse(322, 180, 50, 26),
  ],
  umbrella: [
    () => arc(280, 270, 270, 270, PI, TWO_PI),
    () => line(145, 270, 415, 270),
    () => line(280, 270, 280, 430),
    () => arc(300, 430, 42, 42, 0, PI),
  ],
  car: [
    () => rect(160, 300, 240, 70, 12),
    () => {
      beginShape();
      vertex(210, 300);
      vertex(242, 255);
      vertex(320, 255);
      vertex(352, 300);
      endShape();
    },
    () => { circle(222, 378, 56); circle(340, 378, 56); },
  ],
  dog: [
    () => circle(280, 300, 200),
    () => ellipse(182, 255, 60, 130),
    () => ellipse(378, 255, 60, 130),
    () => { circle(246, 290, 22); circle(314, 290, 22); },
    () => circle(280, 340, 30),
  ],
  bird: [
    () => circle(275, 290, 150),
    () => triangle(350, 290, 410, 275, 410, 305),
    () => arc(275, 290, 90, 90, -HALF_PI, HALF_PI),
    () => { line(200, 285, 128, 255); line(200, 300, 128, 322); },
  ],
};

// Draw straight rays around a point (used for the sun).
function rays(cx, cy, rInner, rOuter, count) {
  for (let i = 0; i < count; i++) {
    const a = (TWO_PI / count) * i;
    line(
      cx + cos(a) * rInner, cy + sin(a) * rInner,
      cx + cos(a) * rOuter, cy + sin(a) * rOuter
    );
  }
}

// Draw round petals around a center point (used for the flower).
function petals(cx, cy, dist, size, count) {
  for (let i = 0; i < count; i++) {
    const a = (TWO_PI / count) * i;
    circle(cx + cos(a) * dist, cy + sin(a) * dist, size);
  }
}

// Draw a pointed star.
function drawStar(cx, cy, rInner, rOuter, points) {
  beginShape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (PI / points) * i - HALF_PI;
    vertex(cx + cos(a) * r, cy + sin(a) * r);
  }
  endShape(CLOSE);
}

// Animate an example doodle on the canvas. Returns true if we have a demo.
function playDemo(label) {
  const steps = DEMOS[label];
  if (!steps) return false;

  stopDemo();

  // Fresh canvas for the example.
  background(255);
  mlBuffer.background(255);
  hasDrawing = false;
  demoOnCanvas = true;

  let i = 0;
  const drawStep = () => {
    stroke(DEMO_COLOR);
    strokeWeight(8);
    strokeCap(ROUND);
    strokeJoin(ROUND);
    noFill();
    steps[i]();
    i++;
    if (i >= steps.length) stopDemo();
  };

  drawStep(); // draw the first part right away
  if (steps.length > 1) demoTimer = setInterval(drawStep, 500);
  return true;
}

// Stop the example animation (if one is running).
function stopDemo() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
  }
}

// Ask the AI to look at the current drawing and guess what it is.
function guess() {
  if (!modelLoaded) return;
  if (!hasDrawing) return; // nothing drawn yet — don't guess on a blank canvas
  if (awaitingFeedback) return; // paused while showing "how to draw" help
  // Classify the black-on-white buffer, not the colorful canvas.
  classifier.classify(mlBuffer, gotResult);
}

// Called with the AI's guesses (best guess first).
function gotResult(error, results) {
  if (error) {
    console.error(error);
    return;
  }

  // results[0] is the top guess: { label, confidence }
  const top = results[0];
  const percent = Math.round(top.confidence * 100);
  const label = top.label.toUpperCase();
  lastLabel = top.label;

  // Show the guess on screen in friendly language.
  setGuessText(`I think it's a ${label}! — ${percent}% sure`);

  // Show a random cheer to keep it fun.
  setEncouragement(random(CHEERS));

  console.log(`AI guess: ${top.label} (${percent}%)`);
}

// Returns true if the given point is inside the canvas area.
function isOnCanvas(x, y) {
  return x >= 0 && x <= CANVAS_WIDTH && y >= 0 && y <= CANVAS_HEIGHT;
}

// Build the clickable color palette and wire up color selection.
function buildPalette() {
  const palette = document.getElementById("palette");
  if (!palette) return;

  COLORS.forEach((color, index) => {
    const swatch = document.createElement("button");
    swatch.className = "swatch";
    swatch.style.background = color.value;
    swatch.title = color.name;
    if (index === 0) swatch.classList.add("selected"); // black selected by default

    swatch.addEventListener("click", () => {
      brushColor = color.value;
      // Highlight the chosen swatch.
      document
        .querySelectorAll(".swatch")
        .forEach((s) => s.classList.remove("selected"));
      swatch.classList.add("selected");
    });

    palette.appendChild(swatch);
  });
}

// Fill the <datalist> that suggests common doodles in the "What were you drawing?" box.
function buildDoodleList() {
  const list = document.getElementById("doodle-list");
  if (!list) return;

  DOODLE_SUGGESTIONS.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    list.appendChild(option);
  });
}

// Helper to update the on-screen guess/status text.
function setGuessText(message) {
  const guessEl = document.getElementById("guess");
  if (guessEl) {
    guessEl.textContent = message;
  }
}

// Helper to update the on-screen encouragement text.
function setEncouragement(message) {
  const el = document.getElementById("encouragement");
  if (el) {
    el.textContent = message;
  }
}
