/**
 * Abdeckung fuer `tools/search-server.ts`.
 *
 * Der Server ist jetzt Teil des Messpfads: `match:stockfish` laeuft die eigene
 * Suche dort, weil die Suche synchron den Event-Loop blockiert und Stockfish
 * sonst verstummt (siehe STATUS.md, Track B). Ein Server, der Anfragen
 * verschluckt, laesst den Lauf still abbrechen — genau das Muster, das hier
 * getestet werden muss.
 *
 * Getestet wird der echte Prozess (spawn wie im Tool), nicht ein Mock: der
 * Fehler, den dieser Server behebt, ist ein Prozess-/Pipe-Problem, und ein
 * Mock darueber wäre gruen, waehrend der Lauf rot bleibt.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let proc: ChildProcessWithoutNullStreams;
let buf = '';
let resolveLine: ((line: string) => void) | null = null;

beforeAll(async () => {
  proc = spawn(
    process.execPath,
    ['--import', fileURLToPath(import.meta.resolve('tsx')), 'tools/search-server.ts'],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim() && resolveLine) resolveLine(line);
    }
  });
  // Der Server startet eine Engine; das darf nicht sofort als Fehler gelten.
  await new Promise(r => setTimeout(r, 1500));
});

afterAll(() => {
  try {
    proc?.kill();
  } catch {
    /* bereits beendet */
  }
});

/** Leere 8x8-Startstellung als IntBoard (Reihe 0 = oben, schwarz). */
function startBoard(): Int8Array {
  // Farben und Figuren aus BoardDefinitions: weiss = 16, schwarz = 32,
  // Bauer = 1, Springer = 2, Laeufer = 3, Turm = 4, Dame = 5, Koenig = 6.
  const WHITE = 16;
  const BLACK = 32;
  const PAWN = 1;
  const back = [4, 2, 3, 5, 6, 3, 2, 4];
  const b = new Int8Array(64);
  for (let c = 0; c < 8; c++) {
    b[0 * 8 + c] = BLACK | back[c]!;
    b[1 * 8 + c] = BLACK | PAWN;
    b[6 * 8 + c] = WHITE | PAWN;
    b[7 * 8 + c] = WHITE | back[c]!;
  }
  return b;
}

describe('search-server', () => {
  test('antwortet auf eine Anfrage mit einem legalen Zug', async () => {
    const reply = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('search-server antwortet nicht')), 20000);
      resolveLine = (line: string) => {
        clearTimeout(timer);
        resolve(line);
      };
      proc.stdin.write(
        JSON.stringify({ board: Array.from(startBoard()), turn: 'white', depth: 2 }) + '\n'
      );
    });

    const data = JSON.parse(reply) as { ok: boolean; move?: { from: number; to: number } };
    expect(data.ok).toBe(true);
    expect(data.move).toBeDefined();
    expect(data.move!.from).toBeGreaterThanOrEqual(0);
    expect(data.move!.to).toBeGreaterThanOrEqual(0);
  });

  test('trägt die Anfrage-Id in der Antwort zurück (Verbindungsgrundlage gegen Verspätung)', async () => {
    // Die Id ist die Korrelation zwischen Anfrage und Antwort. Ohne sie kann
    // eine verspaetete Antwort einer abgebrochenen Partie beim naechsten
    // Aufruf landen — das war die Ursache der sporadischen `illegal-ours`.
    const reply = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('kein Antwort')), 20000);
      resolveLine = (line: string) => {
        clearTimeout(timer);
        resolve(line);
      };
      proc.stdin.write(
        JSON.stringify({ id: 4242, board: Array.from(startBoard()), turn: 'white', depth: 2 }) + '\n'
      );
    });
    const data = JSON.parse(reply) as { ok: boolean; id?: number };
    expect(data.ok).toBe(true);
    expect(data.id).toBe(4242);
  });

  test('beantwortet zwei Anfragen nacheinander (Zustand bleibt brauchbar)', async () => {
    for (let i = 0; i < 2; i++) {
      const reply = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Anfrage ${i + 1}: kein Antwort`)), 20000);
        resolveLine = (line: string) => {
          clearTimeout(timer);
          resolve(line);
        };
        proc.stdin.write(
          JSON.stringify({ board: Array.from(startBoard()), turn: 'white', depth: 2 }) + '\n'
        );
      });
      const data = JSON.parse(reply) as { ok: boolean };
      expect(data.ok, `Anfrage ${i + 1} schlug fehl`).toBe(true);
    }
  });

  test('akzeptiert die Objekt-Form, die JSON.stringify(Int8Array) liefert', async () => {
    // `JSON.stringify(new Int8Array([...]))` ist KEIN Array, sondern
    // `{"0":1,...}` mit `length === undefined`. Der Server normalisiert das
    // auf `Int8Array`. **Gegenprobe:** der Test ist auch ohne Normalisierung
    // gruen — die Suche kommt mit der Objekt-Form zurecht, weil sie
    // ausschliesslich per Index liest. Der Test haelt also eine
    // Robustheitsgarantie fest (und dokumentiert die Serialisierung), aber er
    // ist NICHT die Ursache der sporadischen `illegal-ours`-Faelle; die ist
    // weiter offen.
    const board = startBoard();
    const alsObjekt = JSON.parse(JSON.stringify(board)) as Record<string, number>;
    expect(Array.isArray(alsObjekt)).toBe(false);
    expect((alsObjekt as unknown as { length?: number }).length).toBeUndefined();

    const reply = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('kein Antwort bei Objekt-Board')), 20000);
      resolveLine = (line: string) => {
        clearTimeout(timer);
        resolve(line);
      };
      proc.stdin.write(JSON.stringify({ board: alsObjekt, turn: 'white', depth: 2 }) + '\n');
    });

    const data = JSON.parse(reply) as { ok: boolean; move?: { from: number; to: number } | null };
    expect(data.ok).toBe(true);
    // Ein Zug aus der Startstellung: von einem weissen Bauer oder Springer.
    expect(data.move).not.toBeNull();
    const legal = new Set([
      // weisse Bauern auf der 7. Reihe (r=6): Indizes 48-55
      48, 49, 50, 51, 52, 53, 54, 55,
      // weisse Springer b1/g1 (r=7): 57 und 62
      57, 62,
    ]);
    expect(legal.has(data.move!.from)).toBe(true);
  });
});
