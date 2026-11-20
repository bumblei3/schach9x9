/**
 * Repro für die inkonsistenten Such-Antworten (siehe STATUS.md, 0-ms-Fänder).
 *
 * Eingabe: eine JSON-Sequenz aus `/tmp/seq.json` — Boards und Antworten, wie
 * sie im `DBG_SEARCH`-Log eines Laufs standen. Das Skript schickt dieselben
 * Boards in derselben Reihenfolge an den Such-Server und vergleicht die
 * Antworten. Stimmen sie überein, ist der Fall reproduzierbar und der nächste
 * Schritt wäre, den Server mit genau diesem Board zu instrumentieren.
 *
 * Aufruf: npx tsx tools/repro-inconsistent.ts /tmp/seq.json
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pfad = process.argv[2] ?? '/tmp/seq.json';
const folge = JSON.parse(readFileSync(pfad, 'utf8')) as {
  board: number[];
  zug: string;
  turn: string;
}[];

const tsxPfad = fileURLToPath(import.meta.resolve('tsx'));
const proc = spawn(process.execPath, ['--import', tsxPfad, 'tools/search-server.ts'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buf = '';
let resolveLine: ((_line: string) => void) | null = null;
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

const size = folge.length;
let gleich = 0;
let abweichung = 0;

for (let i = 0; i < size; i++) {
  const schritt = folge[i]!;
  const id = i + 1;
  const reply = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Anfrage ${i}: timeout`)), 20000);
    resolveLine = (_line: string) => {
      clearTimeout(timer);
      resolve(_line);
    };
    proc.stdin.write(
      JSON.stringify({ id, board: schritt.board, turn: schritt.turn, depth: 5 }) + '\n'
    );
  });
  const data = JSON.parse(reply) as {
    ok: boolean;
    id?: number;
    move?: { from: number; to: number } | null;
  };
  const neu = data.move ? `${data.move.from}->${data.move.to}` : 'null';
  const ok = data.id === id;
  const passt = neu === schritt.zug;
  if (passt) gleich++;
  else abweichung++;
  console.log(
    `${String(i).padStart(3)}  erwartet=${schritt.zug.padEnd(7)}  kommt=${neu.padEnd(7)}  id-ok=${ok}  ${passt ? 'gleich' : 'ABWEICHUNG'}`
  );
}

proc.kill();
console.log(`\n${size} Anfragen: ${gleich} gleich, ${abweichung} Abweichungen`);
