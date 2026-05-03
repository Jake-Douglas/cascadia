# Trainer Portrait Prompts

Used in dialogue boxes for important characters (player, professor, rival, gym leaders, evil team bosses, etc.). NOT used for ordinary NPCs.

## Style Reference
Pokémon Black/White (Gen 5) style portrait — slightly anime-influenced bust shot, expressive pose, transparent background. Larger and more detailed than overworld sprites.

## Master Prompt — Dialogue Portrait

```
Pixel art character portrait in the style of Pokémon Black/White (Generation 5).
A bust shot (head and upper torso) of [CHARACTER NAME].

Description: [3-5 sentences describing appearance, outfit, personality 
through pose/expression]

Specifications:
- 96x96 pixels
- Transparent background (or magenta #ff00ff for keying)
- 1-pixel solid black outline on all edges
- Cel-shaded with 2-3 tones per surface (more detail allowed than overworld)
- Palette of 8-12 colors
- Character occupies most of the frame, head near top
- Slight 3/4 angle toward viewer, not fully head-on
- Expression matches character personality
- Crisp pixel art, no painterly blending
- No text, no name banner, no border
```

## Pre-Battle Variant
For gym leaders and rivals, generate two portraits:
1. Default (calm, confident)
2. Defeated (slumped, surprised, or impressed)

These swap during battle dialogue based on game state.

## QA Checklist
- [ ] 96x96 pixels exact
- [ ] Magenta or transparent background
- [ ] 1px outline, no anti-aliasing
- [ ] Style matches other portraits (place side by side and compare)
- [ ] Expression and pose convey personality
