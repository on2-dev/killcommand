# Kill Command

<div style="text-align:center">
  <img src="https://github.com/on2-dev/killcommand/blob/main/killcommand-header.png?raw=true" title="Looking for the new victim" alt="" />
</div>


So, I heard some processes of yours aren't behaving!  
I will hunt the ones that cross the line and let you know. And if you want them gone, just trust your friend here.

You can specify the threshold to be alerted when any process corsses the line,
or even define a limit which should kill any process that dares crossing it!

## Install

```sh
npm install -g killcommand
# or
yarn global add killcommand
```

## Running it

```sh
killcommand
```

## Options

Available options:

| Option, Alias | Description  |
| ------------- |:-------------|
|   --help, -h         | Show this help content
|   --version, -v      | Shows the current version
|   --verbose          | Show log/debugging messages
|   --alert <Int>      | If any process passes this <Int>%, the alert is triggered<br/>Default is 75%
|   --limit <Int>      | If any process passes this <Int>%, it is killed on sight<br/>Default is 0% (use 0 to disable this option)
|   --interval <Int>   | Interval time (in seconds) for checking top processes<br/>Default is 5
|   --ignore [Str]     | A list of programs that are ignore
|   --alert-ignored    | Should show the alert, even for ignored programs when they.<br/>cross the line?

  Examples:

```sh
killcommand --alert=50 --limit=80 --ignore=gimp --ignore=blender
```

#### Image credits

Header: <a href='https://br.freepik.com/vetores/homem'>Homem vetor criado por freepik - br.freepik.com</a></sub></small>


# Contribute

- By sending Pull Requests
- By sending feedback or opening the issues
- By donating:

Buy us a beer :)

BTC: 1GuTME1bGbk7hY7ssrUBh3M1k4AeyVCSjW<br/>
ETH: 0x49f1612d4a8e9165f2eb94be79af9dbbf3815af5


