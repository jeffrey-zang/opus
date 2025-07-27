<img width="237" height="136" alt="banner" src="https://github.com/jeffrey-zang/opus/blob/master/assets/banner.png" />

# Opus

Opus is an on-device computer-use app for MacOS that works **fully in the background**.

Current computer use solutions are slow, expensive, or limited in some way. Opus takes a new approach by programmatically interacting with apps using AppleScript, the MacOS API, and a other tools. Additionally, Opus is able to work 100% in the background without restricting any sort of functionality from the user.

## How it works

At its core, Opus is a set of LLM-friendly tools that can perform tasks. It can take context from:

- the current UI elements
- the current selected UI element
- any app's AppleScript dictionaries
- the current screen (screenshot)
- the user's installed apps
- previous tool calls it has made

Opus will then choose from the following actions:

- running an AppleScript
- clicking an element
- running a Bash script
- visiting a URI
- keypress
- mouse click

to accomplish the user's task.

## Getting Started

### Setup

Clone the repo into a public GitHub repository (or fork https://github.com/jeffrey-zang/opus/fork).

```
git clone https://github.com/jeffrey-zang/opus/fork
```

Go to the project folder

```
cd opus/app
```

Install packages with bun

```
bun i
```

Set up your .env file

- Duplicate .env.template to .env
- Insert your OpenAI API key

## Etymology

In Latin, **"opus"** means:

- **"work"** (as in a task, labor, or artistic creation)
- It can refer to a **physical effort**, a **literary/musical/artistic piece**, or even a **building/construction**.

### Common phrases:

- **"magnum opus"** – greatest work/masterpiece
- **"opus Dei"** – work of God
