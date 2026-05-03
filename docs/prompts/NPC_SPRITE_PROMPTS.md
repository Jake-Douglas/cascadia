# NPC & Player Overworld Sprite Prompts

Overworld characters need a 4-direction walk cycle = 12 frames total per character (3 frames per direction: idle, step-left, step-right).

## Master Prompt — Walk Cycle Sheet

```
Pixel art character sprite sheet for a 2D top-down RPG, in the exact style 
of Pokémon Ruby/Sapphire/Emerald (Generation 3, GBA).

Character: [DESCRIPTION — e.g. "young trainer with a dark green hoodie, jeans, 
black hair, a yellow backpack"]

Output as a single PNG sprite sheet, 64x48 pixels total, organized as a 
4x3 grid (4 columns wide, 3 rows tall), where each cell is 16x16 pixels:

         IDLE         STEP-LEFT     STEP-RIGHT
DOWN     [0,0]        [1,0]         [2,0]
LEFT     [0,1]        [1,1]         [2,1]
RIGHT    [0,2]        [1,2]         [2,2]
UP       [0,3]        [1,3]         [2,3]

Wait, that's 4 rows tall, so 64x64 total. Use this layout:
- Column 0: idle frame (standing still)
- Column 1: left foot forward
- Column 2: right foot forward
- Column 3: idle frame again (used for diagonal/transition)
- Row 0: facing down (toward camera)
- Row 1: facing left
- Row 2: facing right
- Row 3: facing up (away from camera)

Specifications:
- Each frame exactly 16x16 pixels
- Transparent background (or magenta #ff00ff for keying)
- 1-pixel solid black outline
- Cel-shaded with 2-tone shading (base + shadow)
- Palette of 4-6 colors per character
- Walking frames show clear leg/arm movement
- All frames maintain same proportions and color choices
- No anti-aliasing
- No background, no UI elements, no text
- Character takes up most of the 16x16 cell (head ~6px tall, body ~10px tall)
```

---

## NPC Variation Tips

To make NPCs feel like a population, vary these axes:
- **Hair color**: black, brown, blond, red, white, gray
- **Outfit color**: pull from biome palette (Cascadia greens/blues, Foothills tans/reds)
- **Body type**: tall/short, slim/round
- **Distinctive item**: hat, glasses, backpack, walking stick
- **Implied role**: school kid, fisher, hiker, scientist, gym trainer

A single town should have 6-10 unique NPCs minimum to feel populated.

---

## Special Character Types

### Player Character
Two variants — boy and girl, same outfit palette so they look like a matched pair. Player chooses at start. Default outfit: olive green raincoat, dark jeans, sturdy boots (Pacific Northwest practical).

### Professor (intro NPC)
- Older, tall, lab coat over plaid shirt (PNW prof not Hoenn beach prof)
- Beard or thick glasses for readability at 16x16
- Generate one walk cycle PLUS a 32x32 "talking" sprite for dialogue close-ups

### Rival
- Same age as player, opposite gender, more vibrant outfit color
- Confident posture even in idle frame

### Gym Leaders
- Memorable silhouette — distinctive hat, hair, accessory
- Outfit telegraphs their type specialty (Bug leader = cargo vest with bug pins, etc.)
- Generate 32x32 portrait for pre-battle dialogue

---

## QA Checklist
- [ ] All 12 frames same size (16x16)
- [ ] Walking animation reads correctly when frames are cycled
- [ ] Character recognizable in all 4 directions (don't just mirror — actually draw front/back differently)
- [ ] Outline is solid 1px black
- [ ] No frame has details that disappear at this resolution
- [ ] Magenta or transparent background

---

## Failure Modes

**"All four directions look the same / mirrored"** → ChatGPT often mirrors instead of drawing back-of-head distinctly. Add: "The UP-facing row must show the BACK of the character's head/body — not a mirrored front view. Show their hair from behind, no face visible."

**"Frames are inconsistent in size"** → Generate one direction at a time if necessary. Then composite manually in an image editor.

**"Walk animation stutters"** → Make sure step-left and step-right are clearly different. Add: "In step-left frame, left leg visibly forward. In step-right frame, right leg visibly forward. Idle frame: both legs together."
