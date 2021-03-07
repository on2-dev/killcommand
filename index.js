#!/usr/bin/env node
const path            = require('path');
const arg             = require('arg');
const utils           = require('./utils');
const notifier        = require('node-notifier');

const DEFAULT_CPU_THRESHOLD = 75;
const DEFAULT_CPU_LIMIT     = 0;
const DEFAULT_INTERVAL      = 5;
let   LATAST_TOP_PROC       = null;                                             // TODO: warn only if the same process is abot the line twice

// const NotificationCenter = require('node-notifier').NotificationCenter;
// const notifier = new NotificationCenter({
//   withFallback: true, // Use Growl Fallback if <= 10.8
//   customPath: path.join(__dirname, "terminal-notifier.app") // Relative/Absolute path to binary if you want to use your own fork of terminal-notifier
// });

let waiting = false;

const commands = {
	// Types
	'--interactive'  : Boolean,
	'--verbose'      : Boolean,
	'--cpu-alert'    : Number,
	'--cpu-limit'    : Number,
	'--interval'     : Number,
	'--ignore'       : [String],
	'--alert-ignored': Boolean,
	'--killcommand-daemon-identifier': Boolean,
};
const args = arg(commands);

let ignoredList = args['--ignore'] || [];
function log(...data) {
  if (args['--verbose']) {
    console.log(...data);
  }
}

const cpuLimit = args['--cpu-limit'] || DEFAULT_CPU_LIMIT;
const cpuThreshold = args['--cpu-alert'] || DEFAULT_CPU_THRESHOLD;
// TODO: add support to memory limit

async function check () {
  log('+-- CHECKING --');
  if (waiting) {
    return;
  }

  const {pid, usage, name, error} = await utils.getTopProcess() || {};
  if (error) {
    console.error(error);
    return;
  }

  log(`| Current top proccess is ${name}(${pid}), consumming ${usage}% of CPU`);

  if (usage > cpuThreshold) {
    log(`| This crosses the threshold limit for alerts (${cpuThreshold})`);
    let killOnSight = false;
    if (cpuLimit && usage > cpuLimit) {
      killOnSight = true;
      log(`| This also crosses the upper limit (${cpuThreshold}) and should be automatically killed`);
    }

    if (isIgnored(name, pid)) {
      log(`| Program ${name} is in the ignore list.`);
      if (args['--alert-ignored']) {
        log(`| But as alert-ignored is true, an alert will be triggered`);
        killOnSight = false;
      } else {
        return;
      }
    }

    if (killOnSight) {
      utils.die(pid);
      return;
    }

    if (LATAST_TOP_PROC === pid) {
      // it's the second time in [interval] seconds that this same process is
      // crossing the alert limit
      log("| Showing notification");
      waiting = true;
      notifier.notify(
        {
          id: pid,
          title: `Should I kill it?`,
          message: `${name} (pid ${pid}) is consuming ${usage}% of your CPU`,
          sound: true,
          wait: true,
          timeout: 50000,
          type: 'warn',
          contentImage: "https://github.com/on2-dev/killcommand/raw/main/killcommand-header.png?raw=true",
          icon: path.join(__dirname, "killcommand-header.png"),
          open: undefined,
          closeLabel: undefined,
          dropdownLabel: undefined,
          actions: ["Kill it!", "Show mercy", "Ignore it from now on"],
          sound: "glass" //Sosumi, Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping, Pop, Purr, Submarine, Tink
        },
        async function (err, response, metadata) {
          log(`| Notification closed, got response: `, response, metadata.activationValue);
          waiting = false;
          if (response === 'activate') {
            if (metadata.activationValue === "Ignore it from now on") {
              ignoredList.push(pid);
              log(`| Will ignore ${pid} from now on (${name})`)
              return;
            }

            if (metadata.activationValue === "Kill it!") {
              utils.die(pid);
              return;
            }
          }
        }
      );
    } else {
      LATAST_TOP_PROC = pid;
    }
  } {
    log('| Top process is behaving well');
  }
}

function isIgnored (program, pid) {
  const found = ignoredList.find(ignored => {
    if (pid && ignored === pid) {
      return true;
    }

    const rx = new RegExp(`^${ignored.replace(/\%/g, '(.*)?')}$`, 'i');
    if (program.match(rx)) {
      return true;
    }
    return false;
  });

  return !!found;
}

setInterval(check, (args['--interval'] || DEFAULT_INTERVAL) * 1000);
