var firebase = require('firebase');
var _ = require('underscore');
var ws281x = require('rpi-ws281x-native');
var randomColor = require('randomcolor');
var Promise = require("bluebird");

const GameOfLife = require('life-game');
const gradient = require('gradient-color')

const colors = gradient.default([
  '#000000',
  '#FF0000',
  '#FFFF00',
  '#FFFFFF'
], 255)

var brightness = 1.0;
var charlimit = 84;

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

var settingsRef = firebase.database().ref('settings');
settingsRef.on("value", function(snapshot) {
  var snapshotValue = snapshot.val();
  brightness = snapshotValue.brightness;
  charlimit = snapshotValue.charlimit;
});

var hueRef = firebase.database().ref('hue/state');
hueRef.on("value", function(snapshot) {
  var snapshotValue = snapshot.val();
  if (snapshotValue == null) {
    return;
  }

  if (snapshotValue.bri != null) {
      brightness = snapshotValue.bri / 255;
  }
});

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

var animations = ['kit', 'scan', 'tunnel', 'hue', 'twinkle', 'fire']; // 'gameoflife', 'fire'
var activeAnimation = null;

var incomingMessage = false;

var overrideAnim = false;

function runIdleAnimation(anim = null) {
  console.log('runIdleAnimation');

  if (anim == null) {
      activeAnimation = animations[Math.floor(Math.random()*animations.length)];
  } else {
      activeAnimation = anim;
  }

  properties['gameoflife'].game = new GameOfLife(9, 3);
  properties['fire'].heat = [];
  properties['flash'].ledColors = [];
  console.log("animation " + activeAnimation);
}

function update() {
  if (processingMessage == null && queueToProcess.length == 0) {
    if (!runningIdleAnimations) {
        if (!overrideAnim) {
          runIdleAnimation();
          runningIdleAnimations = true;
        }
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
    overrideAnim = false;
    if (processingMessage.type == "text") {
        processingMessage.payload = processingMessage.payload.substring(0, charlimit);
    }
    processingIndex = 0;
    queueToProcess.shift();
  } else {
    switch(processingMessage.type) {
      case "text":
        if (processingIndex >= processingMessage.payload.length) {
          processingMessage = null;
          clearPixels();
          console.log('done');
          return;
        }

        var letter = processingMessage.payload.charAt(processingIndex).toLowerCase();
        var led = letterToLedLookup[letter];
        processingIndex++;
        if (led === undefined) {
          clearPixels();
          return;
        }

        clearPixels();
        var rcolor = randomColor({
           luminosity: 'bright',
           format: 'rgbArray'
        });
        pixelData[led] = rgb2Int(rcolor[0]*brightness,rcolor[1]*brightness,rcolor[2]*brightness);
        ws281x.render(pixelData);

        console.log('letter ' + letter + ' ' + led);

      break;
      case "animation":
        overrideAnim = true;
        runIdleAnimation(processingMessage.payload);
        processingMessage = null;
      break;
    }
  }

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
      return [3 - d, 1 - d, 1.7 - d];
    case 'tunnel':
      var d = Math.sqrt(Math.pow(x - 4, 2) + Math.pow(y - 1, 2)*5);
      return [Math.sin(d - t*2), Math.sin(d - t*3 + 0.1), Math.sin(d - t*1 + 0.2)]
    case 'hue':
      var d = Math.sqrt(Math.pow(x - 4 + Math.sin(t/2.1)*2, 2) + Math.pow(y - 1 + Math.sin(t/5.5), 2)*5);
      return [Math.sin(d+t*5)*0.5 + 0.5, Math.sin(d+t*5 + 1)*0.5 + 0.5, Math.sin(d+t*5 + 2)*0.5 + 0.5]
    case 'flash':
      var f = (1 - Math.abs(1 - t*3) % 1)*0.5;
      return [f*(1.5+Math.sin(x*5+y+t)), f*(1.5+Math.sin(x*3-y+1+t)), f*(1.5+Math.sin(-x*9+y+2+t))]
    default:
      return false;
  }
}

function fix(v) {
  return Math.max(0, Math.min(255, Math.floor(255*v)));
}

var flashRunsForHits = 80;
var currentHits = 0;

var properties = [];
properties['twinkle'] = {
  activeLeds: [],
  lastTime: new Date/1000,
  numberOfTwinkles: 12,
  timeBetweenTwinkles: 1
};
properties['gameoflife'] = {
  lastTime: new Date/1000,
  timeBetween: 1
};
properties['fire'] = {
  cooling: 55,
  sparking: 120,
  heat: []
};
properties['flash'] = {
  colors: [
   [255,0,0],
   [255,120,120],
   [255,255,255],
   [116,214,128],
   [55,139,41]
  ],
  ledColors: []
};

function convertRange( value, r1, r2 ) {
    return ( value - r1[ 0 ] ) * ( r2[ 1 ] - r2[ 0 ] ) / ( r1[ 1 ] - r1[ 0 ] ) + r2[ 0 ];
}

function setLedToColor(x,y,color) {
  var targetLed = xyToLedLookup[y][x];
  if (targetLed.constructor === Array) {
    pixelData[targetLed[0]] = pixelData[targetLed[1]] = color;
  } else {
    pixelData[targetLed] = color;
  }
}

var drawStepTime = 15;
function draw() {
    if (!runningIdleAnimations && !incomingMessage) {
      setTimeout(draw, drawStepTime)
      return;
    }

    if (incomingMessage) {
      currentHits++;
    }

    if (currentHits > flashRunsForHits && incomingMessage) {
      incomingMessage = false;
      currentHits = 0;
      clearPixels();
      setTimeout(draw, drawStepTime)
      return;
    }

    var t = new Date/1000;
    var i = 0;
    for (var y = 0; y < 3; y++) {
      for (var x = 0; x < 9; x++) {
        var result = getColor(x, y, t);
        if (!result) {
          continue;
        }
        const [r,g,b] = result;
        var color = rgb2Int(fix(g)*brightness,fix(r)*brightness,fix(b)*brightness);
        setLedToColor(x,y,color);
        i++;
      }
    }

    var props = properties[activeAnimation];
    switch(activeAnimation) {
      case 'fire':
        // Step 1.  Cool down every cell a little
        var nleds = 27;

        for( var i = 0; i < nleds; i++) {
          if (props.heat[i] != undefined) {
            var value = Math.floor(Math.random() * ((props.cooling * 10) / nleds) + 2);
            props.heat[i] -= value;
            if (props.heat[i] < 0) {
              props.heat[i] = 0;
            }
          } else {
            props.heat[i] = 0;
          }
        }

        // Step 2.  Heat from each cell drifts 'up' and diffuses a little
         for (var y = 0; y < 3; y++) {
          for (var x = 0; x < 9; x++) {
            var i = x + 9 * y;
            if (y == 1) {
              props.heat[i - 9] = props.heat[i] / 5
            } else if (y == 2) {
              props.heat[i - 9] = props.heat[i] / 3
            }
          }
         }
        // props.heat[18] = 255

        for( var k= nleds - 3; k > 0; k--) {
          props.heat[k] = props.heat[k];//(props.heat[k - 1] + props.heat[k - 2] + props.heat[k - 2] ) / 3;
        }

        // Step 3.  Randomly ignite new 'sparks' of heat near the bottom
        if( Math.random() * 255 < props.sparking ) {
          var y = Math.floor(Math.random() * 9 + 18);
          props.heat[y] += Math.random() * 95 + 160;
          if (props.heat[y] > 255) {
            props.heat[y] = 255;
          }
        }

        // Step 4.  Map from heat cells to LED colors
        for( var j = 0; j < nleds; j++) {
          // Scale the heat value from 0-255 down to 0-240
          // for best results with color palettes.
          var colorindex = Math.floor(convertRange(props.heat[j], [0,255], [0,240]));
          var rgb = colors[colorindex].split("(")[1].split(")")[0];;
          rgb = rgb.split(",")
          // var rgb = convert.hex.rgb(c);
          // leds[j] = ColorFromPalette( gPal, colorindex);

          const color = rgb2Int(fix(rgb[0]/255)*brightness,fix(rgb[1]/255)*brightness,fix(rgb[2]/255)*brightness);

          var x = Math.floor(j % 9);
          var y = Math.floor(j / 9);
          setLedToColor(x, y, color);
        }
        break;
    case 'twinkle':
      if (props.activeLeds.length < props.numberOfTwinkles && t - props.lastTime > props.timeBetweenTwinkles) {
        props.lastTime = t;
        props.timeBetweenTwinkles = Math.random() * 1.0 + 0.2;
        var randomLED = Math.floor(Math.random()*26);
        props.activeLeds.push({
          x: Math.floor(randomLED % 9),
          y: Math.floor(randomLED / 9),
          brightness: 1.0
        });
      }

      for (var led = 0; led < props.activeLeds.length; led++) {
        var al = props.activeLeds[led];
        al.brightness -= 0.01;

        const [r,g,b] = [al.brightness, al.brightness, al.brightness]
        const color = rgb2Int(fix(g)*brightness,fix(r)*brightness,fix(b)*brightness);
        setLedToColor(al.x, al.y, color);

        if (al.brightness <= 0) {
          props.activeLeds.splice(led, 1);
        }
      }
      break;
      case 'gameoflife':
      if (t - props.lastTime > props.timeBetween) {
        props.lastTime = t;
        var currentCycle = props.game.cycle();
        props.game.setMap(currentCycle.map);
        for(var led = 0; led < 27; led++) {
          var x = Math.floor(led % 9);
          var y = Math.floor(led / 9);
          setLedToColor(x, y, currentCycle.map[led] ? rgb2Int(255*brightness,0,0) : rgb2Int(0,255*brightness,0))
        }
      }
      break;
    case 'flash':
      if (props.ledColors.length == 0) {
          for( var j = 0; j < 27; j++) {
            props.ledColors[j] = props.colors[Math.floor(Math.random() * props.colors.length)];
            // console.log(props.ledColors[j])
          }
        }

        // console.log(props.ledColors.length)

        for (var led = 0; led < 27; led++) {
          var x = Math.floor(led % 9);
          var y = Math.floor(led / 9);

          var rgb = props.ledColors[led];

          var z = Math.sin(t*20) * 0.5 + 0.5;

          // const c = `rgb(${fix(rgb[0]/255*brightness*z)},${fix(rgb[1]/255*brightness*z)},${fix(rgb[2]/255*brightness*z)})`;
          const color = rgb2Int(fix(rgb[0]/255)*brightness*z,fix(rgb[1]/255)*brightness*z,fix(rgb[2]/255)*brightness*z);

          var x = Math.floor(led % 9);
          var y = Math.floor(led / 9);
          setLedToColor(x, y, color);
        }

    break;
  }

  ws281x.render(pixelData);
  setTimeout(draw, drawStepTime)
}
setTimeout(draw, drawStepTime)

function clearPixels() {
  for (var i = 0; i < NUM_LEDS; i++) {
    pixelData[i] = rgb2Int(0,0,0);
  }
  ws281x.render(pixelData);
}

function rgb2Int(r, g, b) {
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff);
}
