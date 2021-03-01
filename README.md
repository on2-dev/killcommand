# Kill Command

<div style="text-align:center">
  <img src="https://github.com/on2-dev/killcommand/blob/main/killcommand-header.png?raw=true" title="Looking for the new victim" alt="" />
</div>

So...I heard some processes of yours aren't behaving!  
I will hunt the ones that cross the line and let you know. And if you want them gone, just trust your friend here.

You can specify the threshold to be alerted when any process crosses the line,
or even define a limit which should kill any process that dares crossing it!

You're welcome.

![image](https://user-images.githubusercontent.com/347387/109408990-913ca900-796d-11eb-8290-5cf368a7b1d3.png)

![image](https://user-images.githubusercontent.com/347387/109408982-6c483600-796d-11eb-97c6-2e21c7f1a1ec.png)



## Install

```sh
npm install -g killcommand
```

## Running it

```sh
killcommand [--options]
```

## Options

Available options:

| Option, Alias | Description  |
| ------------- |:-------------|
|   --stop             | Stops the current daemon, if any |
|   --list             | Shows information on currently running daemon |
|   --help, -h         | Show this help content |
|   --version, -v      | Shows the current version |
|   --verbose          | Show log/debugging messages |
|   --alert <Int>      | If any process passes this <Int>%, the alert is triggered<br/>Default is 90% |
|   --limit <Int>      | If any process passes this <Int>%, it is killed on sight<br/>Default is 0% (use 0 to  |disable this option)
|   --interval <Int>   | Interval time (in seconds) for checking top processes<br/>Default is 5 |
|   --ignore [Str]     | A list of programs that are ignore |
|   --alert-ignored    | Should show the alert, even for ignored programs when they.<br/>cross the line? |
|   --interactive      | Starts NOT as a daemon, but interactive in the current<br/>terminal. You can use Ctrl+C to exit. |

## Examples:

Just start it with default options:
```sh
~$ killcommand
```

Then stop it:
```sh
~$ killcommand --stop
```

Start daemon with specific limits and ignoring glimpse and blender processes
```sh
~$ killcommand --alert=50 --limit=80 --ignore=glimpse --ignore=blender
```

Ignoring all chrome processes including their renderers
```sh
~$ killcommand --ignore="%google%chrome%"
```

### Developing

If you want to run it locally while applying changes to it, you can clone the project, then run it like this:

```sh
node ./cli.js --interactive --verbose [--other-options]
```

> This way you can see the logs and abort it more easily.

#### Image credits

Header: <a href='https://br.freepik.com/vetores/homem'>Homem vetor criado por freepik - br.freepik.com</a></sub></small>


# Contribute

- By sending Pull Requests
- By sending feedback or opening the issues
- By donating:

Buy us a coffee :)

BTC: 1GuTME1bGbk7hY7ssrUBh3M1k4AeyVCSjW<br/>
ETH: 0x49f1612d4a8e9165f2eb94be79af9dbbf3815af5
