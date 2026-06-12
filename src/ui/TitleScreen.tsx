// TitleScreen — the anthology frame. Shown at phase === "title".
//
// Six incidents from Sor's career (CHARACTER-SOR.md). One is playable;
// the other five are visible as locked datelines — the shape of the game
// communicated without a word of explanation. The dawn scene idles behind
// the overlay.
//
// All text here is datelines and place names from the character bible —
// no new narrative content (Rule 2 / Rule 4 discipline).

import { useGame } from "../store";

interface IncidentEntry {
  n:      string;
  place:  string;
  date:   string;
  open:   boolean;
}

const INCIDENTS: IncidentEntry[] = [
  { n: "01", place: "Sinjar",     date: "August 2014",   open: false },
  { n: "02", place: "Kobani",     date: "January 2015",  open: false },
  { n: "03", place: "East Mosul", date: "October 2016",  open: false },
  { n: "04", place: "West Mosul", date: "June 2017",     open: true  },
  { n: "05", place: "Raqqa",      date: "October 2017",  open: false },
  { n: "06", place: "al-Hawl",    date: "February 2019", open: false },
];

export default function TitleScreen() {
  const phase     = useGame(s => s.phase);
  const openIntro = useGame(s => s.openIntro);

  if (phase !== "title") return null;

  return (
    <div className="title-screen" role="dialog" aria-modal="true">
      <div className="title-inner">
        <h1 className="title-name">the fixer</h1>
        <p className="title-sub">incidents · 2014–2019</p>

        <ul className="title-incidents">
          {INCIDENTS.map((inc) =>
            inc.open ? (
              <li key={inc.n}>
                <button
                  type="button"
                  className="title-incident title-incident--open"
                  onClick={openIntro}
                >
                  <span className="ti-n">{inc.n}</span>
                  <span className="ti-place">{inc.place}</span>
                  <span className="ti-date">{inc.date}</span>
                </button>
              </li>
            ) : (
              <li key={inc.n}>
                <div className="title-incident title-incident--locked" aria-disabled="true">
                  <span className="ti-n">{inc.n}</span>
                  <span className="ti-place">{inc.place}</span>
                  <span className="ti-date">{inc.date}</span>
                </div>
              </li>
            ),
          )}
        </ul>

        <p className="title-foot">one incident playable — more in development</p>
      </div>
    </div>
  );
}
