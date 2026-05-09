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
      when the truck crosses it. Will be wired up when the route is built. */
  beats: { triggerZ: number; text: string }[];

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
    "Engine on at 04:47. The streets are still empty.",
  ],

  beats: [
    { triggerZ: -100, text: "Bakhtiyar took an IED in the Old City three weeks ago. The videographer reminds you of him. You don't say." },
    { triggerZ: -85,  text: "Awat. He stopped driving in '15. He was tired. Now he's a stone." },
    { triggerZ: -32,  text: "The Hilux took a JDAM in March. Two were inside. Coalition said they had clearance." },
    { triggerZ: -12,  text: "Shifa Gardi. Rudaw. February. The bomb was not for her." },
    { triggerZ:  35,  text: "They've been told there are papers crossing tonight. They don't know which truck." },
    { triggerZ:  90,  text: "Every house here has someone who didn't come back." },
  ],

  endings: {
    clean: [
      "JUNE 2017 — AFTER",
      "You drop them at the Divan. They fly Friday.",
      "The piece runs in three weeks. Six pages, color photographs, the names of the brothers in the captions. People read the names.",
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
