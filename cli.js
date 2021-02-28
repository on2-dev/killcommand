#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const arg = require('arg');

const DEFAULT_CPU_THRESHOLD = 75;
const DEFAULT_CPU_LIMIT = 0;
const DEFAULT_INTERVAL = 5;

const commands = {
	// Types
  '--stop'          : Boolean,
  '--list'          : Boolean,
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
	'-v':        '--version',
	'-h':        '--help',
	'-i':        '--ignore',
	'--alert':   '--cpu-alert',
	'--limit':   '--cpu-limit',
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

  --stop             Stops the current daemon, if any
  --list             Shows information on currently running daemon
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
  if (args['--list']) {
    exec('npm run ls');
    console.log('Retrieving the list');
    exec('npm run ls', (error, stdout, stderr) => {
      console.log(stdout);
      process.exit(0);
    });
    return;
  }

  if (args['--stop']) {
    exec('npm run stop', (error, stdout, stderr) => {
      if (!error) {
        // console.error(error, stderr);
        // return process.exit(0);
        console.log('Killcommand finished its job');
        console.log('Not running in background anymore');
      } else {
        console.log('Killcommand wasn\'t running in background');
      }
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
  
  console.log('FINAL COMMAND\nnpm ', command.join(' '));
  
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

  // exec(
  //   command.join(' '),
  //   (error, stdout, stderr) => {
  //   if (error) {
  //     console.error(error, stderr);
  //     return process.exit(0);
  //   }
  //   console.log(stdout, stderr);
  // });
}

run();
