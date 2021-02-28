#!/usr/bin/env node
const { spawn, exec } = require('child_process');
const path = require('path');
const arg = require('arg');
const fkill = require('fkill');

const notifier = require('node-notifier');

const DEFAULT_CPU_THRESHOLD = 75;
const DEFAULT_CPU_LIMIT = 0;
const DEFAULT_INTERVAL = 5;

// const NotificationCenter = require('node-notifier').NotificationCenter;
// const notifier = new NotificationCenter({
//   withFallback: true, // Use Growl Fallback if <= 10.8
//   customPath: path.join(__dirname, "terminal-notifier.app") // Relative/Absolute path to binary if you want to use your own fork of terminal-notifier
// });

let waiting = false;

const commands = {
	// Types
	'--verbose'      : Boolean,
	'--cpu-alert'    : Number,
	'--cpu-limit'    : Number,
	'--interval'     : Number,
	'--ignore'       : [String],
	'--alert-ignored': Boolean,
};
const args = arg(commands);

let ignoredList = args['--ignore'] || [];

function log(...data) {
  if (args['--verbose']) {
    console.log(...data);
  }
}

if (args['--version']) {
  const v = require('./package.json').version;
  console.log(v);
  return;
}

const cpuLimit = args['--cpu-limit'] || DEFAULT_CPU_LIMIT;
const cpuThreshold = args['--cpu-alert'] || DEFAULT_CPU_THRESHOLD;
// TODO: add support to memory limit
// const memLimit = args['--mem-limit'] || DEFAULT_MEM_LIMIT;
// const memThreshold = args['--mem-alert'] || DEFAULT_MEM_THRESHOLD;

function check () {
  if (waiting) {
    return; // reRun();
  }

  const args = [
    '-c',
    `ps aux | sort -k 3,3 | tail -n 1`
    // `aux | tail -n 2`
  ];
  const p = spawn('sh', args);

  p.stdout.on("data", (data) => {
    const outputStr = data.toString();
    const output = outputStr.split(/ +/g, 3);
    const usage = parseFloat(output.pop());
    const pid = output.pop();

    log(`Current top proccess is ${pid}, consumming ${usage}% of CPU`);

    if (usage > cpuThreshold) {
      log(`This corsses the threshold limit for alerts (${cpuThreshold})`);
      exec(`ps -p ${pid} -o comm=`, (error, stdout, stderr) => {
        log(`Looking up for ${pid}'s name`);
        if (error) {
          console.log(`error: ${error.message}`);
          return;
        }

        if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
        }
        
        const program = stdout.substr(stdout.lastIndexOf('/') + 1).trim();
        log(`Found ${program}`);

        let killOnSight = false;
        if (cpuLimit && usage > cpuLimit) {
          killOnSight = true;
          log(`This also corsses the upper limit (${cpuThreshold}) and should be automatically killed`);
        }

        if (
          isIgnored(program, pid)
        ) {
          log(`Program ${program} is in the ignore list.`);
          if (args['--alert-ignored']) {
            log(`But as alert-ignored is true, an alert will be triggered`);
            killOnSight = false;
          } else {
            return;// reRun();
          }
        }

        if (killOnSight) {
          die(pid);
          // reRun();
          return;
        }

        log("Showing notification");
        waiting = true;
        notifier.notify(
          {
            id: pid,
            // remove: 123,
            title: `Should I kill it?`,
            message: `${program} (pid ${pid}) is consuming ${usage}% of your CPU`,
            sound: true,
            wait: true,
            // time: 50000,
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
            log(`Notification closed, got response: `, response, metadata.activationValue);
            waiting = false;
            if (response === 'activate') {
              if (metadata.activationValue === "Ignore it from now on") {
                ignoredList.push(pid);
                log(`Will ignore ${pid} from now on (${program})`)
                return; // reRun();
              }

              if (metadata.activationValue === "Kill it!") {
                die(pid);
                return; // reRun();
              }

              // otherwise, we simply show it some mercy ... for now!
            }
            // reRun();
          }
        );
      });
    } {
      log('Top process is behaving well', waiting);
      // reRun();
    }
  });

  p.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
  
  p.on('close', (code) => {
    console.log('');
    console.log('CLOSED');
    console.log('');
  //   log("Finished, scheduled for the next 5 seconds");
  //   if (!waiting) {
  //     reRun();
  //   }
  //   delete p;
  });
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

async function die (pid, programName) {
  try {
    log(`Will kill ${programName} (${pid})`);
    await fkill(parseInt(pid, 10));
    log(`Done`);
  } catch (error) {
    log(`Failed killing ${programName} (${pid})`, error);
    console.error(error);
    // if failed, the process is probably already gone
  }
}

// function reRun () {
  // setTimeout(check, (args['--interval'] || DEFAULT_INTERVAL) * 1000);
// }

setInterval(check, (args['--interval'] || DEFAULT_INTERVAL) * 1000);
