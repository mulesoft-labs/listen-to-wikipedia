function wp_action(data, svg_area, silent) {
    console.log('wp_action');
    var silent = silent || false;
    var now = new Date();
    edit_times.push(now);
    to_save = [];
    if (edit_times.length > 1) {
        for (var i = 0; i < edit_times.length + 1; i ++) {
            var i_time = edit_times[i];
            if (i_time) {
                var i_time_diff = now.getTime() - i_time.getTime();
                if (i_time_diff < 60000) {
                    to_save.push(edit_times[i]);
                }
            }
        }
        edit_times = to_save;
        var opacity = 1 / (100 / to_save.length);
        if (opacity > 0.5) {
            opacity = 0.5;
        }
        /*rate_bg.attr('opacity', opacity)*/
        update_epm(to_save.length, svg_area);
    }

    var size = data.change_size;
    var label_text = data.page_title;
    var csize = size;
    var no_label = false;
    var type;
    type = 'user';

    var circle_id = 'd' + ((Math.random() * 100000) | 0);
    var abs_size = Math.abs(size);
    size = Math.max(Math.sqrt(abs_size) * scale_factor, 3);

    Math.seedrandom(data.page_title)
    var x = Math.random() * (width - size) + size;
    var y = Math.random() * (height - size) + size;
    if (!silent) {
        play_sound();
    }

    if (silent) {
        var starting_opacity = 0.2;
    } else {
        var starting_opacity = 1;
    }

    var circle_group = svg_area.append('g')
        .attr('transform', 'translate(' + x + ', ' + y + ')')
        .attr('fill', edit_color)
        .style('opacity', starting_opacity)

    var ring = circle_group.append('circle')
         .attr({r: size + 20,
                stroke: 'none'})
         .transition()
         .attr('r', size + 40)
         .attr('fill', 'url(#ring)')
         .style('opacity', 0)
         .ease(Math.sqrt)
         .duration(11000) // NOTE: this transition has been overriden in view.css, so if you want to change the duration—do it there.
         .remove();

    var circle_container = circle_group.append('a')
        .attr('fill', '#85dfc4');
        // .attr('xlink:href', data.url)
        // .attr('target', '_blank')

    var circle = circle_container.append('circle')
        .classed(type, true)
        .attr('fill', '#85dfc4')
        .style('filter', 'url(#glow) opacity(50%)')
        .attr('r', size)
        .transition()
        .duration(max_life) // NOTE: this transition has been overriden in view.css, so if you want to change the duration—do it there.
        .style('opacity', 0)
        .each('end', function() {
            circle_group.remove();
        })
        .remove();

    circle_container.on('mouseover', function() {
        if (no_label) {
            no_label = false;
            circle_container.append('text')
                .text(label_text)
                .classed('article-label', true)
                .attr('text-anchor', 'middle')
                .transition()
                .delay(1000)
                .style('opacity', 0)
                .duration(2000)
                .each('end', function() { no_label = true; })
                .remove();
        }

    });

    if (s_titles && !silent) {
        var text = circle_container.append('text')
            .text(label_text)
            .classed('article-label', true)
            .attr('text-anchor', 'middle')
            .transition()
            .delay(1000)
            .style('opacity', 0)
            .duration(2000)
            .each('end', function() { no_label = true; })
            .remove();
    } else {
        no_label = true;
    }
}

authToken = '';

function getAuthToken() {

  return fetch('https://mq-us-east-1.anypoint.mulesoft.com/api/v1/authorize', {
    method: 'POST',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded'
    },
    body: 'client_id=623ee0e97fc34692905ae6c6cf9cb4bf&client_secret=99fD138C4c604C11968e7A6037C1d110&grant_type=client_credentials'
  })
  .then(function (res) {
    return res.json()
  })
  .then(body => {
    authToken = body.access_token
  })
  .catch(function (err) {
    console.error('Problem getting auth token', err)
  });
}

function getMessage() {
  var uri = 'https://mq-us-east-1.anypoint.mulesoft.com/api/v1/organizations/f425e3c1-4229-4e46-b6fe-495ab4b65de0/environments/16342834-9571-4fc1-9ac9-8a144f432644/destinations/audio-monitoring-queue/messages?batchSize=1&poolingTime=0';

  return fetch(uri, {
    headers: {
      'Authorization': 'bearer ' + authToken,
      'Content-type': 'application/json'
    }
  })
  .then(function(res) {
    if (res.status == 204) {
        return [];
    }
    else if (res.status == 401) {
      getAuthToken();
      return null;
    }
    else if (!res.ok) {
        throw new Error('Network response was not ok.');
    }
    return res.json();
  })
  .then(function (msg) {
    if (msg && msg.length > 0) {
      console.log(msg[0]);
      ackMessage(msg[0]);
      return JSON.parse(msg[0].body);
    } else {
      return null;
    }
  })
  .catch(function (err) {
    console.error('Problem getting a message:', err.statusCode)
  });
}

function ackMessage(msg) {
  var uri = 'https://mq-us-east-1.anypoint.mulesoft.com/api/v1/organizations/f425e3c1-4229-4e46-b6fe-495ab4b65de0/environments/16342834-9571-4fc1-9ac9-8a144f432644/destinations/audio-monitoring-queue/messages/' + msg.headers.messageId;

  return fetch(uri, {
    headers: {
      'Authorization': 'bearer ' + authToken,
      'Content-type': 'application/json'
    },
    method: 'DELETE',
    body: JSON.stringify({
      lockId: msg.headers.lockId
    })
  });
}

initMessages = function(svg) {
    svg_area = svg;
}

pollMessages = function() {
    getMessage()
      .then(data => {
          handle_message(data);
      })
      .then(function() {
        if (should_connect) {
            // console.log('Polling');
            setTimeout(pollMessages, 2000);
        }
      });
}

function handle_message(msg) {
    if (!msg) {
        return;
    }

    console.log(msg);
    for (var i = 0; i < Math.min(msg['4xx'].count, 10); i++) {
      emit4xx(i, msg);
    }
    for (var i = 0; i < Math.min(msg['5xx'].count, 10); i++) {
      emit5xx(i, msg);
    }
}

function emit4xx(i, msg) {
  var delay = Math.random() * 5;
  var page_title = i + '4xx' + msg['4xx'].count;
  var url =  "http://www.google.com";
  var change_size = msg['4xx'].count;
  setTimeout(() => {
    console.log(i);
    var ding = new Ding(gctx, calculate_frequency(0, 3), 0.1);
    wp_action({
      page_title: page_title,
      url: url,
      change_size: change_size,
      status: 400
    }, svg_area);
  }, Math.random() * 5000);
}

function emit5xx(i, msg) {
  var delay = Math.random() * 5;
  var page_title = i + '5xx' + msg['4xx'].count;
  var url =  "http://www.google.com";
  var change_size = msg['5xx'].count;
  setTimeout(() => {
    console.log(i);
    var ding = new Ding(gctx, calculate_frequency(0, 4), 2);
    wp_action({
      page_title: page_title,
      url: url,
      change_size: change_size
    }, svg_area);
  }, Math.random() * 5000);
}

// AUDIO STUFF
var reverbNode = {};
var masterGain = {};
var gctx = {};

var drone = {};
var droneIsPlaying = false;

//Ding default ADSR
var dingAttack = 0.01;
var dingDecay = 0.1;
var dingSustain = 1;
var dingRelease = 0.4;

//Initialize
function initAudio(ctx) {
    console.log("Initialized audio");
    gctx = ctx;

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(ctx.destination);

    //Load reverb and create a reverb node
    var reverbUrl = "./sounds/impulses/StPatricksChurchPatringtonPosition1.m4a";
    // var reverbUrl = "./sounds/impulses/MidiverbMark2Preset29.m4a";
    reverbNode = ctx.createReverbFromUrl(reverbUrl, function() {
        reverbNode.connect(masterGain);

        //Ready to hook stuff up!
        // play_drone();
        drone = new Drone( gctx );
        droneIsPlaying = true;
    });
}

//Synthesis functions
function Ding(ctx, freq, r) {
    this.sr = ctx.sampleRate;

    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    var vca  = ctx.createGain();
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();

    filter.frequency.setValueAtTime(calculate_frequency(0), ctx.currentTime);
    filter.Q.setValueAtTime(8, ctx.currentTime);
    filter.type = 'lowpass';

    osc1.type = 'sawtooth';
    osc1.frequency.value = freq;

    osc2.type = 'triangle';
    osc2.frequency.value = calculate_frequency(0);

    vca.gain.value = 0;

    gain.gain.value = 1;


    osc1.connect(filter);
    osc2.connect(filter);

    filter.connect(vca);
    filter.Q.value = 10;

    vca.connect(gain);

    gain.connect(reverbNode);

    osc1.start();
    osc2.start();
    console.log("Created Ding");
    envGenPluck(vca.gain, 1, 0, dingAttack, r);
    envGenPluck(filter.frequency, 1800, 100, dingAttack, dingRelease);
}

// For request events
function Pluck(ctx, freq) {
    this.sr = ctx.sampleRate;
    this.pro = ctx.createScriptProcessor( 512, 0, 1 );
    this.pro.connect( ctx.destination );

    this.play(freq);
}

Pluck.prototype.play = function( freq ) {
  var   N = Math.round( this.sr / freq ),
        impulse = this.sr / 1000,
        y = new Float32Array( N ),
        n = 0;

  this.pro.onaudioprocess = function( e ) {
    var out = e.outputBuffer.getChannelData( 0 ), i = 0, xn;
    for ( ; i < out.length; ++i ) {
      xn = ( --impulse >= 0 ) ? Math.random() - 0.5 : 0;
      out[ i ] = y[ n ] = xn + ( y[ n ] + y[ ( n + 1 ) % N ] ) / 2;
      if ( ++n >= N || !this.playing ) {
        n = 0;
      }
    }
  }.bind( this );
  this.playing = true;
};

Pluck.prototype.pause = function() {
  this.playing = false;
};

// For continuous background noise
function Drone(ctx) {
    this.sr = ctx.sampleRate;
    // this.pro = ctx.createScriptProcessor( 512, 0, 1 );
    // this.pro.connect( ctx.destination );

    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    var lfo1 = ctx.createOscillator();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(calculate_frequency(-36), ctx.currentTime);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(calculate_frequency(-36)+0.5, ctx.currentTime);

    lfo1.type = 'sine';
    lfo1.frequency.value = 0.1;

    var filterLFOGain = ctx.createGain();
    filterLFOGain.gain.value = 100;

    var volumeLFOGain = ctx.createGain();
    volumeLFOGain.gain.value = 0.15;


    var gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.5, ctx.currentTime);

    var gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.5, ctx.currentTime);


    var filter1 = ctx.createBiquadFilter();
    filter1.frequency.setValueAtTime(calculate_frequency(-20), ctx.currentTime);
    filter1.Q.setValueAtTime(8, ctx.currentTime);
    filter1.type = 'lowpass';

    var filter2 = ctx.createBiquadFilter();
    filter2.frequency.setValueAtTime(calculate_frequency(-30), ctx.currentTime);
    filter2.Q.setValueAtTime(12, ctx.currentTime);
    filter2.type = 'lowpass';


    osc1.connect(filter1);
    osc2.connect(filter1);

    lfo1.connect(filterLFOGain);
    filterLFOGain.connect(filter1.frequency);

    lfo1.connect(volumeLFOGain);
    volumeLFOGain.connect(gain1.gain);
    volumeLFOGain.connect(gain2.gain);

    filter1.connect(gain1);
    filter2.connect(gain2);

    gain1.connect(reverbNode);
    gain2.connect(reverbNode);

    // gain1.connect(ctx.destination);
    // gain2.connect(ctx.destination);

    osc1.start();
    osc2.start();
    lfo1.start();

    this.updateSettings = function (rate, growl) {
        //Rate & Growl should both be in the range 0 (default state) to 100 (max state)
        //Rate controls strength and speed of LFO, growl controls volume

        var normRate = rate/100.0
        var normGrowl = growl/100.0

        var minValues = {
            'lfoFreq': 0.1,
            'volumeLFOGain': 0.15,

            'filterLFOGain': 100,
            'filter1Freq': calculate_frequency(-20),
            'filter1Q': 3,
            'filter2Freq': calculate_frequency(-30),
            'filter2Q': 5
        }

        var maxValues = {
            'lfoFreq': 1.5,
            'volumeLFOGain': 0.22,

            'filterLFOGain': 600,
            'filter1Freq': calculate_frequency(12),
            'filter1Q': 15,
            'filter2Freq': calculate_frequency(12),
            'filter2Q': 20
        }

        //Rate settings
        lfo1.frequency.value =      tween(normRate, minValues.lfoFreq, maxValues.lfoFreq);
        volumeLFOGain.gain.value =  tween(normRate, minValues.volumeLFOGain, maxValues.volumeLFOGain);


        //Growl settings
        filterLFOGain.gain.value =  tween(normGrowl, minValues.filterLFOGain, maxValues.filterLFOGain);
        filter1.frequency.value =   tween(normGrowl, minValues.filter1Freq, maxValues.filter1Freq);
        filter1.Q.value=            tween(normGrowl, minValues.filter1Q, maxValues.filter1Q);
        filter1.frequency.value =   tween(normGrowl, minValues.filter2Freq, maxValues.filter2Freq);
        filter1.Q.value=            tween(normGrowl, minValues.filter2Q, maxValues.filter2Q);
    }
}

//Helpers
function tween(amount, start, end) {
    return start + (amount * (end - start));
}

function updateMasterGain(volume) {
    var newGain = volume * 0.3
    masterGain.gain.value = newGain;
    if (newGain < 0.02) {
        masterGain.gain.value = 0;
    }
    // console.log(masterGain.gain.value);
    // drone.updateSettings(volume*100.0, volume*100.0);
}

function envGenPluck(vcaGain, upper, lower, a, r) {
    var now = gctx.currentTime;
    vcaGain.cancelScheduledValues(0);
    vcaGain.setValueAtTime(0, now);
    vcaGain.linearRampToValueAtTime(upper, now + a);
    vcaGain.linearRampToValueAtTime(lower, now + a + r);
}

function envGenOn(vcaGain, a, d, s) {
    var now = gctx.currentTime;
    // a *= egMode;
    // d *= egMode;
    vcaGain.cancelScheduledValues(0);
    vcaGain.setValueAtTime(0, now);
    vcaGain.linearRampToValueAtTime(1, now + a);
    vcaGain.linearRampToValueAtTime(s, now + a + d);
}

function envGenOff(vcaGain, r) {
    var now = gctx.currentTime;
    // r *= egMode;
    vcaGain.cancelScheduledValues(0);
    vcaGain.setValueAtTime(vcaGain.value, now);
    vcaGain.linearRampToValueAtTime(0, now + r);
}

function calculate_frequency(steps, oct) {
    var octave = oct || 4;
    var octave_offset = 12 * (octave - 4);

    var rootNote = 440;
    var a = Math.pow(2,(1.0/12));
    var freq = rootNote*(Math.pow(a, steps+octave_offset));
    // console.log(steps);
    console.log(freq);
    return freq;
}

function random_note() {
    var major_key = [0,2,4,5,7,9,11,12];
    var minor_key = [0,2,3,5,7,8,10,12];
    var selected_key = major_key;

    var octave = 3;
    var octave_offset = 12 * (octave - 4); //because our tuning note A440 is A in the 4th octave

    var index = Math.floor(Math.random() * major_key.length);
    console.log(index);
    return calculate_frequency(selected_key[index], octave);
}

function play_sound() {
    // var pluck = new Pluck( gctx, random_note() );
    // pluck.play( random_note() );

    if (!droneIsPlaying) {
        play_drone();
    }
}

function play_drone() {
    var drone = new Drone( gctx );
    droneIsPlaying = true;
}

function play_random_swell() {
    var index = Math.round(Math.random() * (swells.length - 1));
    swells[index].play();
}

function newuser_action(data, lid, svg_area) {
    play_random_swell();
    var messages = ['Welcome to ' + data.user + ', Wikipedia\'s newest user!',
                    'Wikipedia has a new user, ' + data.user + '! Welcome!',
                    'Welcome, ' + data.user + ' has joined Wikipedia!'];
    var message = Math.round(Math.random() * (messages.length - 1));
    var user_link = 'http://' + lid + '.wikipedia.org/w/index.php?title=User_talk:' + data.user + '&action=edit&section=new';
    var user_group = svg_area.append('g');

    var user_container = user_group.append('a')
        .attr('xlink:href', user_link)
        .attr('target', '_blank');

    user_group.transition()
        .delay(7000)
        .remove();

    user_container.transition()
        .delay(4000)
        .style('opacity', 0)
        .duration(3000);

    user_container.append('rect')
        .attr('opacity', 0)
        .transition()
        .delay(100)
        .duration(3000)
        .attr('opacity', 1)
        .attr('fill', newuser_box_color)
        .attr('width', width)
        .attr('height', 35);

    var y = width / 2;

    user_container.append('text')
        .classed('newuser-label', true)
        .attr('transform', 'translate(' + y +', 25)')
        .transition()
        .delay(1500)
        .duration(1000)
        .text(messages[message])
        .attr('text-anchor', 'middle');

}

var epm_text = false;
var epm_container = {};

function update_epm(epm, svg_area) {
    if (!epm_text) {
        epm_container = svg_area.append('g')
            .attr('transform', 'translate(0, ' + (height - 25) + ')')

        epm_text = epm_container.append('text')
            .classed('newuser-label', true)
            .attr('transform', 'translate(5, 18)')
            .style('font-size', '.8em')
            .text(epm + ' edits per minute');

    } else if (epm_text.text) {
        epm_text.text(epm + ' edits per minute');
    }
}

var tag_area = {},
    tag_text = false,
    tag_box = false;

function getChromeVersion () {
    // From https://stackoverflow.com/questions/4900436/how-to-detect-the-installed-chrome-version
    // Thanks, Dan.
    var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

    return raw ? parseInt(raw[2], 10) : false;
}
