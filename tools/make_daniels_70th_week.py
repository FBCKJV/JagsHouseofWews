# Builds lessons/src/daniels-70th-week.deck and its picture crops from the full-size chart.
# Run: python3 tools/make_daniels_70th_week.py && python3 tools/build_deck.py lessons/src/daniels-70th-week.deck
from PIL import Image
import os
ROOT = '/home/user/JagsHouseofWews'
SRC = os.path.join(ROOT, 'lessons/others/revelation-daniels-70th-week-chart.jpg')
OUT = os.path.join(ROOT, 'lessons/prophecy')
ID = 'daniels-70th-week'
im = Image.open(SRC).convert('RGB')
W, H = im.size

# label and references for each number, as the chart gives them
N = {
 1: ('Antichrist confirms the covenant with many for one week', 'Daniel 9:27'),
 2: ('1st Seal: Antichrist goes forth to conquer', 'Revelation 6:1-2'),
 3: ('2nd Seal: World at war', 'Revelation 6:3-4'),
 4: ('3rd Seal: Famine and starvation', 'Revelation 6:5-6'),
 5: ('4th Seal: Death in one quarter of the earth', 'Revelation 6:7-8'),
 6: ('5th Seal: Martyrs appear in heaven', 'Revelation 6:9-11'),
 7: ('6th Seal: Sun and moon darkened, stars fall, heavens depart', 'Revelation 6:12-17; Matthew 24:29; Mark 13:24-25'),
 8: ('Rapture, Second Coming, Day of Christ, Day of the Lord', 'Matthew 24:30-31; Mark 13:26-27; 1 Thessalonians 4:13-18; 1 Thessalonians 5:9; 2 Thessalonians 2:1-4'),
 9: ('7th Seal: Wrath begins', 'Revelation 8:1-6'),
 10: ('1st Trump: Hail and fire cast upon the earth', 'Revelation 8:7'),
 11: ('1st Vial: Poured upon earth, grievous sore on men', 'Revelation 16:2'),
 12: ('2nd Trump: Mountain cast into the sea', 'Revelation 8:8-9'),
 13: ('2nd Vial: Poured upon sea, sea turned into blood', 'Revelation 16:3'),
 14: ('3rd Trump: Burning star falls upon the rivers', 'Revelation 8:10-11'),
 15: ('3rd Vial: Poured upon rivers, rivers turned into blood', 'Revelation 16:4-7'),
 16: ('4th Trump: Sun, moon and stars smitten', 'Revelation 8:12'),
 17: ('4th Vial: Poured upon sun, scorched with heat', 'Revelation 16:8-9'),
 18: ('5th Trump: Smoke and locusts out of the pit (1st woe)', 'Revelation 9:1-12'),
 19: ('5th Vial: Poured upon seat of beast, darkness', 'Revelation 16:10-11'),
 20: ('6th Trump: 4 angels, army from Euphrates (2nd woe)', 'Revelation 9:13-21'),
 21: ('6th Vial: Poured upon Euphrates, dried up', 'Revelation 16:12-16'),
 22: ('7th Trump: Thunderings and hail (3rd woe)', 'Revelation 11:15-19'),
 23: ('7th Vial: Poured into air, thunderings and hail', 'Revelation 16:17-21'),
 24: ('Destruction of Babylon', 'Revelation 18:1-24; Jeremiah 50:1-46; Jeremiah 51:1-64'),
 26: ('Battle of Armageddon', 'Revelation 16:16; Revelation 19:11-21'),
 27: ('Abomination of Desolation', 'Daniel 8:13; Daniel 9:27; Daniel 11:31; Daniel 12:11; Matthew 24:15; Mark 13:14'),
 28: ('Daily sacrifice begins', 'Daniel 8:13-14'),
 29: ('1335 days: Blessed is he that waiteth and cometh to the 1335 days', 'Daniel 12:12-13; 1 Thessalonians 1:10; 2 Thessalonians 3:5; James 5:7-8; Matthew 24:13; Mark 13:13'),
 30: ('42 months: Antichrist continues in power', 'Revelation 13:5; Daniel 7:25'),
 31: ('1260 days: Prophecy of two witnesses', 'Revelation 11:1-3'),
 32: ('1290 days: From the abomination of desolation', 'Daniel 12:11'),
 33: ('2300 days: The vision concerning the daily sacrifice and the transgression of desolation', 'Daniel 8:13-14'),
 34: ('Blowing of trumpets: 1st day of 7th month', 'Leviticus 23:24; Numbers 10:9; Numbers 31:6'),
 35: ('Trumpet of jubile sounded (last trump): 10th day of 7th month', 'Leviticus 25:9-10; 1 Thessalonians 4:13-18; 1 Corinthians 15:52'),
 36: ('The Great Tribulation: 75 days; ten days from the midpoint of the Hebrew year', 'Revelation 2:10'),
}
# where each number's dot sits on the chart (pixels in the full-size image)
DOT = {1: (89, 685), 2: (175, 317), 3: (543, 317), 4: (912, 317), 5: (1280, 317), 6: (1648, 317), 7: (2016, 317),
       8: (1998, 577), 9: (2016, 837), 10: (2319, 317), 11: (2319, 642), 12: (2536, 317), 13: (2536, 642),
       14: (2752, 317), 15: (2752, 642), 16: (2969, 317), 17: (2969, 642), 18: (3185, 317), 19: (3185, 642),
       20: (3402, 317), 21: (3402, 642), 22: (3618, 317), 23: (3618, 642), 24: (3677, 902), 26: (3699, 1183),
       27: (1853, 1227), 28: (381, 1227), 29: (1043, 1372), 30: (2796, 1286), 31: (2806, 1459), 32: (2825, 1589),
       33: (2089, 1719), 34: (1859, 2266), 35: (1967, 2412), 36: (2035, 2174)}
# the same numbers in the chart's reference list along the bottom
LEG = {1: (196, 2240), 2: (196, 2268), 3: (196, 2294), 4: (196, 2322), 5: (196, 2350), 6: (196, 2378), 7: (196, 2404),
       8: (196, 2460), 9: (196, 2514), 10: (196, 2542), 23: (1234, 2240), 24: (1234, 2268),
       26: (2274, 2240), 27: (2274, 2268), 28: (2274, 2322), 29: (2274, 2350), 30: (2274, 2432), 31: (2274, 2460),
       32: (2274, 2488), 33: (2274, 2514), 34: (2274, 2542), 35: (2794, 2432), 36: (3315, 2460)}
for i, y in enumerate([2240, 2268, 2294, 2322, 2350, 2378, 2404, 2432, 2460, 2488, 2516, 2542]):
    LEG[11 + i] = (716, y)

# section, slide title, crop box, which dots (map), caption
PARTS = [
 ('The chart', 'The whole week', (0, 0, W, H), DOT, 'Daniel’s 70th Week. Tap any numbered dot to read its verses.'),
 ('The first half', 'The covenant, and the first five seals', (20, 200, 1880, 900), DOT, ''),
 ('The midpoint', 'The sixth seal, the rapture, the seventh seal', (1800, 230, 2260, 1300), DOT, ''),
 ('God’s wrath', 'Trumpets and vials one to four', (2195, 200, 3135, 860), DOT, ''),
 ('God’s wrath', 'Trumpets and vials five to seven, Babylon and Armageddon', (3070, 130, 3960, 1260), DOT, ''),
 ('The days', 'The 1335 days and the 2300 days', (100, 1180, 2300, 1830), DOT, ''),
 ('The days', '42 months, 1260, 1290 and 2300 days', (1960, 1268, 3940, 1830), DOT, ''),
 ('The days', 'Tribulation, and the first half of the Hebrew year', (100, 1840, 1900, 2200), DOT, ''),
 ('The days', 'Great Tribulation, God’s wrath, and the second half of the year', (1900, 1840, 3940, 2200), DOT, ''),
 ('The days', 'The trumpets of the seventh month', (1720, 2040, 2240, 2600), DOT, ''),
 ('The chart’s notes', 'The references, numbers 1 to 25', (150, 2210, 1900, 2580), LEG, ''),
 ('The chart’s notes', 'The references and notes, numbers 26 to 36', (2230, 2210, 3900, 2580), LEG, ''),
]

lines = ['title: Daniel’s 70th Week – The Chart, Step by Step',
         'description: The seals, trumpets and vials of Revelation laid on one timeline of Daniel’s 70th week, with the 1260, 1290, 1335 and 2300 days, the abomination of desolation, the rapture at the sixth seal and the day of the Lord’s wrath, set against the Hebrew calendar year; each part of the chart in turn, every numbered dot opening its verses.',
         f'output: lessons/prophecy/{ID}.html',
         '',
         '# Built by a script from the full-size chart (lessons/others/revelation-daniels-70th-week-chart.jpg):',
         '# each part is a crop of it, and each "spot" a numbered dot that opens the verses the chart gives for it.',
         '',
         '=== Introduction',
         "--- Daniel’s 70th Week [title]",
         'overline: Prophecy · A chart, step by step',
         "heading: Daniel’s 70th Week",
         'sub: The seals, trumpets and vials of Revelation on one timeline of the 70th week, with the 1260, 1290, 1335 and 2300 days, set against the Hebrew calendar year.',
         'hint: Use the arrow keys or swipe to move. Tap any numbered dot, or a number in the key below the picture, to read its verses.',
         'note: Chart: Faithful Word Baptist Church, designed by Richard Miller.',
         '']
sec = None
for k, (section, title, box, dots, cap) in enumerate(PARTS):
    x1, y1, x2, y2 = box
    crop = im.crop(box)
    name = f'{ID}-{k + 1:02d}.jpg'
    if k == 0:
        crop = crop.resize((2400, round(2400 * H / W)), Image.LANCZOS)
    crop.save(os.path.join(OUT, name), quality=86, optimize=True, progressive=True)
    if section != sec:
        lines.append(f'=== {section}'); sec = section
    lines.append(f'--- {title}')
    if k:
        lines.append(f'kicker: Daniel’s 70th Week · {section}')
    lines.append(f'image: lessons/prophecy/{name} | Daniel’s 70th Week chart: {title} | {cap}'.rstrip(' |'))
    cw, ch = x2 - x1, y2 - y1
    size = round(46 / cw * 100, 2) if k else 0.9
    for n in sorted(dots):
        x, y = dots[n]
        if x1 <= x < x2 and y1 <= y < y2 and n in N:
            lab, refs = N[n]
            lines.append(f'spot: {n} | {(x - x1) / cw * 100:.2f} | {(y - y1) / ch * 100:.2f} | {size} | {lab} | {refs}')
    if k and cw / ch < 1.6:
        lines.append('keyside: yes')
    lines.append('')
lines += ['=== The whole week',
          '--- Daniel’s 70th Week, the whole chart',
          'image: lessons/prophecy/' + f'{ID}-01.jpg' + ' | Daniel’s 70th Week chart | Daniel’s 70th Week. Tap any numbered dot to read its verses.']
for n in sorted(DOT):
    if n in N:
        x, y = DOT[n]; lab, refs = N[n]
        lines.append(f'spot: {n} | {x / W * 100:.2f} | {y / H * 100:.2f} | 0.9 | {lab} | {refs}')
lines += ['read: post-trib-pre-wrath-timeline | Post-Trib, Pre-Wrath Timeline',
          'read: daniel-8-12-timeline | Timeline of Days in Daniel 8 and 12',
          'read: topic-prophecy | After the Tribulation – End Times and Prophecy',
          'note: Chart: Faithful Word Baptist Church, designed by Richard Miller.', '']
open(os.path.join(ROOT, f'lessons/src/{ID}.deck'), 'w').write('\n'.join(lines))
print('ok', len(PARTS))
