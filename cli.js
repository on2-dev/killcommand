#!/usr/bin/env node

const utils     = require('./utils');
const { spawn } = require('child_process');
const arg       = require('arg');

const DEFAULT_CPU_THRESHOLD = 90;
const DEFAULT_CPU_LIMIT = 0;
const DEFAULT_INTERVAL = 5;

const availableCommands = {
  start     :      `Default action if you don't send any command`,
  stop      :      `Stops the current daemon, if any`,
  top       :      `Shows a list with the current top processes`,
  list      :      `Alias to --list. Shows a list of running processes matching a pattern`,
  kill      :      `Kills a given command by pid, name or port that it's using
                     (See Examples bellow)`,
  // target    :       `Targets a process to be killed whenever it is detected,
  //                    no matter how much process it's using`,
};

const commands = {
	// Types
  '--start'               : Boolean,
  '--stop'                : Boolean,
  '--list'                : Boolean,
	'--help'                : Boolean,
	'--version'             : Boolean,
	'--verbose'             : Boolean,
	'--cpu-alert'           : Number,
	'--cpu-limit'           : Number,
	'--interval'            : Number,
	'--ignore'              : [String],
	'--interactive'         : Boolean,
	'--alert-ignored'       : Boolean,
	'--yes'                 : Boolean,

	// Aliases
	'--watch'               : '--start',
	'-v'                    : '--version',
	'-h'                    : '--help',
	'-i'                    : '--ignore',
	'--alert'               : '--cpu-alert',
	'--limit'               : '--cpu-limit',
	'--no-questions-asked'  : '--yes',
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

Available commands:${
  Object.entries(availableCommands).map(([key, value]) => {
    return `
  ${key.padEnd(19)}${value}`;
  })
}

Available options:
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
  --yes              Will send an Y answer to any possible question

  Examples:

  # just start it with default options
  ~$ killcommand
  # OR
  ~$ killcommand start

  # Stop killcommand
  ~$ killcommand stop

  # See top processes and their names
  ~$ killcommand top

  # Start daemon ignoring glimpse and blender processes
  # Also, will alert if any process reaches 50% of CPU, and automatically kill
  # any process that crosses the 80% limit (except the ignored ones)
  ~$ killcommand --alert=50 --limit=80 --ignore=glimpse --ignore=blender

  # Ignores all chrome processes including their renderers
  ~$ killcommand --ignore="%google%chrome%"

  # Kills all tabs of brave browser
  ~$ killcommand kill "%brave%renderer%"

  # Kills all tabs of brave browser answering yes to any question
  ~$ killcommand kill "%brave%renderer%" --yes
  ~$ # OR
  ~$ killcommand kill "%brave%renderer%" --no-questions-asked

  # Kills whichever program is listening in port 3000
  ~$ killcommand kill :3000

  # Get the name of the process by its PID:
  ~$ killcommand list 1680

  # Get the list of processes from "Google Chrome" browser:
  ~$ killcommand list "chrome"

  # Get the list of processes from "Google Chrome" browser, but only the renderers (tabs):
  ~$ killcommand list "chrome%renderer"
`);

  return;
}

async function run () {
  let keyCommandPosition = 2;
  let keyCommand = Array.from(process.argv).find((item, i) => {
    const found = (!item.match(/^[\.\-\/]/) && availableCommands[item]);
    if (found) {
      keyCommandPosition = i;
    }
    return found;
  }) || 'start';

  if (keyCommand === 'stop' || args['--stop']) {

    // exec('npm run stop', { cwd: __dirname }, (error, stdout, stderr) => {
    //   if (!error) {
    //     console.log('Killcommand finished its job');
    //     console.log('Not running in background anymore');
    //   } else {
    //     console.log('Killcommand wasn\'t running in background');
    //   }
    //   process.exit(0);
    // });
    return;
  }

  // kill command: `killcommand kill [123|xyz|:4321]
  if (keyCommand === 'kill') {
    const killTarget = process.argv[keyCommandPosition + 1];
    if (!killTarget) {
      return console.log('Who\'s the target?');
    }

    if (!isNaN(killTarget)) {
      await utils.die(killTarget);                                                    // should kill by its PID
      return;
    } else {
      if (killTarget.startsWith(':')) {
        const [pid, name] = utils.getProcessesBy(killTarget)[0] || {};
        if (!pid) {
          console.log('Could not find any a target to kill!');
          return;
        }

        if (!args['--yes']) {
          const answer = await utils.askQuestion(`The program ${name} (pid ${pid}) is using this port. Should I kill it? (Y/n)\n> `);
          if (answer.match(/^[nN]/)) {
            return;
          }
        }
        await utils.die(pid);
        console.log('Consider it done');
        return;
      }

      // should kill the process by its name
      const programs = utils.getProcessesBy(killTarget);

      if (!programs.length) {
        return console.log('No processes found matching that name!');
      }

      if (programs.length === 1) {
        await utils.die(programs[0].pid);
        return console.log('Consider it done');
      }

      process.forEach(({pid, name}) => {
        console.log(pid.toString().padEnd(8), name);
      });

      if (!args['--yes']) {
        const answer = await utils.askQuestion(`I found ${programs.length} processes. Should I kill them all? (y/N)\n> `);
        if (!answer.match(/^[yY]/)) {
          // if user answered no
          return;
        }
      }
      
      console.log('Killing ' + (programs.length > 1 ? 'them all...' : 'it'));
      const promises = [];
      programs.forEach(({pid, name}) => {
        promises.push(utils.die(pid));
      });
      await Promise.all(promises);

      console.log('Consider it done');
      return;
    }
    return;
  }
  
  if (keyCommand === 'top' || args['--top']) {
    const lines = await utils.top();
    const line = '+---------+---------+-------------------'
    console.log(line);
    console.log( '|   PID   |   CPU   | Process Name');
    console.log(line);

    lines.forEach(p => {
      console.log(`| ${p.pid.toString().padEnd(7)} | ${(p.usage.toString() + '%').padStart(7)} | ${p.name.substr(-60)}`);
    });

    console.log(line);
    return;
  }

  if (keyCommand === 'list' || args['--list']) {
    // list all processes by name or pid
    const listTarget = process.argv[keyCommandPosition + 1];
    if (!listTarget) {
      return console.log('Who are you looking for?');
    }

    const listOfProcesses = utils.getProcessesBy(listTarget);
    listOfProcesses.forEach(p => {
      console.log(p.pid.toString().padEnd(7), p.name);
    });
    console.log(`${listOfProcesses.length} processes matching "${listTarget}"`);
    return;
  }

  let command = [
    'run',
    args['--interactive'] ? 'interactive' : 'start',
    '--',
    `--cpu-alert=${parseInt(args['--cpu-alert'], 10) || DEFAULT_CPU_THRESHOLD}`,
    `--cpu-limit=${parseInt(args['--cpu-limit'], 10) || DEFAULT_CPU_LIMIT}`,
    `--interval=${parseInt(args['--interval'], 10) || DEFAULT_INTERVAL}`
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
  
  // start
  const running = spawn(
    'npm',
    command,
    {
      shell: true,
      cwd: __dirname,
      detached: !args['--interactive'],
      stdio: 'ignore'
    }
  );

  // running.stdout.on('data', (data) => {
  //   if (args['--verbose']) {
  //     const out = data.toString().trim();
  //     console.log(out);
  //   }
  // });

  // running.stderr.on('data', (data) => {
  //   if (args['--verbose']) {
  //     console.log(data.toString().trim());
  //   }
  // });

  running.on('close', (code) => {});
  console.log('Starting killcommand in background.');
  console.log('To stop it, run `killcommand stop`');

  if (!args['--interactive']) {
    running.unref();
  }
}

run();
