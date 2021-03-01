#!/usr/bin/env node

const { spawn, exec, execSync } = require('child_process');
const arg = require('arg');
const fkill = require('fkill');
const readline = require('readline');

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

const DEFAULT_CPU_THRESHOLD = 90;
const DEFAULT_CPU_LIMIT = 0;
const DEFAULT_INTERVAL = 5;

const availableCommands = {
  start     :      `Default action if you don't send any command`,
  stop      :      `Stops the current daemon, if any`,
  top       :      `Shows a list with the current top processes`,
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

`);

  return;
}

function getProcessNameFromPID (pid) {
  if (!pid) {
    return null;
  }
  try {
    const nameResult = execSync(`ps -p ${pid} -o comm=`).toString();
    const program = nameResult.substr(nameResult.lastIndexOf('/') + 1).trim();
    return program;
  } catch (error) {
    return null;
  }
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

  if (keyCommand === 'kill') {
    const killTarget = process.argv[keyCommandPosition + 1];
    if (!isNaN(killTarget)) {
      // should kill by its PID
      await die(killTarget);
      return;
    } else {
      if (killTarget.startsWith(':')) {
        // should kill the process that uses a given port
        const port = parseInt(killTarget.substring(1), 10);
        const command = `lsof -i:${port} | tail -1`;
        const result = execSync(command).toString();
        const parts = result.split(/ +/g, 3);
        const program = parts[0];
        const pid = parts[1];

        if (!pid) {
          console.log('Could not fine any a target to kill!');
          return;
        }

        if (!args['--yes']) {
          const answer = await askQuestion(`The program ${program} (pid ${pid}) is using this port. Should I kill it? (Y/n)\n> `);
          if (answer.match(/^[nN]/)) {
            return;
          }
        }
        await die(pid);
        console.log('Consider it done');
        return;
      }

      // should kill the process by its name
      const command = `ps -A | grep "\\b${killTarget.replace(/%/g, '.*')}\\b" | grep -v "\bgrep\b"`;
      const list = execSync(command).toString();
      const listOfTargets = {};
      list.split('\n').forEach(line => {
        if (line.match(/(killcommand|\.\/cli\.js) kill /i)) {
          // the kill command itself
          return;
        }
        const pid = line.split(' ', 2)[0];
        const pName = getProcessNameFromPID(pid);
        if (pName) {
          listOfTargets[pid] = pName;
        }
      });

      const keys = Object.keys(listOfTargets);
      if (!keys.length) {
        return console.log('No processes found matching that name!');
      }

      if (keys.length === 1) {
        await die(keys[0]);
        return console.log('Consider it done');
      }

      keys.forEach(pid => {
        console.log(pid.toString().padEnd(8), listOfTargets[pid]);
      });

      if (!args['--yes']) {
        // console.log('I found all these processes. Should I kill them all? (Y/n)');
        const answer = await askQuestion(`I found ${keys.length} processes. Should I kill them all? (y/N)\n> `);
        if (!answer.match(/^[yY]/)) {
          return;
        }
      }
      
      console.log('Killing ' + (keys.length > 1 ? 'them all...' : 'it'));

      const promises = [];
      keys.forEach(pid => {
        promises.push(die(pid));
      });
      await Promise.all(promises);

      console.log('Consider it done');
      return;
      // console.log(list);
    }
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
          // const nameResult = getProcessNameFromPID(pid);
          // const program = nameResult.substr(nameResult.lastIndexOf('/') + 1).trim();
          const program = getProcessNameFromPID(pid);
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

async function die (pid) {
  await fkill(parseInt(pid, 10));
}

run();
