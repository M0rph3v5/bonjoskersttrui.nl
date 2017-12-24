var firebase = require('firebase');
var _ = require('underscore');
var ws281x = require('rpi-ws281x-native');
var randomColor = require('randomcolor');
var Promise = require("bluebird");

var NUM_LEDS = 28,
    pixelData = new Uint32Array(NUM_LEDS);

ws281x.init(NUM_LEDS);
clearPixels();

var config = {
    apiKey: "AIzaSyAIvBavLJus49cN06IeypKvtwQ_fFH7MjY",
    authDomain: "kersttrui-4fa32.firebaseapp.com",
    databaseURL: "https://kersttrui-4fa32.firebaseio.com",
    projectId: "kersttrui-4fa32"
  };
firebase.initializeApp(config);

var queueToProcess = [];
var processingMessage = null;
var processingIndex = 0;

var runningIdleAnimations = false;

var messagesRef = firebase.database().ref('messages/queue');
messagesRef.on("value", function(snapshot) {
  var messages = [];
  var snapshotValue = snapshot.val();
  for (const key in snapshotValue) {
    if (!snapshotValue.hasOwnProperty(key)) continue;
    const value = snapshotValue[key];
    messages.push(value);
    firebase.database().ref("messages/processed").push(value);
    firebase.database().ref("messages/queue/"+key).remove();    
  }

  messages = _.sortBy(messages, function(input) {
    return input.time;
  });

  queueToProcess = queueToProcess.concat(messages);
  console.log(queueToProcess);
}, function (errorObject) {
  console.log("The read failed: " + errorObject.code);
});

var letterToLedLookup = {
  a: 9,
  b: 8,
  c: 7,
  d: 6,
  e: 5,
  f: 4,
  g: 3,
  h: 2,
  i: 1,
  j: 0,
  k: 10,
  l: 11,
  m: 12,
  n: 13,
  o: 14,
  p: 15,
  q: 16,
  r: 17,
  s: 18,
  t: 27,
  u: 26,
  v: 25,
  w: 24,
  x: 23,
  y: 22,
  z: 21,
  '?': 20,
  '!': 19
}

var xyToLedLookup = [
  [9,8,7,6,5,4,3,2,[0,1]],
  [10,11,12,13,14,15,16,17,18],
  [27,26,25,24,23,22,21,20,19],
];

var animations = ['kit', 'scan', 'tunnel', 'hue'];
var activeAnimation = null;

var incomingMessage = false;

function runIdleAnimation() {
  console.log('runIdleAnimation');
  activeAnimation = animations[Math.floor(Math.random()*animations.length)];
  console.log("animation " + activeAnimation);

  // var rcolor = randomColor({
  //    luminosity: 'bright',
  //    format: 'rgbArray'
  // });
  //
  // var rcolor2 = randomColor({
  //    luminosity: 'bright',
  //    format: 'rgbArray'
  // });
  //
  // for (var i = 0; i < NUM_LEDS; i++) {
  //   var c = i%2 ? rcolor : rcolor2;
  //   pixelData[i] = rgb2Int(c[0],c[1],c[2]);
  //   ws281x.render(pixelData);
  //   await Promise.delay(100);
  // }
  //
  // await Promise.delay(1000);
  // runningIdleAnimations = false;
}

function update() {
  if (processingMessage == null && queueToProcess.length == 0) {
    if (!runningIdleAnimations) {
        runIdleAnimation();
        runningIdleAnimations = true;
    }
    return;
  }

  if (runningIdleAnimations) {
    runningIdleAnimations = false;
    clearPixels();
    incomingMessage = true;
    activeAnimation = 'flash';
    return;
  }

  if (incomingMessage) {
    return;
  }

  if (processingMessage == null) {
    processingMessage = queueToProcess[0];
    processingIndex = 0;
    queueToProcess.shift();
  } else {
    processingIndex++;
    if (processingIndex >= processingMessage.message.length) {
      processingMessage = null;
      clearPixels();
      console.log('done');
      return;
    }
  }

  var letter = processingMessage.message.charAt(processingIndex).toLowerCase();
  var led = letterToLedLookup[letter];
  if (led === undefined) {
    clearPixels();
    return;
  }

  clearPixels();
  var rcolor = randomColor({
     luminosity: 'bright',
     format: 'rgbArray'
  });
  pixelData[led] = rgb2Int(rcolor[0],rcolor[1],rcolor[2]);
  ws281x.render(pixelData);

  console.log('letter ' + letter + ' ' + led);
}
setInterval(update, 1000);

process.on('SIGINT', function () {
  ws281x.reset();
  process.nextTick(function () { process.exit(0); });
});

function getColor(x, y, t) {
  switch (activeAnimation) {
    case 'kit':
      return [1.2 - Math.abs(x - (4 + Math.sin(t*2)*5))*(0.4 + 0.1*Math.abs(1 - y)), 0, 0];
    case 'scan':
      var d = Math.abs(y - 1 - 3*Math.sin(t*5) + x/5*Math.sin(t));
      return [1 - d, 2 - d, 1.7 - d];
    case 'tunnel':
      var d = Math.sqrt(Math.pow(x - 4, 2) + Math.pow(y - 1, 2)*5);
      return [Math.sin(d - t*10), Math.sin(d - t*10 + 0.1), Math.sin(d - t*10 + 0.2)]
    case 'hue':
      var d = Math.sqrt(Math.pow(x - 4 + Math.sin(t/2.1)*2, 2) + Math.pow(y - 1 + Math.sin(t/5.5), 2)*5);
      return [Math.sin(d+t*5)*0.5 + 0.5, Math.sin(d+t*5 + 1)*0.5 + 0.5, Math.sin(d+t*5 + 2)*0.5 + 0.5]
    case 'flash':
      var f = (1 - Math.abs(1 - t*3) % 1)*0.5;
      return [f*(1.5+Math.sin(x*5+y+t)), f*(1.5+Math.sin(x*3-y+1+t)), f*(1.5+Math.sin(-x*9+y+2+t))]
  }
}

function fix(v) {
  return Math.max(0, Math.min(255, Math.floor(255*v)));
}

var flashRunsForHits = 80;
var currentHits = 0;

function draw() {

  if (!runningIdleAnimations && !incomingMessage) {
    setTimeout(draw, 15)
    return;
  }

  if (incomingMessage) {
    currentHits++;
  }

  if (currentHits > flashRunsForHits && incomingMessage) {
    incomingMessage = false;
    currentHits = 0;
    clearPixels();
    setTimeout(draw, 15)
    return;
  }

  var t = new Date/1000;
  var i = 0;
  for (var y = 0; y < 3; y++) {
    for (var x = 0; x < 9; x++) {
      const [r,g,b] = getColor(x, y, t);
      var color = rgb2Int(fix(g),fix(r),fix(b));

      var targetLed = xyToLedLookup[y][x];
      if (targetLed.constructor === Array) {
        pixelData[targetLed[0]] = pixelData[targetLed[1]] = color;
      } else {
        pixelData[targetLed] = color;
      }

      i++;
    }
  }

  ws281x.render(pixelData);
  setTimeout(draw, 15)
}
setTimeout(draw, 15)

function clearPixels() {
  for (var i = 0; i < NUM_LEDS; i++) {
    pixelData[i] = rgb2Int(0,0,0);
  }
  ws281x.render(pixelData);
}

function rgb2Int(r, g, b) {
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}
