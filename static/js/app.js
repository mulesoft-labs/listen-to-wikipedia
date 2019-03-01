function wp_action(data, svg_area, silent) {
    var silent = silent || false;
    if (!silent) {
        total_edits += 1;
    }
    if (total_edits == 1) {
        $('#edit_counter').html('You have listened to <span>' + total_edits + ' edit</span>.');
    } else {
        $('#edit_counter').html('You have listened to a total of <span>' + insert_comma(total_edits) + ' edits</span>.');
    }
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

    msg.page_title = 'title + ' + Date.now();
    msg.url = 'dd';

    wp_action(msg, svg_area);
}



// AUDIO STUFF
var reverbNode = {};
var gctx = {};
var droneIsPlaying = false;

//Ding ADSR
var dingAttack = 0.001;
var dingDecay = 0.1;
var dingSustain = 1;
var dingRelease = 0.4;

function initAudio(ctx) {
    console.log("Initialized audio");
    gctx = ctx;

    //Load reverb and create a reverb node
    var reverbUrl = "./sounds/impulses/StPatricksChurchPatringtonPosition1.m4a";
    var reverbUrl = "./sounds/impulses/MidiverbMark2Preset29.m4a";
    reverbNode = ctx.createReverbFromUrl(reverbUrl, function() {
        reverbNode.connect(ctx.destination);

        //Ready to hook stuff up!
        play_drone();
    });
}

function Ding(ctx, freq) {
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

    vca.connect(gain);

    gain.connect(reverbNode);

    osc1.start();
    osc2.start();
    console.log("Created Ding");
    envGenPluck(vca.gain, 1, 0, dingAttack, dingRelease);
    envGenPluck(filter.frequency, 2000, 300, dingAttack, dingRelease);
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
    filterLFOGain.gain.value = 300;

    var volumeLFOGain = ctx.createGain();
    volumeLFOGain.gain.value = 0.4;


    var gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.4, ctx.currentTime);

    var gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.2, ctx.currentTime);


    var filter1 = ctx.createBiquadFilter();
    filter1.frequency.setValueAtTime(calculate_frequency(0), ctx.currentTime);
    filter1.Q.setValueAtTime(8, ctx.currentTime);
    filter1.type = 'lowpass';

    var filter2 = ctx.createBiquadFilter();
    filter2.frequency.setValueAtTime(calculate_frequency(-20), ctx.currentTime);
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

    reverbNode.connect(ctx.destination);

    osc1.start();
    osc2.start();
    lfo1.start();
}


//Helpers
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

function calculate_frequency(steps) {
    var rootNote = 440;
    var a = Math.pow(2,(1.0/12));
    var freq = rootNote*(Math.pow(a, steps));
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
    return calculate_frequency(selected_key[index] + octave_offset);
}

function play_sound() {
    // var pluck = new Pluck( gctx, random_note() );
    // pluck.play( random_note() );

    var ding = new Ding(gctx, random_note());

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

var return_hash_settings = function() {
    var hash_settings = window.location.hash.slice(1).split(',');
    for (var i = 0; i < hash_settings.length + 1; i ++) {
        if (hash_settings[i] === '') {
            hash_settings.splice(i, 1);
        }
    }
    return hash_settings;
};

var return_lang_settings = function() {
    return [];
};

var set_hash_settings = function (langs) {
    if (langs[0] === '') {
        langs.splice(0, 1);
    }
    window.location.hash = '#' + langs.join(',');
};

var enable = function(setting) {
    var hash_settings = return_hash_settings();
    if (setting && hash_settings.indexOf(setting) < 0) {
        hash_settings.push(setting);
    }
    set_hash_settings(hash_settings);
};

var disable = function(setting) {
    var hash_settings = return_hash_settings();
    var setting_i = hash_settings.indexOf(setting);
    if (setting_i >= 0) {
        hash_settings.splice(setting_i, 1);
    }
    set_hash_settings(hash_settings);
};

window.onhashchange = function () {
    var hash_settings = return_hash_settings();
    for (var lang in SOCKETS) {
        if (hash_settings.indexOf(lang) >= 0) {
            if (!SOCKETS[lang].connection || SOCKETS[lang].connection.readyState == 3) {
                SOCKETS[lang].connect();
                $('#' + lang + '-enable').prop('checked', true);
            }
        } else {
            if ($('#' + lang + '-enable').is(':checked')) {
                $('#' + lang + '-enable').prop('checked', false);
            }
            if (SOCKETS[lang].connection) {
                SOCKETS[lang].close();
            }
        }
    }
    if (hash_settings.indexOf('notitles') >= 0) {
        s_titles = false;
    } else {
        s_titles = true;
    }
    if (hash_settings.indexOf('nowelcomes') >= 0) {
        s_welcome = false;
    } else {
        s_welcome = true;
    }
    set_hash_settings(hash_settings);
};

var make_click_handler = function($box, setting) {
    return function() {
            if ($box.is(':checked')) {
                enable(setting);
            } else {
                disable(setting);
            }
        };
};

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

function update_tag_warning(svg_area) {
    if (TAG_FILTERS.length == 0) {
        if (!$.isEmptyObject(tag_area)) {
            tag_area.remove();
            tag_area = {}, tag_text = false;
        }
        return
    }
    if (!tag_text) {
        tag_area = svg_area.append('g');
        tag_box = tag_area.append('rect')
            .attr('fill', newuser_box_color)
            .attr('opacity', 0.5)
            .attr('height', 25);
        tag_text = tag_area.append('text')
            .classed('newuser-label', true)
            .attr('transform', 'translate(5, 18)')
            .style('font-size', '.8em');
    }
    tag_area.attr('transform', 'translate(0, ' + (height - 50) + ')');
    tag_text.text('Listening to: #' + TAG_FILTERS.join(', #'));
    var tag_bbox = tag_text.node().getBBox();
    tag_box.attr('width', tag_bbox.width + 10);
    s_welcome = false;
}

var insert_comma = function(s) {
    s = s.toFixed(0);
    if (s.length > 2) {
        var l = s.length;
        var res = "" + s[0];
        for (var i=1; i<l-1; i++) {
            if ((l - i) % 3 == 0)
                res += ",";
            res +=s[i];
        }
        res +=s[l-1];

        res = res.replace(',.','.');

        return res;
    } else {
        return s;
    }
}

function getChromeVersion () {
    // From https://stackoverflow.com/questions/4900436/how-to-detect-the-installed-chrome-version
    // Thanks, Dan.
    var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

    return raw ? parseInt(raw[2], 10) : false;
}
