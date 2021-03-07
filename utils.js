const { exec, execSync } = require('child_process');
const fkill = require('fkill');
const readline  = require('readline');

const utils = {
  identifier: 'killcommand-daemon-identifier',

  isDaemonRunning: () => {
    const command = `ps aux | grep "${utils.identifier}" | grep -v grep`;
    try {
      const result = execSync(command).toString();
      if (result && result.length) {
        return result.split(/( +)/g)[2];
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  getTopProcess: () => {
    return new Promise((resolve, reject) => {
      const command = `ps aux | sed 1d | sort -k 3,3 | tail -n 1`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          return resolve({ error });
        }

        const output = stdout.toString().split(/ +/g, 3);
        const usage = parseFloat(output.pop());
        const pid = output.pop();
        if (!pid) {
          return resolve(null);
        }

        return resolve({
          pid,
          usage,
          name: utils.getProcessNameFromPID(pid)
        });
      });
    });
  },

  getProcessNameFromPID : (pid) => {
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
  },

  getProcessesBy: (pidPortOrName, firstOnly = false) => {
    if (isNaN(pidPortOrName)) {
      if (pidPortOrName.startsWith(':')) {
        // looking for who is using port
        const port = parseInt(pidPortOrName.substring(1), 10);
        const command = `lsof -i:${port} | tail -1`;                            // get processe by port
        const result = execSync(command).toString();
        const parts = result.split(/ +/g, 3);
        if (parts.length < 3) {
          return [];
        }

        return [{
          pid: parts[1],
          name: parts[0]
        }];
      }

      // lookinf by its name
      const command = `ps aux | grep -i "\\b${
        pidPortOrName
          .toString()                                                           // ensure it's a string
          .replace(/"/g, '')                                                    // ensure it's not trying to escape or end the command to inject anything
          .replace(/%/g, '.*')                                                  // apply whildcards
      }\\b" | grep -v "\bgrep\b"`;
      const list = execSync(command).toString();
      let c = 0;
      const finalList = [];
      list.split('\n').forEach(line => {
        if (line.match(/(killcommand|\.\/cli\.js)/i)) {
          // the kill command itself
          return;
        }

        const pid = line.split(/( +)/g, 4)[2];
        if (pid) {
          c++;
          finalList.push({
            pid,
            name: utils.getProcessNameFromPID(pid)
          });
        }
      });

      return finalList;
    } else {
      return [{
        pid: pidPortOrName,
        name: utils.getProcessNameFromPID(pidPortOrName)
      }];
    }
  },

  // getRootProcessByName: async (pName) => {
  //   const command = `pgrep -i -o "${pName}"`;
  //   execSync(command).toString();
  // },

  die: async (pid) => {
    await fkill(parseInt(pid, 10));
  },

  top: () => {
    return new Promise((resolve, reject) => {
      const command = 'ps aux | sed 1d | sort -k 3,3 | tail -n 5';
      exec(command, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }

        const list = [];

        stdout
          .split('\n')
          .reverse()
          .forEach((data, i) => {
          const outputStr = data.toString();
          const output = outputStr.split(/ +/g, 3);
          const usage = parseFloat(output.pop());
          const pid = output.pop();
          if (!pid) {
            return;
          }
  
          try {
            list.push({
              pid,
              usage,
              name: utils.getProcessNameFromPID(pid)
            })
          } catch (error) {
            // reject(error);
          }
        });

        resolve(list);
      });
    });
  },

  askQuestion: (query) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    return new Promise(resolve => rl.question(query, ans => {
      rl.close();
      resolve(ans);
    }))
  }
};

module.exports = utils;
