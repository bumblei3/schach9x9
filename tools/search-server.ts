/**
 * Such-Server für `tools/stockfish-match.ts`.
 *
 * Warum ein eigener Prozess: `createJsSearch().run()` ist vollständig
 * synchron (`js/search.ts` enthält kein einziges `await`) und blockiert den
 * Event-Loop des Mess-Prozesses für die gesamte Suchzeit — bei Tiefe 5 bis
 * `MAX_SEARCH_TIME` (8 s). Währenddessen wird die Ausgabe des
 * Stockfish-Kindprozeszes nicht gelesen, der Pipe-Puffer läuft über und
 * Stockfish blockiert beim Schreiben. Es antwortet nicht mehr und
 * `match:stockfish` bricht mit `Stockfish wait timeout (120000ms)` ab.
 *
 * Ein Worker-Thread scheidet aus, weil tsx im Thread `.js`-Importe nicht auf
 * `.ts` auflöst; ein Kindprozess hat einen frischen Loader und funktioniert.
 *
 * Protokoll: eine JSON-Anfrage pro Zeile auf stdin, eine JSON-Antwort pro
 * Zeile auf stdout.
 */
import { createInterface } from 'node:readline';
import { setBoardVariant, BOARD_VARIANTS } from '../js/config.js';
import { createJsSearch } from '../js/search.js';
import { setRules, type RuleState } from '../js/ai/MoveGenerator.js';
import type { IntBoard } from '../js/evaluate.js';

setBoardVariant(BOARD_VARIANTS.STANDARD_8X8);

// Eine Instanz fuer alle Anfragen: `createJsSearch` pro Zug zu bauen kostete
// ~1 s Aufbau und machte den Server unbrauchbar langsam.
const search = createJsSearch({ personality: 'NORMAL' });

interface SearchRequest {
  board: IntBoard;
  turn: 'white' | 'black';
  depth: number;
  rules?: RuleState;
}

const rl = createInterface({ input: process.stdin });

rl.on('line', async (line: string) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line) as SearchRequest;
    if (msg.rules) setRules(msg.rules);
    const result = await search.run(msg.board, msg.turn, msg.depth, {
      ...(msg.rules as object),
    } as RuleState);
    process.stdout.write(JSON.stringify({ ok: true, move: result.move }) + '\n');
  } catch (err) {
    process.stdout.write(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }) + '\n'
    );
  }
});
