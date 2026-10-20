# MayaSabha (मायासभा)

*Created by [Dr. Atul Tiwari](https://atultiwari.com/)*

> *In the Mahabharata, the architect Maya built the Pandavas a hall of illusions, where polished floors
> looked like pools of water and pools looked like floors.*

**MayaSabha turns your living room into a hall of illusions.** A projector, a browser and a phone are all
it takes: characters live on your real walls and hop between your picture frames, and a window opens in
the ceiling to the sky, the sea or the stars. It's made for small children and their families, and runs
fully offline on your home Wi-Fi.

![Ceiling Window: a hole in the ceiling with the sky beyond](docs/ceiling-sky.png)

- **Plain web pages, no install for players.** Fullscreen black pages run on the computer connected to the
  projector. Black projects as no light, so only the magic shows on the wall.
- **Corner-pin warp** fits the picture to any wall, floor or ceiling, even with the projector tilted.
- **Draw ledges** over real objects (frame tops, shelves, door frames) and characters walk and hop on them.
- **Your phone is the remote:** scan the QR code on the home page; buttons appear for whatever is running.
- **Clap to play:** the microphone detects claps and shouts (no audio leaves the computer).
- **Your own characters:** swap in pictures of your child's favourites, kept private and out of git.
- Plain JavaScript ES modules, no build step, one small Node server, 48 unit tests.

## Activities

### Room Pet 🐶

A puppy lives on your wall. It walks along the ledges you drew over your frames, hops between them, eats
fruit you drop from the phone, jumps for joy when someone claps, follows visiting friends (an elephant, a
monkey on a vine, a mouse it chases, a waddling penguin) and falls asleep when left alone.

![Room Pet](docs/room-pet.png)

| Key | Phone | What happens |
|---|---|---|
| 1 2 3 | 🍌 🍎 🍊 | Fruit falls, often onto a frame; the puppy climbs up and eats it |
| 4 5 6 7 | 🐘 🐒 🐭 🐧 | A friend visits: elephant, monkey, mouse (chase!), penguin |
| Space | 🎉 | Jump for joy |
| C B S Z | 🐶 🔊 🪑 💤 | Come / woof / sit / sleep |
| M | – | Microphone on: clap and the puppy jumps |
| E | – | Edit: fit the corners, draw ledges over real objects (G sets the floor line) |
| D | 🎬 | Demo sequence for filming |
| [ ] | – | Puppy smaller / bigger |

Tip for little ones: start with the puppy asleep (Z) and let your child clap to wake it, then let them
choose the fruit on the phone.

### Ceiling Window 🪟

A hole opens in the ceiling. Lie down below it and look up into a **sky** (clouds, birds, balloons that
float away), an **aquarium** (fish, octopus, whale, bubbles) or a **starry night**, while friends **peek
down over the edge**. Bedtime mode fades the stars to black over ten minutes.

![Ceiling Window aquarium](docs/ceiling-sea.png)

| Key | Phone | What happens |
|---|---|---|
| 1 2 3 4 | ☁️ 🐠 🌙 🙈 | Sky / aquarium / stars / peek-a-boo (someone peeks every few seconds) |
| P, Space | per character | Someone peeks in, with a spoken "Peek-a-boo!" |
| N | 😴 | Bedtime: starry night that fades to black over 10 minutes |
| ← → ↑ ↓ | – | Aim the depth at where the viewer lies (the illusion works from one spot) |
| [ ] | – | Hole shallower / deeper |
| O | – | Turn the picture around so faces look upright from where the viewer lies |
| E | – | Fit the 4 corners on the ceiling |

Switch ceiling fans off while projecting. The shaft walls fade to black at the rim, so the border of the
projection melts into the real ceiling.

## Quick start

```bash
git clone https://github.com/atultiwari/mayasabha.git
cd mayasabha
npm install
npm start
```

- **Stage:** open `http://localhost:5190/` **on the computer connected to the projector**. Use `localhost`
  there, because browsers only allow the microphone on `localhost` or https.
- **Phone remote:** the home page shows a QR code and the address (e.g. `http://192.168.x.x:5190/remote/`).
  Scan it with your phone on the same Wi-Fi.

Needs Node 20+ and a modern browser (Chrome, Edge, Safari or Firefox).

### Fitting it to your room (once per spot)

1. Open an activity and press **F** for fullscreen.
2. Press **E**. Drag the 4 numbered corners until the picture sits where you want it.
3. Room Pet only: drag a line along the **top of each real object** characters can stand on (picture frames,
   door frame, shelf). Right-click a line to delete it. Hover where the wall meets the floor and press **G**.
4. Press **E** again. Everything is saved in the browser.

Projection looks best in a dark room. Bright, saturated characters on black read well even with a modest
projector.

## Your own characters

Every role (the pet, the visitors, the fruit) can be played by your own picture, with its own name and
icon on the phone buttons. Put pictures in `assets/custom/`; that folder is git-ignored, so private images
stay on your computer. A helper script trims pictures, removes stray specks and plain white backgrounds:

```bash
python3 -I scripts/prepare_character.py assets/custom/incoming/cat.png assets/custom/cat.png --remove-white
```

See [`assets/custom/README.md`](assets/custom/README.md) for the `characters.json` format.

**Sharing videos?** Cartoon characters belong to their studios. The built-in characters (Google Noto Emoji,
Apache 2.0) are always safe to post.

## How it's built

```
kit/              shared modules every activity uses
  stage.js        black 1920x1080 stage, corner-pin warp (CSS matrix3d), fullscreen, frame loop
  editor.js       edit mode: corner handles, draw/delete ledges, floor line
  warp.js         homography maths (screen <-> stage), geometry.js solves it
  ledges.js       surfaces on the wall, landing, hop rules, route finding
  characters.js   character slots: built-in art or your own pictures
  mic.js clap.js  microphone loudness -> clap events
  sound.js        synthesised sound effects (no audio files)
  remote-link.js  phone remote over a LAN WebSocket relay (protocol.js validates every message)
apps/room-pet/    the puppy: pure state-machine brain, fruit physics, visitors, renderer
apps/ceiling-window/  shaft perspective, scenes, peek-a-boo, bedtime fade
remote/           the phone remote page
server.mjs        static files + WebSocket relay + QR code, LAN only, same-origin, rate-limited
```

New activities go in `apps/<name>/` and reuse the kit. Behaviour logic is kept pure (state in, new state
and effects out), so it is unit-tested without a browser:

```bash
npm test
npm run coverage
```

## Ideas for what's next

Bubble-pop and butterfly walls with MediaPipe hand tracking, floor puddles to stomp on, cushion drums,
sticky-note (or cushion) physics, a wall platformer, an "X-ray mirror". Contributions welcome.

## Credits

- Character, fruit and scene images: [Google Noto Emoji](https://github.com/googlefonts/noto-emoji), Apache
  License 2.0 (see [`assets/ATTRIBUTION.md`](assets/ATTRIBUTION.md)).
- Everything else, including sounds, is drawn or synthesised in code.

## Creator

**Dr. Atul Tiwari** built MayaSabha for his son and family, as a weekend experiment in
turning a home projector into a playground.

<a href="https://atultiwari.com/"><img src="assets/creator-qr.svg" alt="QR code for atultiwari.com" width="140" align="right"></a>

- Website: [atultiwari.com](https://atultiwari.com/)
- GitHub: [@atultiwari](https://github.com/atultiwari)

<br clear="right">

## License

[MIT](LICENSE) © 2026 Dr. Atul Tiwari. Noto Emoji images remain under the Apache License 2.0.
