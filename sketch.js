// GuessMySketch ML — game code (Phase 6)
// Draw in color, the AI guesses, plus a Clear button, touch support,
// and friendly encouragement messages.

const CANVAS_WIDTH = 560;
const CANVAS_HEIGHT = 560;
const BRUSH_SIZE = 14; // thin pen so kids can draw more detail in the box (crop+center
                       // normalization scales the drawing up, so thin lines still show)
const GUESS_EVERY_MS = 700; // how often the AI looks at the drawing

// --- Accuracy tuning ---------------------------------------------------------
// DoodleNet was trained on Quick, Draw! doodles that are CENTERED and roughly
// FILL the frame. So before we classify, we crop the drawing to its bounding
// box and re-center it in a padded square (see buildNormalized). This alone is
// the single biggest accuracy win — a small doodle in a corner would otherwise
// shrink to almost nothing when scaled down to 28x28.
const NORM_SIZE = 560;  // size of the square we normalize the drawing into
const NORM_PAD = 60;    // white margin kept around the drawing (~10%, like Quick, Draw!)
// We also smooth guesses over the last few classifications so the answer is
// steadier and less jumpy (temporal smoothing / majority vote).
const HISTORY_SIZE = 5;

// --- "Teach the AI" (in-browser transfer learning) ---------------------------
// A separate, personal classifier the kid can train by example. It uses ml5's
// featureExtractor (MobileNet) as a base and learns ONLY from drawings taught on
// THIS device — nothing is uploaded or shared with anyone else.
const TEACH_SIZE = 224;                  // size of the snapshot fed to the learner
const STORAGE_KEY = "gms_taught_v1";     // localStorage key for taught examples

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
let normBuffer;        // normalized (cropped + centered) copy actually sent to the AI
let classifier;        // the DoodleNet model
let modelLoaded = false;

// Bounding box of everything the kid has drawn, used to crop + center before
// classifying. hasBounds is false until the first stroke.
let minX = 0, minY = 0, maxX = 0, maxY = 0, hasBounds = false;
// Recent top guesses, kept for temporal smoothing (see gotResult).
let guessHistory = [];

// "Teach the AI" state (all local to this browser).
let featureExtractor;      // MobileNet base model
let customClassifier;      // the personal classifier trained on taught examples
let customTrained = false; // true once it has been trained at least once
let taughtCounts = {};     // how many examples per label the kid has taught
let taughtExamples = [];   // [{ dataUrl, label }] persisted in localStorage
let pendingDataUrl = null; // snapshot of the drawing being taught right now
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

  // Normalized buffer: the cropped + centered version of the drawing that the
  // AI actually classifies (built fresh on every guess in buildNormalized).
  normBuffer = createGraphics(NORM_SIZE, NORM_SIZE);
  normBuffer.background(255);

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

  const teachBtn = document.getElementById("teach-btn");
  if (teachBtn) teachBtn.addEventListener("click", onTeach);

  const trainBtn = document.getElementById("train-btn");
  if (trainBtn) trainBtn.addEventListener("click", onTrain);

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

  // Load the MobileNet feature extractor that powers "Teach the AI".
  // epochs: how many learning passes "Train the AI" makes over the examples.
  // batchSize (a FRACTION of the examples): must be big enough that it never
  // rounds down to 0 for a small teaching set — otherwise training throws
  // "Batch size is 0" and never runs.
  featureExtractor = ml5.featureExtractor(
    "MobileNet",
    { epochs: 20, batchSize: 0.5 },
    featureExtractorReady
  );

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

// Called once the MobileNet feature extractor has loaded. Sets up the personal
// classifier and restores anything the kid taught it before (this browser only).
function featureExtractorReady() {
  customClassifier = featureExtractor.classification();
  console.log("Feature extractor ready — 'Teach the AI' is available.");
  loadTaughtExamples();
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
      resetBounds();
      guessHistory = [];
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

    // Grow the bounding box so we know where the drawing is (for cropping).
    updateBounds(mouseX, mouseY);
    updateBounds(pmouseX, pmouseY);

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
  resetBounds();
  guessHistory = [];
  hasDrawing = false;
  awaitingFeedback = false;
  hideWrongPanel();
  setGuessText("Cleared! Draw something new 🎨");
  setEncouragement("Tip: draw big and in the middle! ✏️");
  setOtherGuesses("");
  setTaughtGuess("");
  pendingDataUrl = null;
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

  // Snapshot the current drawing so the kid can teach the AI what it really is.
  pendingDataUrl = hasDrawing ? snapshotNormalized() : null;
  setTeachStatus(
    customClassifier
      ? 'Type what it was, then press "Teach the AI this!"'
      : "The learning brain is still loading... one moment."
  );

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
  resetBounds();
  guessHistory = [];
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
  // Classify a normalized (cropped + centered) black-on-white copy — this
  // matches how DoodleNet's training doodles look, so guesses are more accurate.
  const img = buildNormalized();
  classifier.classify(img, gotResult);

  // If the kid has trained their own classifier, also ask it what it thinks.
  if (customTrained && customClassifier) {
    customClassifier.classify(img, gotCustomResult);
  }
}

// Called with the AI's guesses (best guess first).
function gotResult(error, results) {
  if (error) {
    console.error(error);
    return;
  }

  // Remember this round's top guess and keep only the most recent few.
  guessHistory.push(results[0]);
  if (guessHistory.length > HISTORY_SIZE) guessHistory.shift();

  // Temporal smoothing: instead of trusting a single jumpy frame, add up the
  // confidence for each label across the recent guesses and pick the strongest.
  // A label that shows up consistently beats a one-off spike, so the answer is
  // both steadier and usually more accurate.
  const sums = {};
  const counts = {};
  for (const g of guessHistory) {
    sums[g.label] = (sums[g.label] || 0) + g.confidence;
    counts[g.label] = (counts[g.label] || 0) + 1;
  }

  // Rank all seen labels by total confidence, strongest first.
  const ranked = Object.keys(sums).sort((a, b) => sums[b] - sums[a]);

  const bestLabel = ranked[0];
  const percent = Math.round((sums[bestLabel] / counts[bestLabel]) * 100);
  const label = bestLabel.toUpperCase();
  lastLabel = bestLabel;

  // Show the guess on screen in friendly language.
  setGuessText(`I think it's a ${label}! — ${percent}% sure`);

  // Doodles are tricky — also show the next couple of guesses so the kid can
  // see the one they meant even when the top pick is wrong.
  const others = ranked.slice(1, 3).map((l) => l.toUpperCase());
  if (others.length > 0) {
    setOtherGuesses(`or maybe: ${others.join(", ")}`);
  } else {
    setOtherGuesses("");
  }

  // Show a random cheer to keep it fun.
  setEncouragement(random(CHEERS));

  console.log(`AI guess: ${bestLabel} (${percent}%)`);
}

// Result from the kid's own trained classifier ("Teach the AI").
function gotCustomResult(error, results) {
  if (error || !results || !results[0]) return;
  const top = results[0];
  const percent = Math.round(top.confidence * 100);
  setTaughtGuess(`🧠 You taught me: ${top.label.toUpperCase()} (${percent}%)`);
}

// Returns true if the given point is inside the canvas area.
function isOnCanvas(x, y) {
  return x >= 0 && x <= CANVAS_WIDTH && y >= 0 && y <= CANVAS_HEIGHT;
}

// Forget where the drawing was (called whenever the canvas is wiped).
function resetBounds() {
  hasBounds = false;
  minX = minY = maxX = maxY = 0;
}

// Grow the drawing's bounding box to include point (x, y), padded by the brush
// radius so thick strokes near an edge are fully covered.
function updateBounds(x, y) {
  const r = BRUSH_SIZE / 2;
  if (!hasBounds) {
    minX = x - r; maxX = x + r;
    minY = y - r; maxY = y + r;
    hasBounds = true;
  } else {
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r);
    maxY = Math.max(maxY, y + r);
  }
}

// Build the image the AI actually looks at: crop the drawing to its bounding
// box and re-center it inside a padded white square. DoodleNet expects doodles
// that are centered and fill most of the frame, so this makes small or
// off-center drawings recognizable instead of shrinking them to a tiny blob.
function buildNormalized() {
  if (!hasBounds) return mlBuffer; // nothing drawn yet — fall back to raw buffer

  // Clamp the box to the canvas so we never read outside it.
  const loX = Math.max(0, minX);
  const loY = Math.max(0, minY);
  const hiX = Math.min(CANVAS_WIDTH, maxX);
  const hiY = Math.min(CANVAS_HEIGHT, maxY);
  const w = hiX - loX;
  const h = hiY - loY;
  if (w <= 0 || h <= 0) return mlBuffer;

  // Scale so the longer side of the drawing fits the padded target area,
  // keeping the aspect ratio (no stretching).
  const target = NORM_SIZE - NORM_PAD * 2;
  const scale = target / Math.max(w, h);
  const cx = loX + w / 2;
  const cy = loY + h / 2;

  normBuffer.background(255);
  normBuffer.push();
  normBuffer.translate(NORM_SIZE / 2, NORM_SIZE / 2); // center of the output
  normBuffer.scale(scale);
  normBuffer.translate(-cx, -cy); // bring the drawing's center to the origin
  normBuffer.image(mlBuffer, 0, 0);
  normBuffer.pop();
  return normBuffer;
}

// ---------------------------------------------------------------------------
// "Teach the AI" — a personal classifier trained in the browser, on this
// device only. Nothing is uploaded; examples live in localStorage.
// ---------------------------------------------------------------------------

// Take a small square snapshot of the current normalized drawing as a data URL.
function snapshotNormalized() {
  const g = createGraphics(TEACH_SIZE, TEACH_SIZE);
  g.background(255);
  g.image(buildNormalized(), 0, 0, TEACH_SIZE, TEACH_SIZE);
  const url = g.canvas.toDataURL("image/png");
  g.remove();
  return url;
}

// Kid pressed "Teach the AI this!" — add the snapshot under the typed label.
function onTeach() {
  const input = document.getElementById("answer-input");
  const label = input ? input.value.trim().toLowerCase() : "";
  if (!label) {
    setTeachStatus("First type what you drew ✏️");
    return;
  }
  if (!pendingDataUrl) {
    setTeachStatus("Draw something first, then tell me what it was.");
    return;
  }
  if (!customClassifier) {
    setTeachStatus("The learning brain is still loading... try again in a moment.");
    return;
  }
  setTeachStatus("Adding your example... 🧠");
  addTaughtExample(pendingDataUrl, label, true);
}

// Add one example to the personal classifier (and optionally remember it).
// We draw the snapshot onto a real <canvas> and hand THAT to ml5 — passing a
// p5.Image (from loadImage) fails because tf.browser.fromPixels can't read it.
function addTaughtExample(dataUrl, label, isNew) {
  const imgEl = new Image();
  imgEl.onload = () => {
    const g = createGraphics(TEACH_SIZE, TEACH_SIZE);
    g.pixelDensity(1);
    g.background(255);
    g.drawingContext.drawImage(imgEl, 0, 0, TEACH_SIZE, TEACH_SIZE);
    customClassifier.addImage(g.elt, label, () => {
      taughtCounts[label] = (taughtCounts[label] || 0) + 1;
      if (isNew) {
        taughtExamples.push({ dataUrl, label });
        saveTaught();
        updateTeachStatus();
      }
      maybeShowTrain();
      g.remove();
    });
  };
  imgEl.onerror = () => setTeachStatus("Hmm, couldn't read that drawing. Try again.");
  imgEl.src = dataUrl;
}

// Show how many examples the kid has taught so far.
function updateTeachStatus() {
  const labels = Object.keys(taughtCounts);
  if (labels.length === 0) {
    setTeachStatus("");
    return;
  }
  const parts = labels.map((l) => `${l} ×${taughtCounts[l]}`);
  const needMore = labels.length < 2;
  setTeachStatus(
    "You taught me: " +
      parts.join(", ") +
      (needMore
        ? " — now teach a DIFFERENT thing too (I need at least 2 kinds to learn), then Train!"
        : " — now press Train the AI 🎓")
  );
}

// Reveal the Train button once there are at least 2 different labels.
function maybeShowTrain() {
  const trainBtn = document.getElementById("train-btn");
  if (trainBtn) trainBtn.hidden = Object.keys(taughtCounts).length < 2;
}

// Kid pressed "Train the AI" — learn from all taught examples.
function onTrain() {
  if (!customClassifier || Object.keys(taughtCounts).length < 2) {
    setTeachStatus("Teach me at least 2 different things first.");
    return;
  }

  // Disable the button while training so it's clear something is happening.
  const trainBtn = document.getElementById("train-btn");
  if (trainBtn) trainBtn.disabled = true;

  let epoch = 0;
  const totalEpochs = 20; // matches the epochs option on the feature extractor
  setTeachStatus("Learning from your drawings... 🧠 0%");

  customClassifier.train((loss) => {
    if (loss === null || loss === undefined) {
      // Training finished — let the kid know clearly that they can draw again.
      customTrained = true;
      awaitingFeedback = false; // resume guessing
      if (trainBtn) trainBtn.disabled = false;
      setTeachStatus("✅ All learned! You can draw again now 🎓");
      setEncouragement("✅ Done learning! Draw it again and I'll use what you taught me 🎓");
    } else {
      // Called once per learning pass — show a growing progress percentage.
      epoch++;
      const pct = Math.min(99, Math.round((epoch / totalEpochs) * 100));
      setTeachStatus(`Learning from your drawings... 🧠 ${pct}%`);
    }
  });
}

// Save taught examples to THIS browser only.
function saveTaught() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(taughtExamples));
  } catch (e) {
    console.warn("Could not save taught examples:", e);
  }
}

// Reload taught examples from localStorage and re-teach the classifier.
function loadTaughtExamples() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return;
  }
  if (!raw) return;
  try {
    taughtExamples = JSON.parse(raw) || [];
  } catch (e) {
    taughtExamples = [];
    return;
  }
  if (taughtExamples.length === 0) return;

  taughtExamples.forEach((ex) => addTaughtExample(ex.dataUrl, ex.label, false));

  // The addImage calls above are async; wait a moment for them to settle, then
  // auto-train so the kid's earlier lessons are ready again.
  setTimeout(() => {
    maybeShowTrain();
    if (Object.keys(taughtCounts).length >= 2) {
      customClassifier.train((loss) => {
        if (loss === null || loss === undefined) {
          customTrained = true;
          setTeachStatus("Loaded what you taught me before 🎓");
        }
      });
    }
  }, 1000);
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

// Helper to update the smaller "or maybe: ..." line of runner-up guesses.
function setOtherGuesses(message) {
  const el = document.getElementById("other-guesses");
  if (el) {
    el.textContent = message;
  }
}

// Helper to update the green "You taught me: ..." line.
function setTaughtGuess(message) {
  const el = document.getElementById("taught-guess");
  if (el) {
    el.textContent = message;
  }
}

// Helper to update the "Teach the AI" status line.
function setTeachStatus(message) {
  const el = document.getElementById("teach-status");
  if (el) {
    el.textContent = message;
  }
}
