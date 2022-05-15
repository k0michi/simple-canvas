class Image {
  constructor() {
    this.strokes = [];
  }

  addStroke(stroke) {
    this.strokes.push(stroke);
  }
}

class Vector2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  add(b) {
    return new Vector2(this.x + b.x, this.y + b.y);
  }

  sub(b) {
    return this.add(b.minus());
  }

  mul(b) {
    return new Vector2(b * this.x, b * this.y);
  }

  div(b) {
    return new Vector2(this.x / b, this.y / b);
  }

  normalized() {
    return this.div(this.length());
  }

  dot(b) {
    return this.x * b.x + this.y * b.y;
  }

  length() {
    return Math.sqrt(this.dot(this));
  }

  minus() {
    return this.mul(-1);
  }
}

class Stroke {
  constructor() {
    this.samples = [];
  }

  addSample(sample) {
    this.samples.push(sample);
  }
}

class Sample {
  constructor(point, pressure, tilt) {
    this.point = point;
    this.pressure = pressure;
    this.tilt = tilt;
  }
}

class FPSCounter {
  constructor() {
    this.lastTime = 0;
    this.tempCount = 0;
    this.count = 0;
  }

  updateAndCount(time) {
    this.update(time);
    this.tempCount++;
  }

  update(time) {
    if (time >= this.lastTime + 1000) {
      this.count = this.tempCount;
      this.tempCount = 0;
      this.lastTime = time;
    }
  }

  get() {
    return this.count;
  }
}

function mouseUp() {
  dragging = false;
  currentStroke = null;
  lastPointerState = null;
}

function resize() {
  const ratio = window.devicePixelRatio ?? 1;
  $canvas.width = $canvas.clientWidth * ratio;
  $canvas.height = $canvas.clientHeight * ratio;
  ctx.scale(ratio, ratio);
}

function samplePointer(e) {
  const x = e.offsetX;
  const y = e.offsetY;
  const tiltX = e.tiltX;
  const tiltY = e.tiltY;
  const pressure = e.pressure;

  const point = new Vector2(x, y);

  const lastPoint = currentStroke.samples.at(-1)?.point;

  if (limitSamplingDistance && (lastPoint != null && point.sub(lastPoint).length() < samplingDistanceThreshold)) {
    return;
  }

  const sample = new Sample(new Vector2(x, y), pressure, new Vector2(tiltX, tiltY));
  currentStroke.addSample(sample);

  lastPointerState = {
    offsetX: e.offsetX,
    offsetY: e.offsetY,
    width: e.width,
    height: e.height,
    pressure: e.pressure,
    tangentialPressure: e.tangentialPressure,
    tiltX: e.tiltX,
    tiltY: e.tiltY,
    twist: e.twist,
    pointerType: e.pointerType
  };
}

window.addEventListener('load', e => {
  $canvas = document.getElementById('canvas');
  ctx = $canvas.getContext('2d');

  image = new Image();
  fpsCounter = new FPSCounter();

  $canvas.addEventListener('pointerup', e => {
    mouseUp();
  });

  $canvas.addEventListener('pointerleave', e => {
    mouseUp();
  })

  $canvas.addEventListener('pointerdown', e => {
    dragging = true;
    currentStroke = new Stroke();
    image.addStroke(currentStroke);
    samplePointer(e);
  });

  $canvas.addEventListener('pointermove', e => {
    const time = performance.now();

    if (limitSamplingRate && time - prevSamplingTime < samplingThreshold) {
      return;
    }

    if (dragging) {
      samplePointer(e);
      prevSamplingTime = time;
      samplingCounter.updateAndCount(time);
    }
  });

  resize();

  // TODO: Use MutationObserver
  window.addEventListener('resize', e => {
    resize();
  });

  // TODO: Organize redundant code
  $rangeK = document.getElementById('range-k');
  $rangeK.value = K * 100;
  $valueK = document.getElementById('value-k');
  $valueK.textContent = K.toString();

  $rangeK.addEventListener('input', e => {
    K = parseInt($rangeK.value) / 100;
    $valueK.textContent = K.toString();
  });

  $rangeSampleLimit = document.getElementById('range-sample-limit');
  $rangeSampleLimit.value = samplingRateLimit;
  $valueSampleLimit = document.getElementById('value-sample-limit');
  $valueSampleLimit.textContent = limitSamplingRate ? samplingRateLimit.toString() : "unlimited";

  $rangeSampleLimit.addEventListener('input', e => {
    samplingRateLimit = parseInt($rangeSampleLimit.value);
    limitSamplingRate = samplingRateLimit != 1000;
    samplingThreshold = 1000 / samplingRateLimit;
    $valueSampleLimit.textContent = limitSamplingRate ? samplingRateLimit.toString() : "unlimited";
  });

  window.requestAnimationFrame(render);
});

let K = 0.35;

let prevSamplingTime = 0;
let prevRenderTime = 0;
let nextRenderTime = 0;
let lastPointerState;

let image;
let currentStroke = null;
let $canvas;
let ctx;
let dragging;
let fpsCounter;
let samplingCounter = new FPSCounter();

let limitRefreshRate = true;
let refreshRateLimit = 60;
let refreshThreshold = 1000 / refreshRateLimit;

let limitSamplingRate = false;
let samplingRateLimit = 1000;
let samplingThreshold = 1000 / samplingRateLimit;

let limitSamplingDistance = false;
let samplingDistanceThreshold = 10;

let $rangeK;
let $valueK;
let $rangeSampleLimit;
let $valueSampleLimit;

function renderCircles(stroke) {
  for (const sample of stroke.samples) {
    const point = sample.point;
    const x = point.x;
    const y = point.y;
    const radius = sample.pressure * 10;

    ctx.lineWidth = 0.75;
    // const hue = 120*(1-sample.pressure);
    // const hue = 120*sample.pressure+240;
    const hue = 240 * (1 - sample.pressure);
    ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.stroke();
  }
}

function renderStrokeLinear(stroke) {
  ctx.strokeStyle = 'black';
  ctx.beginPath();

  const first = stroke.samples[0];

  if (first != null) {
    ctx.moveTo(first.point.x, first.point.y);
  }

  for (let i = 1; i < stroke.samples.length; i++) {
    const sample = stroke.samples[i];
    const point = sample.point;
    const x = point.x;
    const y = point.y;
    ctx.lineTo(x, y);
  }

  ctx.stroke();
}

function renderStrokeBezier(stroke) {
  ctx.strokeStyle = 'black';
  ctx.beginPath();

  const first = stroke.samples[0];

  if (first != null) {
    ctx.moveTo(first.point.x, first.point.y);
  }

  for (let i = 1; i < stroke.samples.length; i++) {
    const sample = stroke.samples[i];
    const point = sample.point;
    let cpsBegin = calculateCPs(stroke.samples[i - 2]?.point, stroke.samples[i - 1]?.point, stroke.samples[i]?.point);
    let cpsEnd = calculateCPs(stroke.samples[i - 1]?.point, stroke.samples[i]?.point, stroke.samples[i + 1]?.point);
    bezierCurveTo(cpsBegin[1], cpsEnd[0], point);
  }

  ctx.stroke();
}

function renderDebugInfo() {
  const fontSize = 10;
  ctx.fillStyle = 'black';
  ctx.font = `${fontSize}px sans-serif`;
  const debugInfo = [
    `refreshRate: ${fpsCounter.get()}`,
    `samplingRate: ${samplingCounter.get()}`,
    `strokes: ${image.strokes.length}`,
    `samples: ${image.strokes.reduce((p, c) => p + c.samples.length, 0)}`
  ];

  if (lastPointerState != null) {
    for (const [key, value] of Object.entries(lastPointerState)) {
      debugInfo.push(`pointer.${key}: ${value}`);
    }
  }

  for (let i = 0; i < debugInfo.length; i++) {
    ctx.fillText(debugInfo[i], 0, fontSize * (i + 1));
  }
}

function render(time) {
  if (limitRefreshRate && time < nextRenderTime) {
    window.requestAnimationFrame(render);
    return;
  }

  ctx.clearRect(0, 0, $canvas.width, $canvas.height);
  const elapsed = time - prevRenderTime;
  fpsCounter.updateAndCount(time);
  samplingCounter.update(time);

  for (const stroke of image.strokes) {
    renderCircles(stroke);
    renderStrokeBezier(stroke);
  }

  renderDebugInfo();

  prevRenderTime = time;
  nextRenderTime += refreshThreshold;
  window.requestAnimationFrame(render);
}

function bezierCurveTo(cp1, cp2, end) {
  ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
}

// Calculate control points for point b
/*
let K = 0.2;
function calculateCPs(a, b, c) {
  if (a == null || c == null) {
    return [b, b];
  }

  return [c.sub(a).mul(-K).add(b), c.sub(a).mul(K).add(b)];
}
*/

// Calculate control points for point b
function calculateCPs(a, b, c) {
  if (a == null || c == null) {
    return [b, b];
  }

  const ac = c.sub(a);
  const bc = c.sub(b);
  const ab = b.sub(a);

  const ka = K * ab.dot(ac) / ac.length();
  const kb = K * bc.dot(ac) / ac.length();
  return [ac.normalized().mul(-ka).add(b), ac.normalized().mul(kb).add(b)];
}