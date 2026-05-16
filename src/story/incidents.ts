// Incidents — the story data. Each incident is one playable run from
// Sor's career across the war (2014–2019). Six are sketched in the
// character bible; only the canonical 2017 Mosul run is fleshed out here.
//
// All text is second-person, present tense. Sor is silent. The player
// is in his seat.

export interface IncidentText {
  id:    string;
  date:  string;        // dateline shown in the intro card header

  /** Intro card paragraphs. First line is the dateline (small caps). */
  intro: string[];

  /** Position-triggered mid-run beats. triggerZ is world-z; beat fires
      when the truck crosses it.
      cargoRisk: if true, StoryWatcher checks truck speed when this beat fires
      — above threshold, one cargo item is lost. */
  beats: { triggerZ: number; text: string; cargoRisk?: boolean }[];

  /** Ending variants by cargo state. */
  endings: {
    clean:   string[];
    partial: string[];
    failed:  string[];
  };
}

export const CANONICAL_2017: IncidentText = {
  id:   "west-mosul-2017",
  date: "June 2017",

  intro: [
    "JUNE 2017 — OLD CITY",
    "The old city is mostly bricks now.",
    "You drove a French team last week. They were yours all morning. They sent another.",
    "This one is two: a journalist, and the videographer she works with. She's American. He's not.",
    "The interview is with a woman whose brothers were taken in 2014. She has agreed to a name and a face.",
    "Two camera cases. A satellite phone. Body armour they haven't worn yet. A hard drive of last week's footage.",
    "Engine on at 04:47.",
  ],

  // Beats are evenly spread across the 220 m run (SPAWN_Z -100 → END_Z +120).
  // Each fires once. Tonal mix: logistics → grief → dark pause → civilian
  // cost → tactical awareness → ellipsis. Not all elegies. Not all death.
  // Beats are evenly spread across the 220 m run (SPAWN_Z -100 → END_Z +120).
  // cargoRisk beats: beats 0, 2, 4 — checkpoint, radio, Hilux.
  // If truck speed > 8 m/s when a risk beat fires, one cargo item is lost.
  // This means: drive fast through a checkpoint = look suspicious, rush the
  // radio turn = journalist drops something, close the Hilux gap = near miss.
  beats: [
    {
      triggerZ: -75,
      cargoRisk: true,
      text: "The checkpoint has been here three weeks. The soldier waves you through with his cigarette. He knows the truck.",
    },
    {
      triggerZ: -42,
      text: "Bakhtiyar took an IED in Old City three weeks ago. The videographer is the same age. Same build.",
    },
    {
      triggerZ: -10,
      cargoRisk: true,
      text: "Your radio picks up Rudaw. You turn it off before she asks what they're saying.",
    },
    {
      triggerZ: +22,
      text: "Awat stopped driving in '15. Said he was tired. His wife runs the vegetable stall now, alone.",
    },
    {
      triggerZ: +58,
      cargoRisk: true,
      text: "The Hilux ahead has a green flag in the window. You keep two hundred metres between you. Standard.",
    },
    {
      triggerZ: +95,
      text: "Shifa Gardi. Rudaw. February. The camera she used that day is still in evidence somewhere.",
    },
  ],

  endings: {
    clean: [
      "JUNE 2017 — AFTER",
      "You drop them at the Divan. They fly Friday.",
      "The piece runs in three weeks. Six pages, color photographs. The brothers are named in the captions.",
      "You drive home to Ankawa.",
      "The phone rings at 02:00 on Sunday. Another one is in tonight.",
    ],
    partial: [
      "JUNE 2017 — AFTER",
      "You drop them at the Divan. The journalist tells the desk what footage survived.",
      "The piece runs partial. The names are in the captions but the photographs are someone else's.",
      "Critics will note the gaps. You don't read the criticism.",
      "You drive home to Ankawa. The phone rings on Sunday.",
    ],
    failed: [
      "JUNE 2017 — AFTER",
      "You drop them at the Divan. They don't speak much on the way back.",
      "The story does not file in time. The desk runs something else.",
      "The interview is published a year later in a book that almost no one buys. Her brothers are still named, somewhere. Just not where the world will read them.",
      "You drive home to Ankawa. You don't sleep that night.",
    ],
  },
};

// More incidents (Sinjar 2014, Kobani 2015, East Mosul 2016, Raqqa 2017,
// al-Hawl 2019) live in the character bible. They get added here as data
// when the route system is generic enough to swap them.
