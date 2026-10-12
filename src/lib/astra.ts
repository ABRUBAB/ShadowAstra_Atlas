/**
 * Astra's brain: a small, transparent question-answering engine over our own data.
 * No language model and no internet, every answer is built from the catalogue,
 * the solar-geometry model and the distance maths, so it can never invent a fact.
 */
import { EARTH_SITES, REALITY_GAPS, TARGETS, TASKS, type EarthSite, type TargetSite, type TaskId, type World } from "../data/sites";
import { lightTwin } from "./sun";
import { greatCircleKm, HOME_BASES, tripCo2Tonnes } from "./scoring";

export interface AstraLink {
  label: string;
  to: string;
}
export interface AstraReply {
  text: string;
  mood: "happy" | "thinking" | "sad" | "wow" | "neutral";
  links?: AstraLink[];
  suggestions?: string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ");

const SITE_ALIASES: Record<string, string[]> = {
  "dry-valleys": ["dry valley", "mcmurdo", "antarctica"],
  haughton: ["haughton", "devon island"],
  atacama: ["atacama", "yungay", "chile"],
  "mauna-kea": ["mauna kea", "hawaii"],
  "lava-beds": ["lava beds"],
  lanzarote: ["lanzarote", "la corona", "canary"],
  "rio-tinto": ["rio tinto"],
  svalbard: ["svalbard", "bockfjord", "norway"],
  mdrs: ["mdrs", "mars desert research", "utah"],
  "meteor-crater": ["meteor crater", "arizona crater"],
  "black-point": ["black point"],
  askja: ["askja", "holuhraun", "iceland"],
  pilbara: ["pilbara", "dresser", "australia"],
  ries: ["ries", "nordlinger"],
  sudbury: ["sudbury"],
  dallol: ["dallol", "danakil", "ethiopia"],
  "death-valley": ["death valley"],
};
const TARGET_ALIASES: Record<string, string[]> = {
  shackleton: ["shackleton", "south pole", "moon base", "lunar base", "artemis"],
  malapert: ["malapert"],
  haworth: ["haworth"],
  "mons-mouton": ["mons mouton", "mouton", "viper"],
  nobile: ["nobile"],
  "de-gerlache": ["gerlache"],
  cabeus: ["cabeus", "lcross"],
  "marius-pit": ["marius"],
  "tranquillitatis-pit": ["tranquillitatis"],
  hadley: ["hadley", "apollo 15"],
  jezero: ["jezero", "perseverance"],
  gale: ["gale", "curiosity", "mount sharp"],
  arcadia: ["arcadia"],
  deuteronilus: ["deuteronilus"],
  arsia: ["arsia"],
  meridiani: ["meridiani", "opportunity"],
  utopia: ["utopia", "zhurong"],
  mawrth: ["mawrth"],
};
const TASK_WORDS: Record<TaskId, string[]> = {
  base: ["base", "habitat", "live", "crew", "outpost"],
  traverse: ["rover", "traverse", "drive", "driving", "walk", "eva", "mobility"],
  isru: ["isru", "regolith", "soil", "oxygen", "mining", "excavat", "brick"],
  ice: ["ice", "water", "frozen", "volatile", "permafrost"],
  caves: ["cave", "lava tube", "tube", "skylight", "pit"],
  astrobio: ["life", "astrobio", "fossil", "biosignature", "microb"],
  impact: ["impact", "crater geology", "meteor", "breccia"],
  polar: ["polar", "low sun", "shadow", "dark", "cold", "light"],
};

function findSite(q: string): EarthSite | undefined {
  return EARTH_SITES.find((s) => (SITE_ALIASES[s.id] ?? [s.name.toLowerCase()]).some((a) => q.includes(a)));
}
function findTarget(q: string): TargetSite | undefined {
  return TARGETS.find((t) => (TARGET_ALIASES[t.id] ?? [t.name.toLowerCase()]).some((a) => q.includes(a)));
}
function findTask(q: string): TaskId | undefined {
  let best: TaskId | undefined;
  let hits = 0;
  for (const [id, words] of Object.entries(TASK_WORDS) as [TaskId, string[]][]) {
    const n = words.filter((w) => q.includes(w)).length;
    if (n > hits) {
      hits = n;
      best = id;
    }
  }
  return best;
}
function findWorld(q: string): World | undefined {
  if (/\b(moon|lunar|artemis)\b/.test(q)) return "moon";
  if (/\b(mars|martian)\b/.test(q)) return "mars";
  return undefined;
}
function findHome(q: string) {
  return HOME_BASES.find((h) => q.includes(h.name.toLowerCase().split(/[ ,(]/)[0])) ?? HOME_BASES[0];
}
const lab = (e: string, t: string, task?: TaskId) => `/lab?earth=${e}&target=${t}${task ? `&task=${task}` : ""}`;
const taskLabel = (id: TaskId) => TASKS.find((t) => t.id === id)!.label.toLowerCase();

const FACTS = [
  "At the Moon's south pole the Sun never climbs more than about 1.5° above the horizon. Shadows there are hundreds of metres long.",
  "Some craters near the lunar south pole have not seen sunlight for billions of years. They are colder than Pluto's surface.",
  "In 2009 NASA's LCROSS probe hit Cabeus crater and found water ice in the plume.",
  "Apollo astronauts trained in Iceland in 1965 and 1967 because its fresh lava fields look like the Moon.",
  "Mars has 38% of Earth's gravity. No place on Earth can copy that, so we always show it as a gap.",
  "The Atacama Desert is so dry that some weather stations have never recorded rain.",
  "Haughton Crater on Devon Island is 23 km wide and hosts the Haughton-Mars Project field station.",
  "Curiosity has been climbing Mount Sharp inside Gale crater since 2014.",
  "A day on Mars (a sol) is 24 h 39 min. A day at the Moon's poles lasts about 29.5 Earth days.",
  "Lava tubes may shelter future crews from radiation, temperature swings and tiny meteorites.",
];

export const STARTERS = ["Where can I rehearse a Moon base?", "Best Earth site for Gale crater?", "Closest analog to Dhaka for Mars", "How is the score made?", "Tell me a space fact"];

export function pageGreeting(path: string): AstraReply {
  if (path.startsWith("/lab"))
    return {
      text: "You're in the Analog Lab. Pick ① an Earth site, ② a Moon or Mars target and ③ a task. I'll score the match. Ask me anything about it.",
      mood: "happy",
      suggestions: ["What does the score mean?", "Why is something marked Demo?", "What is the Shadow Lab?", "Closest analog to Dhaka for the Moon"],
    };
  if (path.startsWith("/atlas"))
    return {
      text: "This is the Atlas. Click a pin on the globe to see a site, or pick a mission task on the left to filter.",
      mood: "happy",
      suggestions: ["Which sites rehearse lava tubes?", "Where can I rehearse a Moon base?", "What maps can I see?"],
    };
  if (path.startsWith("/methods"))
    return { text: "This page shows our data and maths. Ask me to explain any part in simple words.", mood: "neutral", suggestions: ["How is the score made?", "Which NASA data do you use?", "What will the AI model do?"] };
  if (path.startsWith("/about")) return { text: "We are team ShadowAstra from Dhaka. Ask me about the team or the name.", mood: "happy", suggestions: ["Who is on the team?", "Why the name ShadowAstra?", "Tell me a space fact"] };
  return { text: "Hi, I'm Astra, your field-test astronaut. I can find Earth places to rehearse Moon and Mars missions. What do you want to test?", mood: "happy", suggestions: STARTERS };
}

export function astraAnswer(raw: string): AstraReply {
  const q = ` ${norm(raw)} `;
  const site = findSite(q);
  const target = findTarget(q);
  const task = findTask(q);
  const world = findWorld(q) ?? target?.body;

  if (/\b(hi|hello|hey|salam|assalamu)\b/.test(q) && q.trim().split(" ").length <= 3)
    return { text: "Hello! Tell me a Moon or Mars place, or a task like “lava tubes” or “rover driving”, and I'll find Earth places to practise.", mood: "happy", suggestions: STARTERS };

  if (/fact|fun|trivia|surprise/.test(q)) return { text: FACTS[Math.floor(Math.random() * FACTS.length)], mood: "wow", suggestions: ["Another fact", "Where can I rehearse a Moon base?"] };

  if (/team|who (are|made|built)|member/.test(q))
    return {
      text: "Team ShadowAstra is six people from Dhaka: Abdullah Rubab (team lead), Tanvir Hossin (planetary terrain), Mohammad Saniul Alam (experience design), Tasnuva Arif (development & testing), Md. Tanvir Hasan (science checks) and Mohammed Mahmud Parvez (film).",
      mood: "happy",
      links: [{ label: "Meet the team", to: "/about" }],
    };

  if (/name|shadowastra mean|why shadow/.test(q))
    return { text: "“Shadow” is for the dark craters at the Moon's south pole, where ice hides. “Astra” means stars. We study the shadows so crews can walk in the light.", mood: "happy" };

  if (/(what is|what s|define|meaning of).*(analog|analogue)|^ analog /.test(q))
    return {
      text: "An analog is a place on Earth that is similar to a place on the Moon or Mars in a useful way. Teams test rovers, tools and plans there before they fly. A good analog depends on the task: a place can be great for driving tests but useless for ice tests.",
      mood: "neutral",
      suggestions: ["How is the score made?", "Where can I rehearse a Moon base?"],
    };

  if (/score|calculat|how .*(work|made|compute)|weight|formula/.test(q))
    return {
      text: "The Analog Fit score goes from 0 to 1. We compare six things: topography, geology, temperature, lighting, regolith and radiation. Topography and lighting are measured live from NASA data. Geology, temperature and regolith are demo numbers until our model is trained. Radiation is always a gap, so we show it but never count it. The task you pick decides how much each part matters. 0.75 or more is a high match.",
      mood: "thinking",
      links: [{ label: "See the full method", to: "/methods" }],
    };

  if (/demo|real|fake|computed|honest/.test(q))
    return {
      text: "Green “Computed” values are measured right now from NASA elevation data and Sun geometry. Grey “Demo” values are placeholders from published research. They will be replaced by our trained model at the hackathon. We never hide which is which.",
      mood: "neutral",
    };

  if (/shadow lab|shadow|sunlight|illuminat/.test(q) && !target && !site)
    return {
      text: "The Shadow Lab puts a very low Sun around both terrains, like at the Moon's south pole. It finds ground that never gets light. Those dark spots are where ice can survive, so a good Moon-base rehearsal site needs some of them too.",
      mood: "wow",
      links: [{ label: "Try it: Dry Valleys vs Shackleton", to: lab("dry-valleys", "shackleton", "polar") }],
    };

  if (/gap|cannot|can t|gravity|radiation|vacuum|atmosphere|limit/.test(q)) {
    const w = world ?? "moon";
    return {
      text: `No place on Earth can copy these ${w === "moon" ? "Moon" : "Mars"} conditions: ${REALITY_GAPS[w].join(", ")}. We show them next to every score so nobody forgets.`,
      mood: "sad",
    };
  }

  if (/data|dataset|nasa|source|satellite|map/.test(q))
    return {
      text: "We use NASA GIBS maps (Blue Marble, MODIS, ASTER, VIIRS), NASA Solar System Treks (LRO LROC and LOLA for the Moon; Viking, MOLA and THEMIS for Mars), NASA SRTM elevation and ESA Sentinel-2 images. Next we add NASADEM, EMIT, Diviner and HiRISE.",
      mood: "neutral",
      links: [{ label: "Open the source list", to: "/methods" }],
    };

  if (/model|ai|machine learning|train|kaggle/.test(q))
    return {
      text: "Our model will learn terrain shape from Earth, Moon and Mars elevation tiles at the same scale. It then ranks Earth places for each task. It must beat a simple, transparent baseline. When data is missing it says “not enough evidence” instead of guessing.",
      mood: "thinking",
      links: [{ label: "Read the model plan", to: "/methods" }],
    };

  if (/closest|nearest|near me|from |close to/.test(q)) {
    const home = findHome(q);
    const w = world ?? "mars";
    const list = EARTH_SITES.filter((s) => s.worlds.includes(w))
      .map((s) => ({ s, km: greatCircleKm(home.lat, home.lon, s.lat, s.lon) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
    return {
      text: `From ${home.name}, the closest ${w === "moon" ? "Moon" : "Mars"} analogs are: ${list.map((x) => `${x.s.name} (${Math.round(x.km).toLocaleString()} km, about ${tripCo2Tonnes(x.km, 4).toFixed(1)} t CO₂ for 4 people)`).join("; ")}.`,
      mood: "happy",
      links: list.slice(0, 2).map((x) => ({ label: `Open ${x.s.name.split(",")[0]}`, to: lab(x.s.id, x.s.pairs.find((p) => TARGETS.find((t) => t.id === p)?.body === w) ?? x.s.pairs[0]) })),
    };
  }

  if (/when|month|season|best time/.test(q) && (site || target)) {
    const s = site ?? EARTH_SITES.find((e) => e.pairs.includes(target!.id))!;
    const t = target ?? TARGETS.find((x) => x.id === s.pairs[0])!;
    const lt = lightTwin(s.lat, t.body, t.lat);
    return {
      text: `Go to ${s.name} in ${lt.best.join(" or ")}. That is when its Sun angles look most like ${t.name} (lighting score ${lt.score.toFixed(2)}).`,
      mood: "wow",
      links: [{ label: "See the calendar", to: lab(s.id, t.id) }],
    };
  }

  if (target) {
    const grounds = EARTH_SITES.filter((s) => s.pairs.includes(target.id));
    if (!grounds.length)
      return { text: `We don't have a catalogued Earth analog for ${target.name} yet. That makes it a good target for our new-analog screening.`, mood: "sad", links: [{ label: "Open the Atlas", to: "/atlas" }] };
    const ranked = grounds.map((s) => ({ s, l: lightTwin(s.lat, target.body, target.lat) })).sort((a, b) => b.l.score - a.l.score);
    return {
      text: `${target.name} (${target.body === "moon" ? "Moon" : "Mars"}): ${target.why} On Earth you can rehearse it at ${ranked.map((r) => r.s.name.split(",")[0]).join(", ")}. The best light match is ${ranked[0].s.name.split(",")[0]}, in ${ranked[0].l.best.join(" or ")}.`,
      mood: "happy",
      links: ranked.slice(0, 2).map((r) => ({ label: `${r.s.name.split(",")[0]} → ${target.name}`, to: lab(r.s.id, target.id) })),
    };
  }

  if (site) {
    const pairs = site.pairs.map((p) => TARGETS.find((t) => t.id === p)!.name);
    return {
      text: `${site.name} (${site.country}): ${site.summary} It can rehearse ${pairs.join(", ")}. What Earth can't copy there: ${site.gaps.join("; ").toLowerCase()}.`,
      mood: "happy",
      links: [{ label: "Open in the Analog Lab", to: lab(site.id, site.pairs[0]) }],
    };
  }

  if (task) {
    const w = world;
    const list = EARTH_SITES.filter((s) => s.tasks.includes(task) && (!w || s.worlds.includes(w)));
    if (list.length)
      return {
        text: `For ${taskLabel(task)}${w ? ` on the ${w === "moon" ? "Moon" : "Mars"}` : ""}, try: ${list.map((s) => s.name.split(",")[0]).join(", ")}.`,
        mood: "happy",
        links: list.slice(0, 2).map((s) => ({ label: `Open ${s.name.split(",")[0]}`, to: lab(s.id, s.pairs[0], task) })),
      };
  }

  if (world === "moon" || /moon base|lunar/.test(q))
    return {
      text: "The first Moon base will likely sit near the lunar south pole, around Shackleton crater. On Earth, McMurdo Dry Valleys and Svalbard copy its cold and low Sun best. Black Point Lava Flow is good for driving and walking tests.",
      mood: "happy",
      links: [{ label: "Dry Valleys → Shackleton", to: lab("dry-valleys", "shackleton", "polar") }],
    };
  if (world === "mars")
    return {
      text: "For Mars, Atacama and Death Valley are great for rover driving, Pilbara for searching for ancient life, and Svalbard for ice. Pick a Mars place and I'll be more exact.",
      mood: "happy",
      links: [{ label: "Atacama → Gale crater", to: lab("atacama", "gale", "traverse") }],
    };

  return {
    text: "Hmm, I'm not sure about that one. Try a place (like “Gale crater” or “Atacama”), a task (like “lava tubes”) or ask how the score works.",
    mood: "thinking",
    suggestions: STARTERS,
  };
}
