# Kill Command

Will alert or kill processes that cross the limit!
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
| ------------- |:-------------:|
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