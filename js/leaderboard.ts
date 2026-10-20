/**
 * Local Leaderboard for Schach 9x9
 * Stores the best game results in localStorage.
 */

export interface LeaderboardEntry {
  result: 'win' | 'loss' | 'draw';
  moveCount: number;
  difficulty: string;
  date: string;
}

const STORAGE_KEY = 'schach9x9_leaderboard';
const MAX_ENTRIES = 10;

export class LeaderboardManager {
  private entries: LeaderboardEntry[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.entries = JSON.parse(raw) as LeaderboardEntry[];
      }
    } catch {
      this.entries = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // ignore
    }
  }

  add(result: 'win' | 'loss' | 'draw', moveCount: number, difficulty: string): void {
    const entry: LeaderboardEntry = {
      result,
      moveCount,
      difficulty,
      date: new Date().toISOString().slice(0, 10),
    };
    this.entries.push(entry);
    // Sort: wins first, then by move count (fewer moves = better for wins)
    this.entries.sort((a, b) => {
      const rank = (r: string) => (r === 'win' ? 0 : r === 'draw' ? 1 : 2);
      if (rank(a.result) !== rank(b.result)) return rank(a.result) - rank(b.result);
      if (a.result === 'win' && b.result === 'win') return a.moveCount - b.moveCount;
      return 0;
    });
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }
    this.save();
  }

  getAll(): LeaderboardEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    this.save();
  }
}

export const leaderboardManager = new LeaderboardManager();
