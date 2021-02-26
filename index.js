const { spawn } = require('child_process');
const { exec } = require("child_process");
const arg = require('arg');
const fkill = require('fkill');

const notifier = require('node-notifier');

const console = require('console');

const DEFAULT_CPU_THRESHOLD = 75;
const DEFAULT_CPU_LIMIT = 0;
const DEFAULT_INTERVAL = 5;
let waiting = false;

const commands = {
	// Types
	'--help'         : Boolean,
	'--version'      : Boolean,
	'--verbose'      : Boolean,
	'--cpu-alert'    : Number,
	'--cpu-limit'    : Number,
	'--mem-alert'    : [String],
	'--mem-limit'    : [String],
	'--interval'     : Number,
	'--ignore'       : [String],
	'--alert-ignored': Boolean,

	// Aliases
	'-v':        '--version',
	'-h':        '--help',
	'-i':        '--ignore',
	'--alert':   '--cpu-alert',
	'--limit':   '--cpu-limit',
};
const args = arg(commands);

if (args['--help']) {
  console.log(`
Will alert or kill processes that cross the limit!
You can specify the threshold to be alerted when any process corsses the line,
or even define a limit which should kill any process that dares crossing it!

Available options:

  --help, -h         Show this help content
  --version, -v      Shows the current version
  --verbose          Show log/debugging messages
  --alert <Int>      If any process passes this <Int>%, the alert is triggered
                     Default is ${DEFAULT_CPU_THRESHOLD}%
  --limit <Int>      If any process passes this <Int>%, it is killed on sight
                     Default is ${DEFAULT_CPU_LIMIT}%
  --interval <Int>   Interval time (in seconds) for checking top processes
                     Default is ${DEFAULT_INTERVAL}
  --ignore [Str]     A list of programs that are ignore
  --alert-ignored    Should show the alert, even for ignored programs when they
                     cross the line?

  Examples:

  killcommand --alert=50 --limit=80 --ignore=gimp --ignore=blender
`);

  return;
}

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
      waiting = true;
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
        
        const program = stdout.substr(stdout.lastIndexOf('/') + 1);
        log(`Found ${program}`);

        let killOnSight = false;
        if (cpuLimit && usage > cpuLimit) {
          killOnSight = true;
          log(`This also corsses the upper limit (${cpuThreshold}) and should be automatically killed`);
        }

        if (
          ignoredList.includes(program) || ignoredList.includes(pid)
        ) {
          log(`Program ${program} is in the ignore list.`);
          if (args['--alert-ignored']) {
            log(`But as alert-ignored is true, an alert will be triggered`);
            killOnSight = false;
          } else {
            return reRun();
          }
        }

        if (killOnSight) {
          die(pid);
          reRun();
          return;
        }

        log("Showing notification");
        notifier.notify(
          {
            title: `Should I kill it?`,
            message: `${program} (${pid}) is consuming ${usage}% of your CPU`,
            sound: true,
            wait: true,
            timeout: 50,
            // closeLabel: false,
            actions: ["Kill it!", "Show mercy", "Ignore it from now on"],
            sound: "glass" //Sosumi, Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping, Pop, Purr, Submarine, Tink
          },
          async function (err, response, metadata) {
            log(`Notification closed, got response: `, response, metadata.activationValue);
            waiting = false;
            if (response === 'activate') {
              if (metadata.activationValue === "Ignore it from now on") {
                ignoredList.push(pid);
                return;
              }

              if (metadata.activationValue === "Kill it!") {
                die(pid);
                return;
              }

              // otherwise, we simply show it some mercy ... for now!
            }
            reRun();
          }
        );
      });
    }
  });

  p.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
  
  p.on('close', (code) => {
    log("Finished, scheduled for the next 5 seconds");
    if (!waiting) {
      reRun();
    }
    delete p;
  });
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

function reRun () {
  setTimeout(check, (args['--interval'] || DEFAULT_INTERVAL) * 1000);
}

check();
