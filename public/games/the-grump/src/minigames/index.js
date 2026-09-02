// index.js — import every mini-game so it self-registers. Add a new file + import here.
import './hide_and_seek.js';
import './slack_attack.js';
import './meeting_declined.js';
import './elevator_sprint.js';
import './hallway_escape.js';
import './lunch_defense.js';
import './whack_a_pat.js';
import './paper_toss.js';
import './rkt_run.js';
import './boss.js';
export { MINIGAMES, registerMinigame, regularMinigames, specialMinigame } from './registry.js';
