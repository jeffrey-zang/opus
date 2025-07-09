## THIS BRANCH IS AN EXPERIMENTAL WINDOWS VERSION AND HAS BEEN TESTED MINIMALLY. I recommend trying "Open gmail" to start. 

There are a few changes from the Mac version which can be found [here](https://github.com/jeffrey-zang/opus)
Some notable changes that you can configure:
- In [ai.ts](https://github.com/adhyaay-karnwal/opus/blob/master/electron/ai.ts) the models are currently set to "gpt-4.1-mini". Feel free to change them for your use
- A [.env.example](https://github.com/adhyaay-karnwal/opus/blob/master/.env.example) file has been created for easier setup.


### **ENV**
A [.env.example](https://github.com/adhyaay-karnwal/opus/blob/master/.env.example) file has been created for easier setup.
Make sure to rename the file name to .env and input your OpenAI api key. The .env file should look something like the following:
```
# OpenAI API Configuration
# Get your API key from https://platform.openai.com/api-keys
OPUS_OPENAI_API_KEY=your_openai_api_key_here
```

###**To run the app do the following:**

1. Install all dependencies
```
npm install
```

2. Setup .env has shown above

3. To run the devlopment server run
```
npm run dev
```

**Production:**
I will add more here for explaining how to build for different devices. For now run:
```
npm run build
```

# disclaimer ⚠️
we haven't published any releases yet because the code is currently quite scrappy, just a POC for the hackathon. 
we are currently working on a rewrite that will come with better build instructions + cleaner code

# opus

In Latin, **"opus"** means:

- **"work"** (as in a task, labor, or artistic creation)
- It can refer to a **physical effort**, a **literary/musical/artistic piece**, or even a **building/construction**.

### Grammatical info:

- **Noun (neuter)**
- Declension: **3rd**
- Singular: _opus_
- Plural: _opera_

### Common phrases:

- **"magnum opus"** – greatest work/masterpiece
- **"opus Dei"** – work of God

## the problem
are you eating right now? clearly not. But let’s say you were. you’re holding a burger in one hand and a shawarma in the other. then you wanted to open the most recent Garf510 video on YouTube for some mealtime entertainment. what would you do huh? you’d be in a real pickle wouldn’t you eh? 

you can’t open youtube without using your fingers, and you don’t want to touch your keyboard because you’ll get it dirty. what do you do?

for too long, humans have lived in a world where they can’t click youtube videos and control their computer while they’re eating two different things at once. that changes today.

## the solution
introducing opus: the ultimate, hands-free ai agent that can do ANYTHING on your computer. by using mouse and keyboard clicks as well as scripting, you can perform and automate any action using just one prompt. 

hands full? simply use your voice to send a verbal prompt, and opus will be able to transcribe your voice and execute your command.

## how it works
opus takes context from:
- your installed apps
- the current screen (screenshot)
- the last 5 actions you’ve taken
it takes this information along with your prompt and feeds it into a series of ai agents that each have specialized roles.

opus will then choose from the following actions:
- running an applescript
- clicking an accessibility ui element
- keypress
- mouse click
to accomplish your task.

opus is the FUTURE of how humans interact with your computers. now just install opus, break your keyboard in half, and eat your burgers in both hands.
