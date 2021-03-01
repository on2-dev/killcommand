#!/usr/bin/env node

const { spawn, exec, execSync } = require('child_process');
const arg = require('arg');

const DEFAULT_CPU_THRESHOLD = 90;
const DEFAULT_CPU_LIMIT = 0;
const DEFAULT_INTERVAL = 5;

const availableCommands = {
  start     :       `Default action if you don't send any command`,
  stop      :       `Stops the current daemon, if any`,
  top       :       `Shows a list with the current top processes`,
  kill      :       `Shows a list with the current top processes`,
  // target    :       `Targets a process to be killed whenever it is detected,
  //                    no matter how much process it's using`,
};

const commands = {
	// Types
  '--start'        : Boolean,
  '--stop'         : Boolean,
  '--list'         : Boolean,
	'--help'         : Boolean,
	'--version'      : Boolean,
	'--verbose'      : Boolean,
	'--cpu-alert'    : Number,
	'--cpu-limit'    : Number,
	'--interval'     : Number,
	'--ignore'       : [String],
	'--interactive'  : Boolean,
	'--alert-ignored': Boolean,

	// Aliases
	'--watch'        : '--start',
	'-v'             : '--version',
	'-h'             : '--help',
	'-i'             : '--ignore',
	'--alert'        : '--cpu-alert',
	'--limit'        : '--cpu-limit',
};

const args = arg(commands);

if (args['--version']) {
  const v = require('./package.json').version;
  console.log(v);
  return;
}

if (args['--help']) {
  console.log(`
Will alert or kill processes that cross the limit!
You can specify the threshold to be alerted when any process corsses the line,
or even define a limit which should kill any process that dares crossing it!

Available options:

  start              Default action if you don't send any command
  stop               Stops the current daemon, if any
  top                Shows a list with the current top processes
  kill               Kills a given process by pid, name or port (examples below)
  --list             Shows information on currently running killcommand daemon
  --help, -h         Show this help content
  --version, -v      Shows the current version
  --verbose          Show log/debugging messages
  --alert <Int>      If any process passes this <Int>%, the alert is triggered
                     Default is ${DEFAULT_CPU_THRESHOLD}%
  --limit <Int>      If any process passes this <Int>%, it is killed on sight
                     Default is ${DEFAULT_CPU_LIMIT}%
  --interval <Int>   Interval time (in seconds) for checking top processes
                     Default is ${DEFAULT_INTERVAL}
  --ignore [Str]     A list of programs that are ignored (case insensitive)
                     You can use % to add unknown parts (see example bellow)
  --alert-ignored    Should show the alert, even for ignored programs when they
                     cross the line?
  --interactive      Starts NOT as a daemon, but interactive in the current
                     terminal. You can use Ctrl+C to exit.

  Examples:

  # just start it with default options
  ~$ killcommand

  # start daemon with specific limits and ignoring glimpse and blender processes
  ~$ killcommand --alert=50 --limit=80 --ignore=glimpse --ignore=blender

  # ignores all chrome processes including their renderers
  ~$ killcommand --ignore="%google%chrome%"

`);

  return;
}

function run () {
  let keyCommandPosition = 2;
  let keyCommand = Array.from(process.argv).find((item, i) => {
    const found = (!item.match(/^[\.\-\/]/) && availableCommands[item]);
    if (found) {
      keyCommandPosition = i;
    }
    return found;
  }) || 'start';

  if (keyCommand === 'stop' || args['--stop']) {
    exec('npm run stop', (error, stdout, stderr) => {
      if (!error) {
        console.log('Killcommand finished its job');
        console.log('Not running in background anymore');
      } else {
        console.log('Killcommand wasn\'t running in background');
      }
      process.exit(0);
    });
    return;
  }
  
  if (keyCommand === 'top' || args['--top']) {
    exec('ps aux | tail +2 | sort -k 3,3 | tail -n 5', (error, stdout, stderr) => {
      const line = '+---------+---------+-------------------'
      console.log(line);
      console.log( '|   PID   |   CPU   | Process Name');
      console.log(line);
      stdout.split('\n').forEach((data, i) => {
        const outputStr = data.toString();
        const output = outputStr.split(/ +/g, 3);
        const usage = parseFloat(output.pop());
        const pid = output.pop();
        if (!pid) {
          return;
        }
        try {
          const nameResult = execSync(`ps -p ${pid} -o comm=`).toString();
          const program = nameResult.substr(nameResult.lastIndexOf('/') + 1).trim();
          const logStr = `| ${pid.toString().padEnd(7)} | ${(usage.toString() + '%').padStart(7)} | ${program.substr(-60)}`
          console.log(logStr);
        } catch (error) {
          
        }
      });
      console.log(line);
    });
    return;
  }

  if (args['--list']) {
    exec('npm run ls', (error, stdout, stderr) => {
      console.log(stdout);
      process.exit(0);
    });
    return;
  }

  let command = [
    'run',
    args['--interactive'] ? 'interactive' : 'start',
    '--',
    `--cpu-alert=${args['--cpu-alert'] || DEFAULT_CPU_THRESHOLD}`,
    `--cpu-limit=${args['--cpu-limit'] || DEFAULT_CPU_LIMIT}`,
    `--interval=${args['--interval'] || DEFAULT_INTERVAL}`
  ];

  if (args['--ignore'] && args['--ignore'].length) {
    args['--ignore'].forEach(ignored => {
      command.push(`--ignore="${ignored.replace(/"/g, '\\"')}"`);
    });
  }

  if (args['--alert-ignored']) {
    command.push('--alert-ignored');
  }

  if (args['--verbose']) {
    command.push('--verbose');
  }
  
  const running = spawn('npm', command, {shell:true});
  running.stdout.on('data', (data) => {
    if (args['--verbose']) {
      const out = data.toString().trim();
      console.log(out);
    }
  });

  running.stderr.on('data', (data) => {
    if (args['--verbose']) {
      console.log(data.toString().trim());
    }
  });

  running.on('close', (code) => {});
  console.log('Starting killcommand in background.');
  console.log('To stop it, run `killcommand --stop`');
}

run();
