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
  id?: number;
  board: IntBoard;
  turn: 'white' | 'black';
  depth: number;
  rules?: RuleState;
}

const rl = createInterface({ input: process.stdin });

rl.on('line', async (line: string) => {
  if (!line.trim()) return;
  let msg: SearchRequest | null = null;
  const angefangen = Date.now();
  try {
    msg = JSON.parse(line) as SearchRequest;
    // Robust gegen beide Formen: ein Array (so schickt `stockfish-match.ts`
    // es seit dem Serialisierungs-Fix) und ein Objekt mit numerischen
    // Schluesseln (so lieferte `JSON.stringify` ein Int8Array frueher). Ohne
    // diese Normalisierung ist `board.length` undefined und die Suche
    // antwortet aus einer anderen Position.
    const board = Int8Array.from(
      Array.isArray(msg.board) ? msg.board : Object.values(msg.board ?? {})
    );
    if (msg.rules) setRules(msg.rules);
    const result = await search.run(board, msg.turn, msg.depth, {
      ...(msg.rules as object),
    } as RuleState);
    // Diagnose: der Server hat ueber alle Anfragen eine Such-Instanz. Wenn er
    // internen Zustand haelt, kann eine Antwort zu einer anderen Farbe gehoeren
    // als die Anfrage — genau das zeigten zwei `illegal-ours`-Faelle (d7d5 bei
    // Weiß am Zug, f3f4 bei Schwarz am Zug).
    if (process.env.DBG_SEARCH) {
      process.stderr.write(
        `[dbg-server] turn=${msg.turn} zug=${result.move ? `${result.move.from}->${result.move.to}` : 'null'} ` +
          `ms=${Date.now() - angefangen} board=${JSON.stringify(Array.from(board))} ` +
          `regeln=${JSON.stringify(msg.rules ?? null)}\n`
      );
    }
    process.stdout.write(JSON.stringify({ ok: true, id: msg.id, move: result.move }) + '\n');
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        id: msg?.id,
        error: err instanceof Error ? err.message : String(err),
      }) + '\n'
    );
  }
});
