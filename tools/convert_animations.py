#!/usr/bin/env python3
"""
convert_animations.py

Reads Pokémon Essentials' PkmnAnimations.rxdata (a Ruby Marshal-serialized
PBAnimations object containing all move animations) and writes Cascadia-format
JSON files plus copies the relevant sprite sheets and audio.

USAGE:
  python3 tools/convert_animations.py path/to/anim_pack/ assets/animations/

The pack folder must have this structure (the standard Eevee Expo distribution):
  anim_pack/
    Data/PkmnAnimations.rxdata
    Graphics/Animations/<sheet>.png
    Audio/SE/Anim/<sound>.ogg

Output:
  <output>/json/<move_id>.json
  <output>/sheets/<sheet>.png   (copied as referenced)
  <output>/sounds/<sound>.ogg   (copied as referenced)

REQUIREMENTS:
  Python 3.7+, no external packages. Uses only stdlib.

REQUIRES:
  Python 3, no external packages. Uses only stdlib (struct, json, shutil, etc).
"""

import io
import struct
import json
import os
import shutil
import sys
import re

# === Ruby Marshal parser (subset sufficient for RPG::Animation data) ===
#
# Marshal format spec: https://docs.ruby-lang.org/en/master/marshal_rdoc.html
# We implement only the type codes that appear in animation data.

class MarshalReader:
    def __init__(self, data):
        self.buf = io.BytesIO(data)
        self.symbols = []   # symbol cache for back-references
        self.objects = []   # object cache for back-references

    def read_byte(self):
        b = self.buf.read(1)
        if not b: raise EOFError("Unexpected end of marshal stream")
        return b[0]

    def read_bytes(self, n):
        data = self.buf.read(n)
        if len(data) != n: raise EOFError(f"Expected {n} bytes, got {len(data)}")
        return data

    def read_long(self):
        # Ruby's variable-length integer encoding
        c = self.read_byte()
        if c == 0: return 0
        # Special length-byte cases come BEFORE the inline-value range
        if c == 1:
            return self.read_byte()
        if c == 2:
            b = self.read_bytes(2)
            return struct.unpack('<H', b)[0]
        if c == 3:
            b = self.read_bytes(3) + b'\x00'
            return struct.unpack('<I', b)[0]
        if c == 4:
            b = self.read_bytes(4)
            return struct.unpack('<i', b)[0]
        if c == 255:
            return -1 - self.read_byte()
        if c == 254:
            b = self.read_bytes(2)
            return -1 - struct.unpack('<H', b)[0]
        if c == 253:
            b = self.read_bytes(3) + b'\x00'
            return -1 - struct.unpack('<I', b)[0]
        if c == 252:
            b = self.read_bytes(4)
            return -1 - struct.unpack('<I', b)[0]
        # Inline values (small positive 5-127, small negative 128-251)
        if c >= 5 and c <= 127: return c - 5
        if c >= 128 and c <= 251: return -(256 - c) - 5
        raise ValueError(f"Unknown long encoding byte: {c}")

    def read_string(self):
        n = self.read_long()
        return self.read_bytes(n)

    def read_symbol(self):
        s = self.read_string().decode('utf-8', errors='replace')
        self.symbols.append(s)
        return s

    def read_symbol_link(self):
        idx = self.read_long()
        return self.symbols[idx]

    def parse(self):
        # Top-level: first 2 bytes are the version
        major = self.read_byte()
        minor = self.read_byte()
        if major != 4: raise ValueError(f"Unsupported marshal version {major}.{minor}")
        return self.read_value()

    def read_value(self):
        c = self.read_byte()
        ch = chr(c)
        # Immediates — not cached
        if ch == '0':  return None
        if ch == 'T':  return True
        if ch == 'F':  return False
        if ch == 'i':  return self.read_long()
        if ch == ':':  return Symbol(self.read_symbol())
        if ch == ';':  return Symbol(self.read_symbol_link())
        if ch == '@':  return self.objects[self.read_long()]   # back-reference

        # Instance variable wrapper — read inner, then attach ivars to it
        if ch == 'I':
            inner = self.read_value()
            n = self.read_long()
            ivars = {}
            for _ in range(n):
                k = self.read_value()
                v = self.read_value()
                ivars[str(k)] = v
            # Attach ivars to the inner if possible
            if isinstance(inner, UserClass):
                inner.ivars = ivars
            elif isinstance(inner, RubyObject):
                inner.ivars.update(ivars)
            elif isinstance(inner, bytes):
                # String with encoding ivar — just return the string
                pass
            else:
                # Wrap the inner so ivars aren't lost
                pass
            return inner

        # Cached types — register object slot BEFORE recursing into children,
        # otherwise children's back-references to siblings break.
        if ch == '"':
            obj = self.read_string()
            self.objects.append(obj)
            return obj
        if ch == '[':
            n = self.read_long()
            arr = []
            self.objects.append(arr)
            for _ in range(n): arr.append(self.read_value())
            return arr
        if ch == '{':
            n = self.read_long()
            d = {}
            self.objects.append(d)
            for _ in range(n):
                k = self.read_value()
                v = self.read_value()
                d[k] = v
            return d
        if ch == 'o':
            cls = self.read_value()
            obj = RubyObject(str(cls))
            self.objects.append(obj)
            n = self.read_long()
            for _ in range(n):
                k = self.read_value()
                v = self.read_value()
                obj.ivars[str(k)] = v
            return obj
        if ch == 'u':
            cls = self.read_value()
            data = self.read_string()
            obj = UserDefined(str(cls), data)
            self.objects.append(obj)
            return obj
        if ch == 'C':
            cls = self.read_value()
            obj_placeholder = []  # placeholder so children can reference us
            self.objects.append(obj_placeholder)
            inner = self.read_value()
            uc = UserClass(str(cls), inner)
            # Replace the placeholder with the real value at the same index
            self.objects[self.objects.index(obj_placeholder)] = uc
            return uc
        if ch == 'l':
            sign = self.read_byte()
            n = self.read_long()
            data = self.read_bytes(n * 2)
            v = int.from_bytes(data, 'little') * (1 if sign == ord('+') else -1)
            self.objects.append(v)
            return v
        if ch == 'f':
            v = float(self.read_string())
            self.objects.append(v)
            return v
        if ch == 'U':
            cls = self.read_value()
            data = self.read_value()
            obj = UserMarshal(str(cls), data)
            self.objects.append(obj)
            return obj
        raise ValueError(f"Unsupported marshal type: {ch!r} (byte {c} at offset {self.buf.tell()})")


class Symbol:
    __slots__ = ('name',)
    def __init__(self, name): self.name = name
    def __repr__(self): return f":{self.name}"
    def __str__(self): return self.name
    def __eq__(self, o): return isinstance(o, Symbol) and self.name == o.name
    def __hash__(self): return hash((Symbol, self.name))


class RubyObject:
    __slots__ = ('cls', 'ivars')
    def __init__(self, cls):
        self.cls = cls
        self.ivars = {}
    def __repr__(self): return f"<{self.cls} {self.ivars}>"
    def get(self, name):
        return self.ivars.get('@' + name) or self.ivars.get(':@' + name)


class UserDefined:
    __slots__ = ('cls', 'data')
    def __init__(self, cls, data):
        self.cls = cls
        self.data = data
    def __repr__(self): return f"<UserDefined {self.cls} ({len(self.data)} bytes)>"


class UserClass:
    __slots__ = ('cls', 'inner', 'ivars')
    def __init__(self, cls, inner):
        self.cls = cls
        self.inner = inner
        self.ivars = {}


class UserMarshal:
    __slots__ = ('cls', 'data')
    def __init__(self, cls, data):
        self.cls = cls
        self.data = data


# === RGSS Table parser (cell_data) ===
# Table#_dump format:
#   [dim:i32][xsize:i32][ysize:i32][zsize:i32][total:i32]
#   then total*2 bytes of int16 (little-endian)
def parse_table(raw_bytes):
    if len(raw_bytes) < 20:
        return None
    header = struct.unpack('<5i', raw_bytes[:20])
    dim, xsize, ysize, zsize, total = header
    elements = struct.unpack(f'<{total}h', raw_bytes[20:20 + total * 2])
    return {
        'xsize': xsize, 'ysize': ysize, 'zsize': zsize,
        'data': list(elements),
        'get': lambda x, y=0, z=0: elements[z * xsize * ysize + y * xsize + x] if 0 <= x < xsize and 0 <= y < ysize else 0
    }


# === Animation conversion logic ===

# Converts Essentials' move name format to our move_id by collapsing
# all whitespace/punctuation, then mapping to canonical underscored names
# from our existing moves.js database (passed in as a known set).
def normalize_move_id(name, known_move_ids=None):
    if not name: return None
    # Strip Move:/OppMove:/Common: prefix
    name = re.sub(r'^(Move|OppMove|Common):\s*', '', name, flags=re.IGNORECASE)
    # Lowercase and remove ALL non-alphanumeric chars to get the collapsed form
    collapsed = re.sub(r'[^a-z0-9]', '', name.lower())
    if not collapsed: return None
    # If we have a dictionary of known move IDs (from our moves.js), use it to
    # find the canonical underscored form. e.g. 'aerialace' -> 'aerial_ace'
    if known_move_ids:
        for canonical in known_move_ids:
            if canonical.replace('_', '') == collapsed:
                return canonical
        # Not found in known set — return collapsed form for manual review
        return collapsed
    return collapsed


def convert_animation(anim_obj, idx, known_move_ids=None):
    """
    anim_obj is a UserClass of class PBAnimation. Reborn's PBAnimation has:
      @id, @name (string), @graphic (sprite sheet name), @hue, @position,
      @array (list of frames; each frame is a list of cels; each cel is a 30-element list),
      @timing, @scope
    """
    # Pull from ivars (UserClass) or directly (RubyObject)
    if hasattr(anim_obj, 'ivars'):
        ivars = anim_obj.ivars
    else:
        return None

    name = ivars.get('@name')

    # Skip animations without a usable move name
    if not name or not isinstance(name, bytes):
        return None
    name_str = name.decode('utf-8', errors='replace')

    # Only export "Move:" animations (skip OppMove and Common templates)
    if not name_str.lower().startswith('move:'):
        return None

    move_id = normalize_move_id(name_str, known_move_ids)
    if not move_id:
        return None

    sheet = ivars.get('@graphic')
    sheet_name = sheet.decode('utf-8', errors='replace') if isinstance(sheet, bytes) else ''
    # Strip .png extension if present
    if sheet_name.lower().endswith('.png'):
        sheet_name = sheet_name[:-4]

    # frames are in @array, each frame is itself a list of cel-lists
    frames_raw = ivars.get('@array') or []
    json_frames = []

    for frame in frames_raw:
        if not isinstance(frame, list):
            continue

        cels = []
        for cel_data in frame:
            # Cel data is a 30-element list of integers/None
            # Reborn's PBAnimation cel format (extended from RGSS Animation::Frame):
            #   [0] x
            #   [1] y
            #   [2] zoom_x (% — 100 = 1.0)
            #   [3] zoom_y (% — 0 means use zoom_x)
            #   [4] angle (0-360)
            #   [5] mirror flag (0/1)
            #   [6] blend type (0=normal, 1=add, 2=subtract)
            #   [7] pattern/cel index in sprite sheet
            #   [8] opacity (0-255)
            #   [9-11] color tones
            #   [12] tone gray
            #   [13-15] flash R G B
            #   [16] flash alpha
            #   [17] focus (0=screen, 1=user, 2=target, 3=both)
            #   ... (positions 18+ are extended ivars: priority, locked, etc)
            if not isinstance(cel_data, list):
                continue
            if len(cel_data) < 18:
                continue

            # Extract the values we care about
            try:
                x = cel_data[0] if cel_data[0] is not None else 0
                y = cel_data[1] if cel_data[1] is not None else 0
                zoom_x = cel_data[2] if cel_data[2] is not None else 100
                angle = cel_data[4] if cel_data[4] is not None else 0
                mirror = cel_data[5] if cel_data[5] is not None else 0
                blend = cel_data[6] if cel_data[6] is not None else 0
                pattern = cel_data[7] if cel_data[7] is not None else 0
                opacity = cel_data[8] if cel_data[8] is not None else 255
                # Focus is at index 17 in Reborn's format
                focus_id = cel_data[17] if len(cel_data) > 17 and cel_data[17] is not None else 0
            except (IndexError, TypeError):
                continue

            # Skip cels with invalid pattern (e.g. -1 means "no cel")
            if pattern is None or pattern < 0:
                continue

            # Map focus IDs: 0=screen, 1=user, 2=target, 3=both/midpoint
            focus_map = { 0: 'screen', 1: 'user', 2: 'target', 3: 'midpoint' }
            focus = focus_map.get(focus_id, 'midpoint')

            cels.append({
                'cel': pattern,
                'focus': focus,
                'x': x,
                'y': y,
                'scale': zoom_x / 100.0 if zoom_x else 1.0,
                'rotation': angle,
                'alpha': opacity / 255.0 if opacity else 0,
                'blend': 'add' if blend == 1 else ('screen' if blend == 2 else 'normal'),
                'flip': mirror == 1
            })

        json_frames.append({
            'duration': 1,
            'cels': cels
        })

    # Skip animations with no actual visible frames
    if not json_frames or all(len(f['cels']) == 0 for f in json_frames):
        return None

    return {
        'id': move_id,
        'displayName': name_str.replace('Move:', '').strip(),
        'sheet': sheet_name,
        'cellSize': 192,
        'cellsPerRow': 5,
        'fps': 20,
        'frames': json_frames,
        '_sourceIndex': idx
    }


# === Main ===

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 convert_animations.py <anim_pack_dir> <output_dir>")
        sys.exit(1)

    pack_dir = sys.argv[1]
    out_dir = sys.argv[2]

    rxdata_path = os.path.join(pack_dir, 'Data', 'PkmnAnimations.rxdata')
    sheets_src = os.path.join(pack_dir, 'Graphics', 'Animations')
    audio_src = os.path.join(pack_dir, 'Audio', 'SE', 'Anim')

    json_out = os.path.join(out_dir, 'json')
    sheets_out = os.path.join(out_dir, 'sheets')
    sounds_out = os.path.join(out_dir, 'sounds')
    os.makedirs(json_out, exist_ok=True)
    os.makedirs(sheets_out, exist_ok=True)
    os.makedirs(sounds_out, exist_ok=True)

    if not os.path.isfile(rxdata_path):
        print(f"ERROR: {rxdata_path} not found")
        sys.exit(1)

    print(f"Reading {rxdata_path}...")
    with open(rxdata_path, 'rb') as f:
        data = f.read()

    print(f"Parsing {len(data)} bytes of marshal data...")
    reader = MarshalReader(data)
    root = reader.parse()

    # Top-level structure should be PBAnimations (UserClass with @array ivar)
    if isinstance(root, UserClass):
        animations = root.ivars.get('@array', root.inner)
    elif isinstance(root, list):
        animations = root
    else:
        print(f"ERROR: Unexpected root type: {type(root)}")
        sys.exit(1)

    print(f"Found {len(animations)} animation slots in pack.")

    # Pass 1: Convert and collect referenced sheet/sound names
    converted = 0
    skipped = 0
    failed = 0
    referenced_sheets = set()
    referenced_sounds = set()
    saved_ids = []

    # Load our existing move IDs from moves.js so we can map pack names
    # to our canonical underscored names
    known_move_ids = set()
    moves_js_path = os.path.join(os.path.dirname(__file__), '..', 'js', 'data', 'moves.js')
    if os.path.isfile(moves_js_path):
        with open(moves_js_path) as f:
            js_text = f.read()
        known_move_ids = set(re.findall(r'^\s+([a-z_][a-z_0-9]*):\s+\{', js_text, re.M))
        print(f"Loaded {len(known_move_ids)} known move IDs from moves.js")

    for idx, anim in enumerate(animations):
        if anim is None:
            skipped += 1
            continue
        if not isinstance(anim, (RubyObject, UserClass)):
            skipped += 1
            continue
        try:
            result = convert_animation(anim, idx, known_move_ids)
            if result is None:
                skipped += 1
                continue

            # Write JSON
            out_path = os.path.join(json_out, f"{result['id']}.json")
            with open(out_path, 'w') as f:
                json.dump(result, f, indent=2)
            saved_ids.append(result['id'])
            converted += 1

            if result['sheet']:
                referenced_sheets.add(result['sheet'])

        except Exception as e:
            failed += 1
            if failed < 5:
                print(f"  Failed at index {idx}: {e}")

    print()
    print(f"Converted: {converted}")
    print(f"Skipped (non-Move or empty): {skipped}")
    print(f"Failed: {failed}")
    print(f"Unique sprite sheets referenced: {len(referenced_sheets)}")

    # Pass 2: Copy referenced sprite sheets
    sheets_copied = 0
    sheets_missing = 0
    for sheet in referenced_sheets:
        candidates = [f"{sheet}.png", f"{sheet}.PNG"]
        copied = False
        for c in candidates:
            src = os.path.join(sheets_src, c)
            if os.path.isfile(src):
                shutil.copy(src, os.path.join(sheets_out, f"{sheet}.png"))
                sheets_copied += 1
                copied = True
                break
        if not copied:
            sheets_missing += 1

    print(f"Sprite sheets copied: {sheets_copied}, missing: {sheets_missing}")

    # Pass 3: Audio is bulk-copied since timings are scattered
    audio_copied = 0
    if os.path.isdir(audio_src):
        for fn in os.listdir(audio_src):
            if fn.lower().endswith(('.ogg', '.wav', '.mp3')):
                shutil.copy(os.path.join(audio_src, fn), os.path.join(sounds_out, fn))
                audio_copied += 1
    print(f"Audio files copied: {audio_copied}")

    # Write a manifest of all saved move IDs for quick reference
    manifest = {
        'totalAnimations': converted,
        'moveIds': sorted(saved_ids),
    }
    with open(os.path.join(out_dir, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"Wrote manifest with {len(saved_ids)} move IDs.")


if __name__ == '__main__':
    main()
