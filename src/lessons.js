// Curriculum. Each lesson is a chord chart plus the parts you practise over it.
// The course (course.js) turns every part into exercises: piano only, step by step, in each of
// `keys` (default: the lesson's key), then once with the band in the lesson's key.
// Parts are generated from the chords (see parts.js); `melody` / `customParts` are written out.
// Melody notation: "C5/4" quarter, "Bb4/8" eighth, "F4/2." dotted half, "r/4" rest, bars split by "|".

const II_V_I = '| Dm7 | G7 | Cmaj7 | Cmaj7 |';
const F_BLUES = '| F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | Am7 D7 | Gm7 | C7 | F7 D7 | Gm7 C7 |';
const C_BLUES = '| C7 | F7 | C7 | C7 | F7 | F7 | C7 | C7 | G7 | F7 | C7 | G7 |';
// Keys to practise in. After C, jazz lives in the flat keys: F, B♭ and E♭ each add one flat, and they are the
// horn keys most standards and blues are written in. G comes last, for a sharp key.
const JAZZ_KEYS = ['C', 'F', 'Bb', 'Eb', 'G'];
const JAZZ_MINOR_KEYS = ['Cm', 'Gm', 'Dm', 'Fm'];
const LEVINE = 'Technique from Mark Levine, The Jazz Piano Book (Sher Music, 1989). Exercises and text written for BeBop Dots.';

export const UNITS = [
  { id: 'harmony', title: '1 · Harmony basics' },
  { id: 'voicings', title: '2 · Left-hand voicings' },
  { id: 'lines', title: '3 · Lines & vocabulary' },
  { id: 'comping', title: '4 · Rhythm, comping & bass' },
  { id: 'blues', title: '5 · Blues, boogie & ragtime' },
  { id: 'levine', title: '6 · Ideas from The Jazz Piano Book' },
  { id: 'standards', title: '7 · Songs' },
];

export const LESSONS = [
  // ---------------- 1 · Harmony basics ----------------
  {
    id: 'seventh-chords',
    desc: 'maj7, 7, m7, m7♭5 and dim7 — the building blocks of jazz.',
    unit: 'harmony',
    title: 'The five 7th chords',
    level: 1,
    key: 'C',
    keys: ['C', 'Bb'],
    tempo: 70,
    style: 'ballad',
    chart: `| Cmaj7 | C7 | Cm7 | Cm7b5 | Cdim7 | Fmaj7 | F7 | Fm7 | Fm7b5 | Fdim7
            | Gmaj7 | G7 | Gm7 | Gm7b5 | Gdim7 | Cmaj7 |`,
    parts: ['rootpos', 'rootposL'],
    about:
      'Jazz harmony is built from four-note chords. Almost every symbol on a lead sheet is one of five 7th-chord types, plus colour tones. Each type differs from the previous one by a single lowered note — learn to hear that one note change.',
    tips: [
      'maj7 = 1 3 5 7 → dominant 7 lowers the 7th → m7 also lowers the 3rd → m7♭5 also lowers the 5th → dim7 lowers the 7th once more (♭♭7).',
      'Say the chord name out loud while you play it.',
      'The exercise walks through the five types on C, then F, then G (in the B♭ version: B♭, E♭, F).',
    ],
  },
  {
    id: 'dominant-cycle',
    desc: 'All twelve dominant chords, falling by 5ths.',
    unit: 'harmony',
    title: 'Dominants around the circle of 4ths',
    level: 1,
    key: 'C',
    tempo: 90,
    style: 'swing',
    chart: '| C7 | F7 | Bb7 | Eb7 | Ab7 | Db7 | Gb7 | B7 | E7 | A7 | D7 | G7 |',
    parts: ['rootpos', 'guide'],
    about:
      'Most jazz root movement goes down a 5th (= up a 4th): ii → V → I, or a chain of dominants like this one. Watch the 3rd and 7th: the 7th of each chord slides down a half step and becomes the 3rd of the next chord. That half-step pull is what makes jazz harmony sound like it is going somewhere.',
    tips: [
      'In "Guide-tone voicings 3–7" you hold only two notes per chord — the bass player provides the root.',
      'Notice the voicings alternate: 3 on the bottom, then 7 on the bottom, and so on.',
    ],
  },

  // ---------------- 2 · Left-hand voicings ----------------
  {
    id: 'shells',
    desc: 'Root plus 3rd or 7th: the essential left hand.',
    unit: 'voicings',
    title: 'Shell voicings on ii–V–I',
    level: 1,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 100,
    style: 'swing',
    chart: II_V_I,
    parts: ['shells2', 'shells3'],
    about:
      'Shell voicings (often called Bud Powell voicings) are the essential left-hand sound: the root plus the 3rd or the 7th. Those two "guide tones" define the chord quality; the 5th adds almost nothing. Alternate 1–7 and 1–3 so that the upper note moves as little as possible.',
    tips: [
      'In C: Dm7 (D–F) → G7 (G–F) → Cmaj7 (C–E). The top voice goes F → F → E — it barely moves.',
      'The 3-note shells (1–3–7 / 1–7–3) need a reach of a 10th. If that is too wide, roll the chord or take the top note with your right hand.',
      'Keep the roots low (around E2–E3) — that is where a bass player would be.',
    ],
  },
  {
    id: 'guide-tones',
    desc: 'The 3rds and 7ths that tell the harmony’s story.',
    unit: 'voicings',
    title: 'Guide-tone lines',
    level: 1,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 100,
    style: 'swing',
    chart: II_V_I,
    parts: ['guideLine', 'guide'],
    about:
      'Connect the 3rds and 7ths of a progression and you get a smooth line that outlines the harmony on its own. In a ii–V–I each guide tone either stays put (the 3rd of Dm7, F, becomes the 7th of G7) or slides down a step (the 7th of G7, F, falls to E, the 3rd of Cmaj7). Many famous melodies are built on exactly these notes, and so are strong improvised solos.',
    tips: [
      'Sing the guide-tone line while you play it.',
      'Next step: improvise freely, but land on a guide tone at each chord change.',
    ],
  },
  {
    id: 'rootless',
    desc: 'Bill Evans’ A and B voicings with 9ths and 13ths.',
    unit: 'voicings',
    title: 'Rootless voicings (A & B forms)',
    level: 2,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 90,
    style: 'swing',
    chart: II_V_I,
    parts: ['rootless', 'twoHand'],
    about:
      'When a bass player covers the root, pianists leave it out and add colour tones (9th, 13th) instead. These "rootless" voicings, made famous by Bill Evans and Wynton Kelly, come in two forms: A = 3-5-7-9 and B = 7-9-3-5. In a ii–V–I they alternate A–B–A or B–A–B, so every voice moves by a step or stays still.',
    tips: [
      'Dm7 (F A C E) → G7 (F A B E) → Cmaj7 (E G B D): only one or two notes move each time.',
      'On a dominant chord the 5th is replaced by the 13th — that is the "jazz" sound.',
      '"LH root + RH rootless voicing" is a rich two-hand sound for playing without a bassist.',
    ],
  },
  {
    id: 'minor-251',
    desc: 'm7♭5 – 7♭9 – m6: the minor cadence.',
    unit: 'voicings',
    title: 'Minor ii–V–i',
    level: 2,
    key: 'Cm',
    keys: JAZZ_MINOR_KEYS,
    tempo: 100,
    style: 'swing',
    chart: '| Dm7b5 | G7b9 | Cm6 | Cm6 |',
    parts: ['shells2', 'rootless'],
    about:
      'In a minor key the ii chord is half-diminished (m7♭5) and the V chord usually gets a ♭9. The guide tones work exactly as in major. The ♭9 of the V chord is the same note as the ♭5 of the ii chord — that dark note carries the minor sound across the progression.',
    tips: [
      'A rootless G7♭9 (B D F A♭) is the same set of notes as a diminished 7th chord built on B.',
      'Standards such as Autumn Leaves and Blue Bossa are built from these progressions.',
    ],
  },

  // ---------------- 3 · Lines & vocabulary ----------------
  {
    id: 'chord-scales',
    desc: 'Dorian, Mixolydian and Ionian in swing eighths.',
    unit: 'lines',
    title: 'Chord scales: Dorian, Mixolydian, Ionian',
    level: 1,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 90,
    style: 'swing',
    chart: II_V_I,
    parts: ['scale'],
    about:
      'In a major ii–V–I all three chords come from the same parent scale, but starting each scale on the chord root (Dorian on ii, Mixolydian on V, Ionian on I) puts the chord tones on the strong beats. Play the eighth notes with a swing feel: long-short, long-short, with a light accent on the off-beats.',
    tips: [
      'Feel beats 2 and 4 — tap your foot or snap on them. Jazz lives on the backbeat.',
      'Play legato and quietly; swing comes from relaxation, not force.',
    ],
  },
  {
    id: 'arpeggios',
    desc: '1-3-5-7 up and down through the changes.',
    unit: 'lines',
    title: 'Arpeggios: outlining the changes',
    level: 1,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 90,
    style: 'swing',
    chart: II_V_I,
    parts: ['arpeggio'],
    about:
      'Running up and down the four chord tones (1-3-5-7) is the most direct way to make a line "say" the chord. It is also the best way to memorise a tune\'s harmony: if you can arpeggiate the changes in time, you really know them.',
    tips: ['Keep a relaxed hand position; use thumb-under fingering for the octave.'],
  },
  {
    id: 'digital',
    desc: 'Coltrane-style four-note cells.',
    unit: 'lines',
    title: '1–2–3–5 patterns',
    level: 2,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 110,
    style: 'swing',
    chart: '| Dm7 G7 | Cmaj7 |',
    parts: ['digital'],
    about:
      'Four-note cells like 1-2-3-5 ("digital patterns", heard a lot from John Coltrane) fit one chord per two beats and give your lines shape and drive. Here the ii–V lasts one bar, so the pattern changes every two beats.',
    tips: ['Play them evenly first, then add a little accent to the highest note.'],
  },
  {
    id: 'enclosures',
    desc: 'Surround the target note, bebop style.',
    unit: 'lines',
    title: 'Enclosures',
    level: 2,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 100,
    style: 'swing',
    chart: '| Dm7 | G7 | Cmaj7 | A7 | Dm7 | G7 | Cmaj7 | Cmaj7 |',
    parts: ['enclosure'],
    about:
      'An enclosure "surrounds" a target note: a scale step above, then a half step below, then the target on the beat. Here the target is always the 3rd of the chord. Bebop players (Charlie Parker, Bud Powell) used enclosures constantly — they make a line sound unmistakably jazz.',
    tips: [
      'The target lands on the beat; the two approach notes come just before it.',
      'Over A7 the 3rd is C♯, so the half step below is B♯ (the same key as C).',
    ],
  },
  {
    id: 'bebop',
    desc: 'The 8-note scale that puts chord tones on the beat.',
    unit: 'lines',
    title: 'The bebop dominant scale',
    level: 2,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 110,
    style: 'swing',
    chart: '| G7 | C6 |',
    parts: ['bebop'],
    about:
      'Add a passing note (the major 7th) to the Mixolydian scale and you get the bebop dominant scale: 8 notes, so running down from the root puts chord tones (1, ♭7, 5, 3) on every beat. The line then resolves to the next chord.',
    tips: [
      'Descending from G: G F♯ F E D C B A — chord tones G, F, D, B land on beats 1–4.',
      'The resolution bar plays 5–3–1 of the new chord.',
    ],
  },
  {
    id: 'blues-scale',
    desc: 'The blues scale and the ♭3 → 3 slide.',
    unit: 'lines',
    title: 'The blues scale & a first lick',
    level: 1,
    key: 'F',
    keys: ['F', 'Bb', 'C', 'G', 'Eb', 'D', 'Ab', 'A', 'E', 'Db', 'B', 'Gb'], // every key, most common blues keys first
    tempo: 100,
    style: 'swing',
    chart: '| F7 | F7 | F7 | F7 |',
    customParts: [
      {
        id: 'bluesScale',
        name: 'Blues scale & lick',
        notation: `| F4/8 Ab4/8 Bb4/8 B4/8 C5/8 Eb5/8 F5/4 | Eb5/8 C5/8 B4/8 Bb4/8 Ab4/8 F4/8 r/4
                   | C5/8 Eb5/8 F5/8 Eb5/8 C5/8 Bb4/8 Ab4/8 F4/8 | Ab4/8 A4/8 C5/4 F4/2 |`,
      },
    ],
    parts: ['bluesScale'],
    about:
      'The blues scale (1 ♭3 4 ♯4 5 ♭7) gives you the "bluesy" sound straight away. The last bar shows the most important blues move of all: the ♭3 bending up to the major 3rd (A♭ → A over F7).',
    tips: ['Slide from A♭ to A with the same finger (2 → 2) for a more vocal sound.'],
  },

  // ---------------- 4 · Rhythm, comping & bass ----------------
  {
    id: 'swing-eighths',
    desc: 'Long-short eighths, off-beats and pushes.',
    unit: 'comping',
    title: 'Swing eighths & off-beats',
    level: 1,
    key: 'C',
    keys: ['C', 'F', 'Bb'],
    tempo: 100,
    style: 'swing',
    chart: C_BLUES,
    customParts: [
      {
        id: 'swingStudy',
        name: 'Swing rhythm study',
        notation: `| C5/4 E5/4 G5/4 E5/4 | F5/4 A5/4 C5/4 A4/4 | C5/8 D5/8 E5/8 G5/8 A5/8 G5/8 E5/8 D5/8 | C5/8 E5/8 G5/8 A5/8 G5/8 E5/8 C5/4
                   | r/8 F4/8 A4/8 C5/8 Eb5/4 C5/4 | r/8 A4/8 C5/8 Eb5/8 D5/8 C5/8 A4/4 | r/8 G4/8 r/8 Bb4/8 r/8 C5/8 r/8 E5/8 | r/8 G5/8 r/8 E5/8 r/8 C5/8 G4/4
                   | B4/4. D5/8 F5/4. D5/8 | A4/4. C5/8 Eb5/4. C5/8 | E5/8 G5/8 r/4 G5/8 E5/8 r/4 | D5/8 F5/8 B4/4 r/4 r/8 G4/8 |`,
      },
    ],
    parts: ['swingStudy'],
    about:
      'Jazz eighth notes are not even: the first of each pair is longer and the second shorter and a little accented — "doo-BAH, doo-BAH". This 12-bar study moves through the basic rhythms two bars at a time: quarter notes, swung eighths, phrases that start on the "and", notes only on the off-beats, dotted-quarter pushes, and short "doo-dat" endings. With the band, your timing is scored against the swing.',
    tips: [
      'Say the rhythm out loud first: "doo-BAH doo-BAH". The "and" gets the accent.',
      'Tap your foot or snap on 2 and 4 — that is where the drummer’s hi-hat is.',
      'The rests count. In bars 5–8 the phrases start on the "and": wait for it.',
    ],
  },
  {
    id: 'two-and-four',
    desc: 'Short chords on the backbeat.',
    unit: 'comping',
    title: 'Comping on 2 and 4',
    level: 1,
    key: 'C',
    keys: ['C', 'F', 'Bb'],
    tempo: 110,
    style: 'swing',
    rhythm: 'twoFour',
    chart: '| Dm7 | G7 | Cmaj7 | A7 | Dm7 | G7 | Cmaj7 | Cmaj7 |',
    parts: ['guide', 'rootless'],
    about:
      'The simplest comping rhythm is also one of the most swinging: short chords on beats 2 and 4, together with the drummer’s hi-hat. The bass walks on every beat and the drums ride on 1, 2, 3 and 4, so your chords sit on the backbeat and lift the band.',
    tips: [
      'Short and light — lift your hand right away, like a snare drum.',
      'Feel beats 1 and 3 without playing them: the bass has them.',
    ],
  },
  {
    id: 'charleston',
    desc: 'Comp a jazz blues with the classic rhythm.',
    unit: 'comping',
    title: 'Comping the blues: the Charleston rhythm',
    level: 2,
    key: 'F',
    keys: ['F', 'Bb', 'C'],
    tempo: 120,
    style: 'swing',
    rhythm: 'charleston',
    chart: F_BLUES,
    parts: ['guide', 'rootless'],
    about:
      '"Comping" (accompanying) means playing chords in a rhythm that supports the soloist. The Charleston rhythm — a dotted quarter on 1, then a short chord on the "and" of 2 — is the first comping rhythm every jazz pianist learns. This is a 12-bar jazz blues, the most common form in jazz.',
    tips: [
      'Keep the second hit short and light, like a snare drum accent.',
      'Jazz blues: I7 – IV7 – I7 – (ii–V to IV) – IV7 – #iv° – I7 – VI7 – ii – V – I–VI – ii–V.',
    ],
  },
  {
    id: 'reverse-charleston',
    desc: 'The "and" of 1, then beat 3.',
    unit: 'comping',
    title: 'The reverse Charleston',
    level: 2,
    key: 'Gm',
    keys: ['Gm', 'Cm', 'Dm'],
    tempo: 110,
    style: 'swing',
    rhythm: 'reverse',
    chart: '| Cm7 | F7 | Bbmaj7 | Ebmaj7 | Am7b5 | D7b9 | Gm6 | Gm6 |',
    parts: ['guide', 'rootless'],
    about:
      'Turn the Charleston around: the first chord comes on the "and" of 1, just after the downbeat, and the second lands on beat 3. Starting off the beat makes the comping lean forward. Practise it on a ii–V chain in G minor — the changes of many minor standards.',
    tips: [
      'Let the bass have beat 1 to itself; your chord answers half a beat later.',
      'Mix it with the Charleston: one bar each way already sounds like real comping.',
    ],
  },
  {
    id: 'offbeat-comping',
    desc: 'Chords on the "and"s that push the band.',
    unit: 'comping',
    title: 'Off-beat comping',
    level: 2,
    key: 'F',
    keys: ['F', 'Bb', 'C'],
    tempo: 120,
    style: 'swing',
    rhythm: 'offbeats',
    chart: F_BLUES,
    parts: ['guide', 'rootless'],
    about:
      'Short chords on the "and" of 2 and the "and" of 4 push the band forward. This light, off-beat comping is the sound of pianists like Red Garland and Wynton Kelly. With swing the "and" comes late, just before the next beat — listen to the ride cymbal and land with it.',
    tips: [
      'Keep the chords very short; the space between them is part of the rhythm.',
      'If you rush, count "1 AND 2 AND…" and play only on the ANDs after 2 and 4.',
    ],
  },
  {
    id: 'walking-251',
    desc: 'Be the bass player: quarter notes that lead on.',
    unit: 'comping',
    title: 'Walking bass on ii–V–I',
    level: 2,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 100,
    style: 'swing',
    chart: '| Dm7 | G7 | Cmaj7 | A7 | Dm7 | G7 | Cmaj7 | Cmaj7 |',
    parts: ['twoFeel', 'walking'],
    about:
      'Without a bass player, the pianist’s left hand becomes the bass. Start with a two-feel — the root and the 5th in half notes. Then walk in quarter notes: up the chord (1, 3, 5) and, on the last beat, a note a half step above or below the next root. That approach note is what makes a walking line sound like it is going somewhere.',
    tips: [
      'Play legato and even: every quarter note the same length and weight, like a bass player.',
      'The note before each chord change is always a half step from the next root.',
      'With the band, the bass player sits out — you are the bass.',
    ],
  },
  {
    id: 'walking-blues',
    desc: 'Walking bass under right-hand guide tones.',
    unit: 'comping',
    title: 'Walking the blues',
    level: 3,
    key: 'F',
    keys: ['F', 'Bb', 'C'],
    tempo: 110,
    style: 'swing',
    chart: F_BLUES,
    parts: ['walking', 'guideLine+walking'],
    about:
      'The 12-bar jazz blues with a walking left hand. When the bass line runs by itself, add the right hand: the guide-tone line (3rds and 7ths) on top. Walking bass plus guide tones is a complete solo-piano sound.',
    tips: [
      'Learn the bass line alone until it runs on autopilot, then add the right hand one bar at a time.',
      'In bars with two chords the bass plays two notes per chord: the root, then the approach note.',
    ],
  },

  // ---------------- 5 · Blues, boogie & ragtime ----------------
  {
    id: 'blues-shuffle',
    desc: 'The 12-bar form with a rocking 5–6–♭7 left hand.',
    unit: 'blues',
    title: '12-bar blues: the left-hand shuffle',
    level: 1,
    key: 'C',
    keys: ['C', 'F', 'Bb', 'G'],
    tempo: 100,
    style: 'shuffle',
    chart: C_BLUES,
    parts: ['shuffle', 'guideLine+shuffle'],
    about:
      'The 12-bar blues is the root of jazz, rock and roll and R&B: four bars of the I chord, two of IV, two of I, then V – IV – I – V. The left-hand shuffle rocks between the 5th, 6th and ♭7th above the root — the sound of Chuck Berry, Fats Domino and countless blues pianists.',
    tips: [
      'Keep your thumb on the moving note and your little finger anchored on the root.',
      'Play the eighths long-short (shuffle feel), with a little weight on beats 2 and 4.',
      'This version uses the "quick change": the IV chord already appears in bar 2.',
    ],
  },
  {
    id: 'blues-licks',
    desc: 'A blues head over the left-hand shuffle.',
    unit: 'blues',
    title: 'Blues licks over the shuffle',
    level: 2,
    key: 'C',
    keys: ['C', 'F', 'Bb'],
    tempo: 96,
    style: 'shuffle',
    credit: 'Original blues head written for BeBop Dots',
    chart: C_BLUES,
    melody: `| G4/8 Bb4/8 C5/4 Eb5/8 E5/8 C5/4 | Eb5/4 C5/8 A4/8 C5/2 | G4/8 Bb4/8 C5/4 Eb5/8 E5/8 G5/4 | E5/8 C5/8 Bb4/4 C5/2
             | C5/8 Eb5/8 F5/4 Ab5/8 A5/8 F5/4 | Eb5/4 C5/8 A4/8 F4/2 | G4/8 Bb4/8 C5/4 Eb5/8 E5/8 C5/4 | Bb4/4 G4/4 E4/2
             | D5/8 F5/8 G5/4 B4/2 | A4/8 C5/8 Eb5/4 A4/2 | G4/8 Bb4/8 C5/4 Eb5/8 E5/8 C5/4 | B4/4 D5/4 F5/4 r/4 |`,
    parts: ['melody', 'melody+shuffle'],
    about:
      'A 12-bar head built from classic blues vocabulary: the ♭3 → 3 slide (E♭ → E), the ♭7 of each chord, and the same riff moved up to the IV chord. Learn it in the right hand first, then put it over the left-hand shuffle — that is real blues piano.',
    tips: [
      'Lean into the E♭ and let it resolve to E — that "blue" tension is the whole point.',
      'Both hands together: practise one bar at a time until the shuffle runs on autopilot.',
    ],
  },
  {
    id: 'boogie',
    desc: 'Walking boogie bass, octaves and a right-hand riff.',
    unit: 'blues',
    title: 'Boogie-woogie',
    level: 2,
    key: 'C',
    keys: ['C', 'F', 'Bb', 'G'],
    tempo: 110,
    style: 'shuffle',
    chart: C_BLUES,
    parts: ['boogieBass', 'octaveBoogie', 'crush+boogieBass'],
    about:
      'Boogie-woogie is blues piano with a relentless, driving left hand — Albert Ammons, Meade Lux Lewis and Pete Johnson made it the dance music of the 1930s. First the classic walking bass (1-3-5-6-♭7-6-5-3), then walking octaves, then a right-hand riff on top: the ♭3 "crushed" into the 3rd.',
    tips: [
      'The left hand must never stop. If both hands together are hard, slow down — never break the bass.',
      'Walking octaves: keep the hand open in an octave shape and rock between thumb and little finger.',
      'The right-hand riff sits off the beat — it answers the left hand.',
    ],
  },
  {
    id: 'ragtime',
    desc: 'Oom-pah left hand and a syncopated melody.',
    unit: 'blues',
    title: 'Ragtime: oom-pah & syncopation',
    level: 2,
    key: 'C',
    keys: ['C', 'F', 'Bb'],
    tempo: 88,
    style: 'rag',
    credit: 'Original rag written for BeBop Dots. Listen to Scott Joplin: "Maple Leaf Rag", "The Entertainer"',
    chart: '| C | C | G7 | G7 | C | C7 | F | F | C | A7 | D7 | G7 | C | G7 | C | C |',
    melody: `| E5/8 G5/4 E5/8 C5/4 G4/4 | A4/8 C5/4 A4/8 G4/2 | D5/8 F5/4 D5/8 B4/4 G4/4 | F5/8 E5/8 D5/8 B4/8 G4/2
             | E5/8 G5/4 E5/8 C5/4 G4/4 | Bb4/8 C5/4 E5/8 G5/4 Bb5/4 | F5/8 A5/4 F5/8 C5/4 A4/4 | D5/8 C5/8 A4/8 F4/8 A4/2
             | G4/8 C5/4 E5/8 G5/4 E5/4 | C#5/8 E5/4 C#5/8 A4/4 G4/4 | F#4/8 A4/4 C5/8 D5/4 C5/4 | B4/8 D5/4 F5/8 G5/4 F5/4
             | E5/8 G5/4 E5/8 C5/4 G4/4 | F4/8 G4/4 B4/8 D5/4 F5/4 | E5/4 G4/4 C5/2 | [C5 E5 G5]/2 r/2 |`,
    parts: ['stride', 'melody', 'melody+stride'],
    about:
      'Ragtime (Scott Joplin, around 1900) is the ancestor of jazz piano. The left hand plays "oom-pah": a bass note on beats 1 and 3, a chord on 2 and 4. Against that steady march the right hand syncopates — short-long-short — so the melody seems to arrive early. The eighths are straight, not swung.',
    tips: [
      'Oom-pah: jump from the low bass note to the chord without looking — aim with the hand shape, not the eyes.',
      'Not too fast! Joplin wrote on his rags: "It is never right to play ragtime fast."',
      'The A7 → D7 → G7 → C chain in bars 10–13 is the ragtime cycle you will meet again in jazz standards.',
    ],
  },

  // ---------------- 6 · Ideas from The Jazz Piano Book (Mark Levine) ----------------
  {
    id: 'melodic-minor',
    desc: 'Altered and ♯11 dominants from one scale.',
    unit: 'levine',
    title: 'Melodic minor harmony',
    level: 2,
    key: 'Cm',
    keys: JAZZ_MINOR_KEYS,
    tempo: 100,
    style: 'swing',
    credit: LEVINE,
    chart: '| Dm7b5 | G7alt | Cm6 | Cm6 | Db7#11 | G7alt | CmMaj7 | CmMaj7 |',
    parts: ['scale', 'rootless'],
    about:
      'The ascending melodic minor scale — a major scale with a ♭3 — is where the most modern-sounding chords in jazz come from. Its modes give the minor-major chord, the Lydian dominant (7♯11) and the altered dominant (7alt). In this progression G7alt and D♭7♯11 come from the same scale, A♭ melodic minor, which is one reason a tritone substitute sounds right.',
    tips: [
      'G altered = A♭ melodic minor played from G: it holds every altered tension (♭9, ♯9, ♭5, ♭13).',
      'D♭7♯11 = A♭ melodic minor played from D♭: the same notes as G7alt over a different bass note.',
      'On m7♭5 try Locrian ♮2 (melodic minor from the chord’s ♭3) instead of plain Locrian — the 9th is brighter.',
    ],
  },
  {
    id: 'tritone-subs',
    desc: 'Swap V7 for the dominant a tritone away.',
    unit: 'levine',
    title: 'Tritone substitution',
    level: 2,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 110,
    style: 'swing',
    credit: LEVINE,
    chart: '| Dm7 | G7 | Cmaj7 | Cmaj7 | Dm7 | Db7 | Cmaj7 | Cmaj7 | Abm7 | Db7 | Cmaj7 | Cmaj7 |',
    parts: ['shells2', 'rootless'],
    about:
      'Two dominant chords whose roots are a tritone apart, like G7 and D♭7, share their 3rd and 7th — B and F, just swapped (in D♭7 the B is spelled C♭). So either chord can resolve to C. With D♭7 the bass falls by half steps, D → D♭ → C. You can also put the substitute’s own ii chord in front of it: A♭m7 – D♭7 – Cmaj7.',
    tips: [
      'Play the shells and listen: the upper note barely moves while the root slides down by half steps.',
      'Compare the rootless voicings of G7 and D♭7 — the guide tones are the same two keys.',
      'A rootless D♭13 uses the same four keys as G7 altered: that is the sound of the substitution.',
    ],
  },
  {
    id: 'so-what',
    desc: 'Three 4ths and a 3rd: the modal-jazz sound.',
    unit: 'levine',
    title: 'So What chords',
    level: 2,
    key: 'Dm',
    keys: ['Dm', 'Cm', 'Em'],
    tempo: 120,
    style: 'swing',
    credit: LEVINE,
    chart: '| Dm7 | Dm7 | Ebm7 | Ebm7 | Cm7 | F7sus4 | Bbmaj7 | Bbmaj7 |',
    parts: ['soWhat', 'soWhatAmen'],
    about:
      'A "So What" chord is three perfect 4ths with a major 3rd on top: D G C F A on Dm7. It is named after Miles Davis’s "So What" (1959), where chords like this answer the bass riff, and it became the classic sound of modal jazz. The left hand takes the three low notes, the right hand the top two. Because the shape is built from 4ths, one shape fits several chords: Cm7 and F7sus use the same five notes, and on B♭maj7 the shape starts on the 3rd.',
    tips: [
      'Left hand: D G C (two 4ths). Right hand: F A (a major 3rd), a 4th above the left hand.',
      'The second exercise plays the shape a step higher first (E A D G B), then back on D — both shapes fit D Dorian.',
      'Dm7 and B♭maj7 get exactly the same five notes. Only the bass note changes the chord’s name.',
    ],
  },
  {
    id: 'fourths',
    desc: 'McCoy Tyner’s open, modern sound.',
    unit: 'levine',
    title: 'Fourth voicings',
    level: 2,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 120,
    style: 'swing',
    credit: LEVINE,
    chart: '| Dm7 | G7 | Cmaj7 | A7alt | Dm7 | G7 | Cmaj7 | Cmaj7 |',
    parts: ['fourths', 'mccoy'],
    about:
      'Stack notes in perfect 4ths instead of 3rds and the chord stops sounding plainly major or minor — it becomes open and modern. McCoy Tyner built his style on this: an open 5th low in the left hand and 4th voicings above it in the right. Take each stack from the chord’s scale: G C F on Dm7, B E A on G7 (3rd, 13th, 9th), E A D on Cmaj7.',
    tips: [
      'One stack fits several chords: E A D works for Cmaj7, Am7 and D7sus.',
      'Left hand alone first; then the two-hand version, with root–5th–root low in the left hand.',
      'On A7alt the stack is G C F: the ♭7, ♯9 and ♭13.',
    ],
  },
  {
    id: 'upper-structures',
    desc: 'A triad over the tritone: instant tensions.',
    unit: 'levine',
    title: 'Upper-structure triads',
    level: 3,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 100,
    style: 'swing',
    credit: LEVINE,
    chart: '| Dm7 | G7alt | Cmaj7 | A7alt | Dm7 | G7#11 | Cmaj7 | Cmaj7 |',
    parts: ['guide', 'upper'],
    about:
      'An upper structure is a plain triad played over the 3rd and 7th of a chord. The triad supplies the tensions, so you can think "E♭ major over G7" instead of "♭13, root and ♯9". Over a dominant, the major triad on the ♭6 gives the altered sound and the major triad on the 2nd gives ♯11 (Lydian dominant). Over the other chords, the triad on the 5th adds the 9th.',
    tips: [
      'Learn the left hand first (the guide-tone exercise), then add the right-hand triads.',
      'G7alt: E♭ major over B–F. G7♯11: A major over B–F. Cmaj7: G major over E–B.',
      'Dm7: A minor over F–C gives Dm9.',
    ],
  },
  {
    id: 'drop-2',
    desc: 'Spread a close voicing across both hands.',
    unit: 'levine',
    title: 'Drop 2 voicings',
    level: 3,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 110,
    style: 'swing',
    credit: LEVINE,
    chart: '| Dm7 | G7 | Cmaj7 | A7alt | Dm7 | G7alt | Cmaj7 | Cmaj7 |',
    parts: ['drop2'],
    about:
      'Take a four-note chord in close position and drop its second-highest note an octave: that is a "drop 2" voicing. The chord now spans more than an octave, so it sounds fuller, like a horn section, and the dropped note falls naturally to the left hand. Drop 2 is the basis of block-chord playing and of most guitar and big-band voicings.',
    tips: [
      'Cmaj9 without the root, in close position: G B D E. Drop the D and you get D | G B E.',
      'Left hand one note, right hand three. Let the top note sing — it is the melody.',
      'Each chord moves to the nearest drop 2 shape of the next, so the hands hardly travel.',
    ],
  },
  {
    id: 'pentatonics',
    desc: 'Which five-note scale over which chord.',
    unit: 'levine',
    title: 'Pentatonic scales',
    level: 2,
    key: 'C',
    keys: JAZZ_KEYS,
    tempo: 110,
    style: 'swing',
    credit: LEVINE,
    chart: '| Dm7 | G7sus4 | Cmaj7 | Cmaj7 | Dm7 | G7alt | Cmaj7 | Cmaj7 |',
    parts: ['pentatonic'],
    about:
      'A pentatonic scale has no half steps, so it never sounds wrong — the skill is choosing which one. Over Dm7 play D minor pentatonic; over G7sus, F major pentatonic; over Cmaj7, G major pentatonic, which brings out the 9th and the 7th; over G7alt, D♭ major pentatonic, which is made entirely of altered tensions.',
    tips: [
      'D♭ pentatonic over G7alt: A♭ B♭ D♭ E♭ F = ♭9, ♯9, ♭5, ♭13, ♭7.',
      'D minor and F major pentatonic are the same five notes — and fit both Dm7 and G7sus.',
      'Once the line is comfortable, try four-note groups up the scale, the way McCoy Tyner plays them.',
    ],
  },

  // ---------------- 7 · Songs ----------------
  {
    id: 'saints',
    desc: 'The New Orleans classic: melody and shells.',
    unit: 'standards',
    title: 'When the Saints Go Marching In',
    level: 1,
    key: 'C',
    keys: ['C', 'Bb', 'F'],
    tempo: 120,
    style: 'two',
    credit: 'Traditional (public domain)',
    chart: '| C6 | C6 | C6 | C6 | C6 | C6 | C6 | G7 | G7 | C6 | C7 | F6 | Fm6 | C6 | G7 | C6 |',
    melody: `| r/4 C5/4 E5/4 F5/4 | G5/1 | r/4 C5/4 E5/4 F5/4 | G5/1 | r/4 C5/4 E5/4 F5/4 | G5/2 E5/2
             | C5/2 E5/2 | D5/1 | r/4 E5/4 E5/4 D5/4 | C5/2. C5/4 | E5/2 G5/2 | G5/4 F5/2.
             | r/2 E5/4 F5/4 | G5/2 E5/2 | C5/2 D5/2 | C5/1 |`,
    parts: ['melody', 'shells2', 'melody+shells2'],
    tips: [
      'Swing the quarter notes gently: lean on beats 2 and 4.',
      'The C7 → F6 → Fm6 → C6 move in bars 11–14 is a classic sound — listen for the F → F minor colour change.',
      'Bar 1 is the pick-up ("Oh when the…").',
    ],
  },
  {
    id: 'riff-blues',
    desc: 'A riff tune on the jazz blues.',
    unit: 'standards',
    title: 'Riff Blues in F',
    level: 1,
    key: 'F',
    keys: ['F', 'Bb'],
    tempo: 120,
    style: 'swing',
    credit: 'Original head written for BeBop Dots, on a standard jazz blues',
    chart: F_BLUES,
    melody: `| F4/4 Ab4/8 A4/8 C5/4 A4/4 | F4/2 r/2 | F4/4 Ab4/8 A4/8 C5/4 A4/4 | Eb5/2 r/2
             | Bb4/4 Db5/8 D5/8 F5/4 D5/4 | Ab4/2 r/2 | F4/4 Ab4/8 A4/8 C5/4 A4/4 | C5/2 F#4/2
             | G4/4 A4/8 Bb4/8 D5/4 Bb4/4 | C5/4 Bb4/4 G4/4 E4/4 | F4/4 A4/4 F#4/4 A4/4 | Bb4/4 G4/4 E4/4 C4/4 |`,
    parts: ['melody', 'shells2', 'melody+shells2'],
    tips: ['The A♭ → A move is the "blue note" bending into the major 3rd.'],
  },
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id);
