#!/usr/bin/env ruby
# convert_anm_to_json.rb
#
# Reads Pokémon Essentials .anm files and writes Cascadia-format JSON.
# 
# USAGE:
#   ruby tools/convert_anm_to_json.rb path/to/anm/folder path/to/output/json/folder
#
# REQUIRES:
#   Ruby (free, comes pre-installed on Mac/Linux, free download for Windows)
#   No external gems — uses only the standard library.
#
# The .anm format is Marshal.dump'd Ruby. Essentials' animation class is
# RPG::Animation, which has these fields:
#   - id (integer)
#   - name (string)
#   - animation_name (string)        — the sprite sheet filename (without extension)
#   - animation_hue (integer)        — global hue rotation (we ignore for now)
#   - position (integer)              — 0=top, 1=middle, 2=bottom, 3=screen
#   - frame_max (integer)
#   - frames (Array of RPG::Animation::Frame)
#   - timings (Array of RPG::Animation::Timing) — for sounds and screen effects
#
# Each Frame has:
#   - cell_max (integer)
#   - cell_data (Table) — 8 columns × cell_max rows of Int32:
#       col 0: cell_id (which sprite in the sheet)
#       col 1: x
#       col 2: y
#       col 3: scale (in percent — 100 = 1.0)
#       col 4: rotation (in degrees, 0-360)
#       col 5: flip (1 = horizontal flip)
#       col 6: opacity (0-255)
#       col 7: blend_type (0=normal, 1=add, 2=subtract)
#
# Each Timing has:
#   - frame (which frame triggers this)
#   - se (sound effect: name + volume + pitch)
#   - flash_scope (0=none, 1=target, 2=screen, 3=hide_target)
#   - flash_color
#   - flash_duration
#   - condition (0=none, 1=hit, 2=miss)

require 'json'
require 'fileutils'

# Stub out RPG and Table classes so Marshal.load can rebuild the objects
# without needing the full RGSS runtime.
module RPG
  class Animation
    attr_accessor :id, :name, :animation_name, :animation_hue, :position,
                  :frame_max, :frames, :timings
    class Frame
      attr_accessor :cell_max, :cell_data
    end
    class Timing
      attr_accessor :frame, :se, :flash_scope, :flash_color, :flash_duration, :condition
    end
  end
  class AudioFile
    attr_accessor :name, :volume, :pitch
  end
end

class Color
  attr_accessor :red, :green, :blue, :alpha
  def _dump(_); [red, green, blue, alpha].pack('E4'); end
  def self._load(s); o = new; o.red, o.green, o.blue, o.alpha = s.unpack('E4'); o; end
end

class Tone < Color; end

# Table class — stores integers in a multi-dimensional grid.
# RGSS's Table#_dump format:
#   4 bytes: dim count
#   4 bytes: x size
#   4 bytes: y size
#   4 bytes: z size
#   4 bytes: total elements
#   then x*y*z * 2 bytes (signed shorts) of data
class Table
  attr_accessor :dim, :xsize, :ysize, :zsize, :data
  def [](x, y = 0, z = 0)
    return 0 if x < 0 || x >= xsize || y < 0 || y >= ysize
    @data[z * xsize * ysize + y * xsize + x] || 0
  end
  def self._load(s)
    t = new
    header = s[0, 20].unpack('L5')
    t.dim, t.xsize, t.ysize, t.zsize, total = header
    t.data = s[20..].unpack("s#{total}")
    t
  end
end

# === Main conversion logic ===

def convert_anm(path)
  anm = File.open(path, 'rb') { |f| Marshal.load(f) }

  cells_per_row = 5
  cell_size     = 192

  json_frames = []
  (anm.frames || []).each do |frame|
    cels = []
    next unless frame.cell_data
    (0...frame.cell_max).each do |i|
      cell_id = frame.cell_data[i, 0]
      next if cell_id < 0
      x       = frame.cell_data[i, 1]
      y       = frame.cell_data[i, 2]
      scale   = frame.cell_data[i, 3] / 100.0
      rot     = frame.cell_data[i, 4]
      flip    = frame.cell_data[i, 5]
      opacity = frame.cell_data[i, 6] / 255.0
      blend   = frame.cell_data[i, 7]

      cels << {
        'cel'      => cell_id,
        'focus'    => 'midpoint',           # Essentials handles focus per-animation, default to midpoint
        'x'        => x,
        'y'        => y,
        'scale'    => scale,
        'rotation' => rot,
        'alpha'    => opacity,
        'blend'    => blend == 1 ? 'add' : (blend == 2 ? 'screen' : 'normal'),
        'flip'     => flip == 1
      }
    end
    json_frames << { 'duration' => 1, 'cels' => cels }
  end

  # Strip "Move:" prefix and downcase to make the id match our internal move ids
  raw_name = anm.name || File.basename(path, '.anm')
  id = raw_name.sub(/^Move:\s*/, '').sub(/^OppMove:\s*/, '').downcase.gsub(/\s+/, '_')

  {
    'id'           => id,
    'displayName'  => raw_name.sub(/^Move:\s*/, ''),
    'sheet'        => anm.animation_name,
    'cellSize'     => cell_size,
    'cellsPerRow'  => cells_per_row,
    'fps'          => 20,
    'frames'       => json_frames,
    'sourceFile'   => File.basename(path)
  }
end

# === Entry point ===
if ARGV.length < 2
  puts "Usage: ruby convert_anm_to_json.rb <input_anm_dir> <output_json_dir>"
  exit 1
end

input_dir, output_dir = ARGV
FileUtils.mkdir_p(output_dir)

count_ok = 0
count_fail = 0
Dir.glob(File.join(input_dir, '*.anm')).each do |anm_path|
  begin
    json = convert_anm(anm_path)
    out_path = File.join(output_dir, "#{json['id']}.json")
    File.write(out_path, JSON.pretty_generate(json))
    count_ok += 1
    puts "  OK  #{File.basename(anm_path)} -> #{json['id']}.json"
  rescue => e
    count_fail += 1
    puts "  FAIL #{File.basename(anm_path)}: #{e.message}"
  end
end

puts ""
puts "Converted #{count_ok} animation(s). #{count_fail} failure(s)."
