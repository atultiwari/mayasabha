# Your own characters (private, not committed)

Everything in this folder except this README and the example file is ignored by git, so
pictures you use at home stay on your computer.

1. Put pictures in `incoming/`, then prepare each one (trims it, cleans specks, and with
   `--remove-white` removes a plain white background):
   `python3 -I scripts/prepare_character.py assets/custom/incoming/x.png assets/custom/x.png [--remove-white]`
   (run from `mayasabha/`).
2. Copy `characters.example.json` to `characters.json` and edit it.
3. Reload the activity. Phone-remote buttons use your names and icons.

| Field | Meaning |
|---|---|
| role key | `pet`, `elephant`, `monkey`, `mouse`, `penguin`, `banana`, `apple` or `orange` |
| `file` | File name in this folder (no sub-folders) |
| `happyFile` | Optional second picture shown when the character jumps for joy |
| `faces` | Which way the character looks in the picture: `left` (default) or `right` |
| `label`, `icon` | Name and emoji on the phone button |
| `scale` | Size multiplier, 0.3 – 3 |

Ideas: a cat as the `pet` and a mouse as `mouse` gives you a cat chasing a mouse across the wall.
Your child's favourite characters work best, and big full-body pictures are recognised most easily.

**Before posting a video publicly**, remember that cartoon characters belong to their studios;
built-in characters (Noto emoji, Apache 2.0) are always safe to share.

## 3D models (`models/`)

Bhalu Bachao loads GLB files from `models/`: `bear.glb`, `masha_rig.glb` and `toy_train.glb`.
Download from Sketchfab as **GLB** (one file with textures and the skeleton inside), keep the credits
(Sketchfab's "Copy credits") in `models/CREDITS.txt`, and remember that fan-made models of TV characters
are fine for play at home but not for sharing publicly.
