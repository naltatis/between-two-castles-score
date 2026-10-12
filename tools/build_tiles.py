"""Build app/src/data/tiles.json: every distinct tile with name EN/DE, type, deco and scoring rule.

Facts (type, decoration, wanted type, points) are game facts transcribed from the tiles; the
reference JSON (ca_tiles.json, extracted from a third-party app) is used only to cross-check.
usage: python build_tiles.py REF_JSON OUT_JSON
"""
import json, re, sys

TYPE = {'Food': 'food', 'Living': 'living', 'Utility': 'utility', 'Outdoor': 'outdoor', 'Sleeping': 'sleeping',
        'Corridor': 'corridor', 'Downstairs': 'downstairs', 'Activity': 'activity', 'Secret': 'secret'}
COND = {'Food': 'food', 'Living': 'living', 'Utility': 'utility', 'Outdoor': 'outdoor', 'Sleeping': 'sleeping',
        'Corridor': 'corridor', 'Downstairs': 'downstairs', 'Activity': 'activity', 'Special': 'specialty',
        'Mirror': 'mirror', 'Painting': 'painting', 'Swords': 'swords', 'Torch': 'torch'}
DECO = {'Mirror': 'mirror', 'Painting': 'painting', 'Swords': 'swords', 'Torch': 'torch'}
DIR = {'N': 'up', 'S': 'down', 'E': 'right', 'W': 'left'}

# German names as printed on the Feuerland base-game tiles (expansion tiles are English only)
DE = {
    # food
    'Scullery': 'Spülküche', 'Bakery': 'Backstube', 'Buttery': 'Buttervorrat', 'Breakfast Nook': 'Frühstücksnische',
    'Pantry': 'Speisekammer', 'Chocolate Room': 'Schokoladerie', 'Spice Room': 'Gewürzraum', 'Kitchen': 'Küche',
    'Dining Room': 'Speisesaal', 'Sauerkraut Room': 'Sauerkrautraum', 'Morning Tea Room': '10-Uhr-Tee-Raum',
    'Brewery': 'Bräustüberl', 'Ice House': 'Eisraum', 'Cutlery Room': 'Besteckraum', 'Meat Locker': 'Schlachtraum',
    'Brandy Room': 'Branntweinzimmer', 'Siege Food Storage': 'Belagerungsvorrat', 'China Room': 'Porzellanraum',
    'Wine Room': 'Weinstube', 'Afternoon Tea Room': '15-Uhr-Tee-Raum', 'Crepery': 'Crêpeküche',
    # living
    'Drawing Room': 'Unterhaltungsraum', 'Harp Room': 'Harfenzimmer', 'Gallery': 'Galerie', 'Reception Room': 'Empfangszimmer',
    'Waiting Room': 'Wartezimmer', 'Hat Room': 'Hutraum', 'Cape Room': 'Umhangszimmer', 'Taxidermy Showroom': 'Jagdtrophäenraum',
    'Vestibule': 'Diele', 'Parlor': 'Sprechzimmer', 'FirePlace': 'Kaminraum', 'Observatory': 'Observatorium',
    'Rug Room': 'Orientalischer Raum', 'Sitting Room': 'Wohnzimmer', 'Reading Room': 'Lesezimmer',
    'Meditation Room': 'Meditationsraum', 'Library': 'Bibliothek', 'Study': 'Arbeitszimmer', 'Tapestry Room': 'Teppichraum',
    'Map Room': 'Kartographieraum', 'Salon': 'Salon',
    # utility
    'Glassmaking Room': 'Glasbläserei', 'WashRoom': 'Waschraum', 'Game Storage': 'Spielevorrat', 'Coat Room': 'Jackenkammer',
    'Mud Room': 'Schmutzraum', 'Panic Room': 'Panikraum', 'Crown Storage': 'Kronenvorrat', 'Sauna': 'Sauna',
    'Broom Closet': 'Besenkammer', 'Kennel': 'Hundestube', 'Tool Room': 'Werkzeugkammer', 'Repair Shop': 'Reparaturwerkstatt',
    'Schoolhouse': 'Klassenzimmer', 'Kittenry': 'Kätzchenraum', 'Key Room': 'Schlüsselraum', 'Shield Room': 'Wappenzimmer',
    'Scythe Room': 'Sensenkammer', 'Powder Room': 'Schminkraum', 'Dumbwaiter': 'Speisenaufzug', 'Laundry Room': 'Wäscheraum',
    'Torch Storage': 'Fackelvorrat',
    # outdoor
    'Aviary': 'Voliere', 'Winter Garden': 'Wintergarten', 'Chicken Coop': 'Hühnerstall', 'Butterfly Garden': 'Schmetterlingsgarten',
    'Archery Range': 'Schießstand', 'Walking Path': 'Spazierweg', 'Guardhouse': 'Wache', 'Stables': 'Pferdestall', 'Sty': 'Schweinestall',
    'Vegetable Garden': 'Gemüsebeet', 'Fish Pond': 'Fischteich', 'Pumpkin Garden': 'Kürbisbeet', 'Firewood Storage': 'Holzvorrat',
    'Vineyard': 'Weingarten', 'Swimming Hole': 'Schwimmbad', 'Flower Garden': 'Blumengarten', 'French Gazebo': 'Französischer Pavillon',
    'Biergarten': 'Biergarten', 'Terrace': 'Terrasse', 'Grand Balcony': 'Großer Balkon', 'Turtle Pond': 'Schildkrötenteich',
    # sleeping
    'Puppy Room': 'Welpenraum', "Children's Room": 'Kinderzimmer', 'Blanket Room': 'Wolldeckenraum', 'Nap Room': 'Nickerchenraum',
    'Solar': 'Sonnraum', 'In-Law Suite': 'Schwiegereltern-Suite', "Servant's Quarters": 'Dienstbotenquartier', 'Nursery': 'Kinderkrippe',
    "Princess' Chambers": 'Gemach der Prinzessin', 'Rabbit Room': 'Kaninchenraum', 'Dreaming Room': 'Traumzimmer',
    'Dressing Room': 'Ankleidezimmer', 'Tasso Room': 'Tasso-Raum', 'Guest Bedroom': 'Gästeschlafzimmer', 'Bunk Room': 'Stockbettenzimmer',
    "King's Chambers": 'Gemach des Königs', "Queen's Chambers": 'Gemach der Königin', 'Midnight Room': 'Mitternachtsraum',
    'Hibernation Chamber': 'Winterschlafkammer', 'Pillow Room': 'Kissenraum', "Prince's Chambers": 'Gemach des Prinzen',
    # corridor
    'Between Two Rooms': 'Zwischen zwei Räumen', 'Dead End': 'Sackgasse', 'Echo Chamber': 'Echokammer', 'Escape Room': 'Escape Room',
    'Great Hall': 'Große Halle', 'Hall Of Creaking Floors': 'Knarrender Gang', 'Hall Of Paintings': 'Gemäldehalle',
    'Hall Of Sculptures': 'Halle der Skulpturen', 'Hall of Windows': 'Lichthalle', 'Hall of Doors': 'Halle der Türen',
    'Hall of Ever-Closing Walls': 'Halle der wandernden Wände', 'Hall of Ghosts': 'Geisterhalle', 'Hall of Knights': 'Ritterhalle',
    'Hall of Mirrors': 'Spiegelsaal', 'Hall of Portraits': 'Halle der Porträts', 'Hall Of Puzzled Floors': 'Schachbretthalle',
    'Lockdown Room': 'Hochsicherheitstrakt', 'Pacing Hall': 'Grübelgang', 'Promenade': 'Promenade', 'Purgatory': 'Purgatorium',
    # downstairs
    'Laboratory': 'Laboratorium', 'Hidden Lair': 'Spinnenkammer', 'Subterranean Tunnel': 'Unterirdischer Tunnel',
    'Gunpowder Room': 'Pulverkammer', 'Hidden Entrance': 'Versteckter Eingang', 'Dungeon': 'Verlies', 'Mold Room': 'Käsekeller',
    'Fungus Room': 'Pilzfarm', 'Wine Cellar': 'Weinkeller', 'Snake Pit': 'Schlangengrube', 'Padded Room': 'Gummizelle',
    'Jewel Room': 'Juwelenraum', 'Knight Room': 'Ritterkammer', 'Venus Grotto': 'Venusgrotte', 'Armory': 'Waffenkammer',
    'The Hole': 'Das Loch', 'Quiet Room': 'Ruheraum', 'Treasure Room': 'Schatzkammer', 'Pit Of Despair': 'Folterkammer',
    'Crypt': 'Krypta', 'Spy Room': 'Spionageraum',
    # specialty
    'Grand Foyer': 'Foyer', 'Tower': 'Turm', 'Fountain': 'Brunnen', 'Throne Room': 'Thronsaal',
}
# tiles printed in German whose English name is also printed on some copies (none) / expansion tiles keep EN.

GUESS = {'Harfenzimmer', 'Spiegelsaal', 'Versteckter Gang'}
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '')).strip('-')


def main(ref, out):
    ca = json.load(open(ref))
    tiles, seen = [], set()
    for t in ca:
        ty, name = t['type'], t['name']
        if ty in ('BonusCard', 'RoyalAttendant'):
            continue
        e = {'id': slug(name), 'name': name, 'type': TYPE.get(ty, ty.lower())}
        if ty == 'ThroneRoom':
            continue  # kept by hand (8 throne rooms, spots differ) in tiles.ts
        if ty == 'Special':
            if name.startswith('BallRoom'):
                w = COND[t['cond']]
                e = {'id': f'ballroom-{w}', 'name': 'Ballroom', 'type': 'ballroom', 'wants': w}
            else:
                e['type'] = {'Grand Foyer': 'foyer', 'Tower': 'tower', 'Fountain': 'fountain'}[name]
        else:
            if t['deco'] in DECO:
                e['deco'] = DECO[t['deco']]
            pos, cond, per = t['pos'], t['cond'], t['per']
            if ty == 'Food':
                e['wants'] = COND[cond]
                e['axis'] = 'below2' if pos == ['SS', 'S'] else 'horizontal' if pos == ['W', 'E'] else 'vertical'
            elif ty in ('Living', 'Outdoor', 'Utility', 'Activity'):
                if name == 'Dice Tower Room':
                    e['promo'] = True  # scores 2 per Scythe Room / Game Storage / Vineyard / Between Two Rooms
                    e['wants'] = 'utility'
                else:
                    e['wants'] = COND[cond]
                if per != 1:
                    e['per'] = per
            elif ty == 'Corridor':
                e['wants'] = COND[cond]
            elif ty == 'Downstairs':
                e['wants'] = COND[cond]
                if per != 1:
                    e['per'] = per
                if 'Below' in pos:
                    e['column'] = 'both'
            elif ty == 'Sleeping':
                pass
            elif ty == 'Secret':
                e['dir'] = DIR[pos[0]]
        # name collisions: Escape Room (corridor+activity), Vestibule (living) vs Vestibule Corridor
        if e['id'] in seen and ty != 'Special':
            e['id'] += '-' + e['type']
        if e['id'] in seen:
            continue  # identical specialty copies
        if name == 'Vestibule Corridor':
            e['name'] = 'Vestibule'
        if name in DE:
            e['nameDe'] = DE[name]
            if DE[name] in GUESS:
                e['deGuess'] = True
        seen.add(e['id'])
        tiles.append(e)
    # identical specialty copies collapse to one entry
    uniq = {}
    for e in tiles:
        uniq.setdefault(e['id'], e)
    tiles = list(uniq.values())
    json.dump(tiles, open(out, 'w'), ensure_ascii=False, indent=1)
    from collections import Counter
    print(len(tiles), 'tiles', Counter(e['type'] for e in tiles))
    print('without DE name (non-expansion?):', [e['name'] for e in tiles if 'nameDe' not in e and e['type'] not in ('activity', 'secret', 'ballroom')])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
