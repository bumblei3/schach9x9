/**
 * i18n — Übersetzungsschicht.
 *
 * Pilot-Skop: die UI-Schale (statische Texte aus `index.html`, Knöpfe,
 * Menüs, Einstellungen). Dynamische Texte aus `js/` (Toasts, Tutor-Sätze,
 * KI-Ausgaben, Kampagnen- und Puzzletexte) sind noch nicht erfasst.
 *
 * Deutsche Texte stehen weiterhin im Markup. `applyI18n` schreibt nur um,
 * wenn die gewählte Sprache nicht `de` ist — der Standard-Renderpfad
 * bleibt dadurch byte-identisch, und die Sprachumschaltung ist ein
 * reiner Zusatzpfad statt eines Refactors des Normalfalls.
 */

export type Locale = 'de' | 'en';

export const LOCALES: readonly Locale[] = ['de', 'en'];

export const LOCALE_LABELS: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
};

const STORAGE_KEY = 'chess_locale';

// `de`/`en` sind exportiert, weil `tests/i18n.test.ts` das Marker-Audit gegen
// die Wörterbücher führt (zwei Teilstring-Fehler — `classic` an „Klassisch 30"
// und an der Standard-8×8-Karte — waren sonst nicht gefangen worden).
export const de = {
  'menu.open': 'Menü öffnen',
  'analysis.openingLabel': 'Eröffnung:',
  'analysis.variantsTreeLabel': 'Varianten-Baum (Top-Züge & beste Antworten):',
  'analysis.undo': 'Rückgängig',
  'analysis.redo': 'Wiederholen',
  'analysis.undoTitle': 'Rückgängig (U)',
  'analysis.redoTitle': 'Wiederholen (R)',
  'analysis.opening': 'Eröffnung',
  'analysis.topMoves': 'Top Züge',
  'analysis.squareHeat': 'Feld-Hitze (Zug-Aktivität)',
  'analysis.openingBook': 'Eröffnungsbuch',
  'analysis.currentOpening': 'Aktuelle Eröffnung',
  'analysis.searchOpening': 'Eröffnung suchen (Name, ECO, Kategorie)...',
  'board.choosePiece': 'Wähle eine Figur',
  'board.close': 'Schließen',
  'board.promotion': 'Beförderung',
  'board.bestMoves': 'Beste Züge',
  'board.estimatedElo': 'Geschätzte Elo',
  'board.whiteToMove': 'Weiß am Zug',
  'board.random': '🎲 Zufällig',
  'board.nextPuzzle': 'Nächstes Puzzle',
  'board.reset': 'Zurücksetzen',
  'setup.introVariant': 'Schach 9x9 ist eine Variante auf einem größeren Brett mit neuen Figuren.',
  'setup.placeKing': 'König platzieren:',
  'setup.chooseKingArea': 'Wähle einen 3x3 Bereich für deinen König.',
  'setup.movesLike': 'Zieht wie Läufer + Springer.',
  'setup.back': 'Zurück',
  'setup.backArrow': '◀ Zurück',
  'feedback.openOnGithub': 'Auf GitHub öffnen',
  'feedback.hintLong':
    'Rückmeldung zu schach9x9 ist ausdrücklich erwünscht. Die Meldung geht als GitHub-Issue raus, mit der aktuellen Partie.',
  'feedback.hintModal':
    'Rückmeldung zu schach9x9 ist ausdrücklich erwünscht. Es öffnet sich ein GitHub-Issue. Modus, Stellung und die letzten Fehler hängen an. Kein Name und kein Speicherinhalt.',
  'feedback.example': 'z. B. Matt in Kapitel 19 zählt nicht',
  'modes.campaignDesc': 'Erlebe eine epische Geschichte und kämpfe gegen immer stärkere Gegner.',
  'modes.daily': 'Täglich',
  'modes.dailyPuzzle': 'Tägliches Puzzle',
  'modes.solvedToday': 'Heute gelöst ✓',
  'modes.crossDesc': 'Kämpfe auf einem kreuzförmigen Brett – nur die Mitte zählt!',
  'modes.puzzleDesc': 'Löse taktische Aufgaben und verbessere dein Spiel.',
  'modes.openingTrainer': 'Eröffnungs-Trainer',
  'modes.trainerDesc': 'Trainiere Eröffnungen aus dem Buch – finde den richtigen Zug.',
  'modes.tutorialDesc': 'Lerne die Regeln, Figuren und Special Moves in einer geführten Tour.',
  'settings.green': 'Grün',
  'settings.volume': 'Lautstärke',
  'settings.beginner': 'Anfänger',
  'settings.aiPersonality': 'KI-Persönlichkeit',
  'settings.feedback': 'Rückmeldung',
  'settings.chooseSkin': 'Figuren-Skin auswählen',
  'analysis.allCategories': 'Alle Kategorien',
  'analysis.analysis': 'Analyse',
  'analysis.analysisMode': 'Analyse-Modus',
  'analysis.deepAnalysis': 'Tiefenanalyse',
  'analysis.postGameAnalysis': '📊 Nachspiel-Analyse',
  'analysis.showAiHints': '💡 KI-Vorlagen anzeigen',
  'analysis.squareHeatDesc':
    'Wie oft jedes Feld als Zug-Ursprung (von) oder Ziel (nach) genutzt wurde.',
  blue: 'Blau',
  'board.bestMove': 'Bester Zug',
  campaign: 'Kampagne',
  cancel: 'Abbrechen',
  classic: 'Klassisch',
  easy: 'Einfach',
  expert: 'Experte',
  'game.aiThinking': 'KI rechnet…',
  'game.gameOver': 'Spiel beendet',
  'game.statistics': 'Statistiken',
  'game.statisticsTitle': 'Statistiken anzeigen',
  'game.opponentOffersDraw': 'Dein Gegner bietet ein Unentschieden an.',
  'game.sideWhite': 'Weiß',
  'game.sideBlack': 'Schwarz',
  'game.statusSetupWhiteKing': 'Weiß: Wähle einen Korridor für den König',
  'game.statusSetupBlackKing': 'Schwarz: Wähle einen Korridor für den König',
  'game.statusSetupWhitePieces': 'Weiß: Kaufe Truppen',
  'game.statusSetupBlackPieces': 'Schwarz: Kaufe Truppen',
  'game.statusSetupWhiteUpgrades': 'Weiß: Klicke eine Figur für Upgrades',
  'game.statusSetupBlackUpgrades': 'Schwarz: Klicke eine Figur für Upgrades',
  'game.statusPlay': 'Spiel läuft - {side} am Zug',
  'game.statusCheck': '⚠️ SCHACH — {side} am Zug',
  'game.statusAnalysis': '🔍 Analyse-Modus - {side} am Zug',
  'game.statusGameOverDraw': 'Spiel vorbei! Unentschieden.',
  'game.statusGameOverWinner': 'Spiel vorbei! {side} hat gewonnen!',
  'game.endDraw50': 'Unentschieden (50-Züge-Regel)',
  'game.endDrawRepetition': 'Unentschieden (Stellungswiederholung)',
  'game.endDrawMaterial': 'Unentschieden (Ungenügendes Material)',
  'game.endDrawInsufficient': 'Unentschieden (Material)',
  'game.endDrawStalemate': 'Unentschieden (Patt)',
  'game.endDrawAgreed': 'Remis vereinbart',
  'game.endKingCaptured': '{side} gewinnt!\n(König geschlagen)',
  'game.endWinner': '{side} gewinnt!',
  'game.endWinsOnTime': '{side} gewinnt durch Zeitüberschreitung!',
  'game.resignResult': '{side} gibt auf! {winner} gewinnt.',
  'game.resignTitle': 'Wirklich aufgeben?',
  'game.resignMessage': 'Die Partie wird als verloren gewertet.',
  'game.resignConfirm': 'Ja, aufgeben',
  'game.drawOfferTitle': 'Remis anbieten?',
  'game.drawOfferMessage': 'Dein Gegner kann das Angebot annehmen oder ablehnen.',
  'game.drawOfferConfirm': 'Angebot senden',
  'game.drawCancel': 'Abbrechen',
  'game.startMessage': 'Dieselbe Aufstellung. Sofort spielen, oder vorher 15 Punkte zum Verbessern ausgeben.',
  'game.playNow': 'Sofort spielen',
  'game.upgrade15': 'Mit 15 Punkten verbessern',
  hard: 'Schwer',
  load: 'Laden',
  medium: 'Mittel',
  'menu.helpAndRules': 'Hilfe & Regeln',
  'menu.learnAndRules': 'Lernen & Regeln',
  'menu.moreModes': 'Mehr Modi',
  'menu.newGame': 'Neues Spiel',
  'modes.classic9x9': 'Klassisch 9×9',
  'modes.continue': 'Fortsetzen',
  'modes.continueDesc': 'Setze dein zuletzt gespeichertes Spiel fort.',
  'modes.crossMode': 'Kreuz-Modus',
  'modes.dailyPuzzleDesc': 'Ein neues Puzzle jeden Tag — baue deine Siegesserie auf.',
  'modes.placePiecesHint': 'Platziere deine gekauften Figuren in deinem Bereich.',
  'modes.puzzleMode': 'Puzzle-Modus',
  'modes.puzzleTitle': 'Puzzle Titel',
  'modes.shopHint': 'Nutze deine Punkte, um Figuren zu kaufen.',
  more: 'Mehr',
  move: 'Zug',
  opponent: 'Gegner',
  save: 'Speichern',
  'settings.aiAndHelp': 'KI & Hilfe',
  'settings.aiOpponent': 'AI-Gegner',
  'settings.appearance': 'Darstellung',
  'settings.boardDesign': 'Brett-Design',
  'settings.gameAndSound': 'Spiel & Sound',
  'settings.gameFlow': 'Spielablauf',
  'settings.pieceSkin': 'Figuren-Skin',
  'settings.title': 'Einstellungen',
  'statistics.moves': 'Züge',
  'statistics.captures': 'Schläge',
  'statistics.accuracy': 'Genauigkeit',
  'statistics.material': 'Material',
  'setup.newPieces': '2. Neue Figuren',
  'setup.nextArrow': 'Weiter ▶',
  skin: 'Skin',
  sound: 'Sound',
  timeLabel: 'Zeit:',
  'timeControl.classical30': 'Klassisch 30',
  appName: 'Schach 9x9',
  'error.generic': 'Ein Fehler ist aufgetreten',
  'error.label': 'Fehler',
  'game.drawOffered': 'Remis angeboten',
  'game.offerDraw': 'Remis anbieten',
  hint: '💡 Hinweis',
  leaderboard: 'Bestenliste',
  leaderboardDesc: 'Deine besten Partien und Ergebnisse.',
  leaderboardEmoji: '🏆 Bestenliste',
  'mentor.standard': 'Standard (Nur Patzer)',
  'mentor.strict': 'Streng (Auch Fehler)',
  'modes.armyDesc': 'Stelle deine eigene 9×9-Armee mit 25 Punkten zusammen.',
  'modes.fixedSetupDesc':
    'Feste Aufstellung mit Erzbischof und Kanzler. Sofort spielen oder mit 15 Punkten verbessern.',
  'modes.hire': 'Truppen anheuern',
  'modes.hire9x9': 'Truppen anheuern (9×9)',
  'modes.standard8x8': 'Standard 8×8',
  'replay.keyboardHint': 'Tastatur: ← / → oder J / L',
  'settings.autoHintBlunder': 'Auto-Hinweis nach Patzer',
  'settings.displayLanguage': 'Anzeigesprache',
  'settings.languageLabel': 'Sprache',
  'setup.archbishopLabel': 'Erzbischof (A):',
  'setup.placementLabel': 'Aufstellung:',
  'shop.buyPieces': 'Truppen kaufen:',
  'modes.classicChessDesc':
    'Klassisches Schach mit Rochade und En passant. Sofort spielen oder mit 15 Punkten verbessern.',
} as const;

export const en: Record<keyof typeof de, string> = {
  'menu.open': 'Open menu',
  'analysis.openingLabel': 'Opening:',
  'analysis.variantsTreeLabel': 'Variant tree (top moves & best replies):',
  'analysis.undo': 'Undo',
  'analysis.redo': 'Redo',
  'analysis.undoTitle': 'Undo (U)',
  'analysis.redoTitle': 'Redo (R)',
  'analysis.opening': 'Opening',
  'analysis.topMoves': 'Top moves',
  'analysis.squareHeat': 'Square heat (move activity)',
  'analysis.openingBook': 'Opening book',
  'analysis.currentOpening': 'Current opening',
  'analysis.searchOpening': 'Search opening (name, ECO, category)...',
  'board.choosePiece': 'Choose a piece',
  'board.close': 'Close',
  'board.promotion': 'Promotion',
  'board.bestMoves': 'Best moves',
  'board.estimatedElo': 'Estimated Elo',
  'board.whiteToMove': 'White to move',
  'board.random': '🎲 Random',
  'board.nextPuzzle': 'Next puzzle',
  'board.reset': 'Reset',
  'setup.introVariant': 'Schach 9x9 is a variant played on a larger board with new pieces.',
  'setup.placeKing': 'Place king:',
  'setup.chooseKingArea': 'Choose a 3x3 area for your king.',
  'setup.movesLike': 'Moves like a bishop + knight.',
  'setup.back': 'Back',
  'setup.backArrow': '◀ Back',
  'feedback.openOnGithub': 'Open on GitHub',
  'feedback.hintLong':
    'Feedback on schach9x9 is explicitly welcome. It is filed as a GitHub issue, with the current game attached.',
  'feedback.hintModal':
    'Feedback on schach9x9 is explicitly welcome. A GitHub issue opens. Mode, position and the last errors are attached. No name and no saved data.',
  'feedback.example': 'e.g. mate in chapter 19 does not count',
  'modes.campaignDesc': 'Experience an epic story and fight ever stronger opponents.',
  'modes.daily': 'Daily',
  'modes.dailyPuzzle': 'Daily puzzle',
  'modes.solvedToday': 'Solved today ✓',
  'modes.crossDesc': 'Fight on a cross-shaped board – only the centre counts!',
  'modes.puzzleDesc': 'Solve tactical tasks and improve your game.',
  'modes.openingTrainer': 'Opening trainer',
  'modes.trainerDesc': 'Drill openings from the book – find the right move.',
  'modes.tutorialDesc': 'Learn the rules, pieces and special moves in a guided tour.',
  'settings.green': 'Green',
  'settings.volume': 'Volume',
  'settings.beginner': 'Beginner',
  'settings.aiPersonality': 'AI personality',
  'settings.feedback': 'Feedback',
  'settings.chooseSkin': 'Choose piece skin',
  'analysis.allCategories': 'All categories',
  'analysis.analysis': 'Analysis',
  'analysis.analysisMode': 'Analysis mode',
  'analysis.deepAnalysis': 'Deep analysis',
  'analysis.postGameAnalysis': '📊 Post-game analysis',
  'analysis.showAiHints': '💡 Show AI hints',
  'analysis.squareHeatDesc':
    'How often each square was used as a move origin (from) or target (to).',
  blue: 'Blue',
  'board.bestMove': 'Best move',
  campaign: 'Campaign',
  cancel: 'Cancel',
  classic: 'Classic',
  easy: 'Easy',
  expert: 'Expert',
  'game.aiThinking': 'AI is thinking…',
  'game.gameOver': 'Game over',
  'game.statistics': 'Statistics',
  'game.statisticsTitle': 'Show statistics',
  'game.opponentOffersDraw': 'Your opponent offers a draw.',
  'game.sideWhite': 'White',
  'game.sideBlack': 'Black',
  'game.statusSetupWhiteKing': 'White: choose a corridor for the king',
  'game.statusSetupBlackKing': 'Black: choose a corridor for the king',
  'game.statusSetupWhitePieces': 'White: buy pieces',
  'game.statusSetupBlackPieces': 'Black: buy pieces',
  'game.statusSetupWhiteUpgrades': 'White: click a piece to upgrade',
  'game.statusSetupBlackUpgrades': 'Black: click a piece to upgrade',
  'game.statusPlay': 'Game in progress - {side} to move',
  'game.statusCheck': '⚠️ CHECK — {side} to move',
  'game.statusAnalysis': '🔍 Analysis mode - {side} to move',
  'game.statusGameOverDraw': 'Game over! Draw.',
  'game.statusGameOverWinner': 'Game over! {side} has won!',
  'game.endDraw50': 'Draw (50-move rule)',
  'game.endDrawRepetition': 'Draw (threefold repetition)',
  'game.endDrawMaterial': 'Draw (insufficient material)',
  'game.endDrawInsufficient': 'Draw (material)',
  'game.endDrawStalemate': 'Draw (stalemate)',
  'game.endDrawAgreed': 'Draw agreed',
  'game.endKingCaptured': '{side} wins!\n(King captured)',
  'game.endWinner': '{side} wins!',
  'game.endWinsOnTime': '{side} wins on time!',
  'game.resignResult': '{side} resigns! {winner} wins.',
  'game.resignTitle': 'Resign?',
  'game.resignMessage': 'The game will be scored as a loss.',
  'game.resignConfirm': 'Yes, resign',
  'game.drawOfferTitle': 'Offer a draw?',
  'game.drawOfferMessage': 'Your opponent can accept or decline the offer.',
  'game.drawOfferConfirm': 'Send offer',
  'game.drawCancel': 'Cancel',
  'game.startMessage': 'Same setup. Play right away, or spend 15 points first to improve it.',
  'game.playNow': 'Play now',
  'game.upgrade15': 'Improve with 15 points',
  hard: 'Hard',
  load: 'Load',
  medium: 'Medium',
  'menu.helpAndRules': 'Help & rules',
  'menu.learnAndRules': 'Learn & rules',
  'menu.moreModes': 'More modes',
  'menu.newGame': 'New game',
  'modes.classic9x9': 'Classic 9×9',
  'modes.continue': 'Continue',
  'modes.continueDesc': 'Continue your last saved game.',
  'modes.crossMode': 'Cross mode',
  'modes.dailyPuzzleDesc': 'A new puzzle every day — build your winning streak.',
  'modes.placePiecesHint': 'Place your purchased pieces in your area.',
  'modes.puzzleMode': 'Puzzle mode',
  'modes.puzzleTitle': 'Puzzle title',
  'modes.shopHint': 'Use your points to buy pieces.',
  more: 'More',
  move: 'Move',
  opponent: 'Opponent',
  save: 'Save',
  'settings.aiAndHelp': 'AI & help',
  'settings.aiOpponent': 'AI opponent',
  'settings.appearance': 'Appearance',
  'settings.boardDesign': 'Board design',
  'settings.gameAndSound': 'Game & sound',
  'settings.gameFlow': 'Game flow',
  'settings.pieceSkin': 'Piece skin',
  'settings.title': 'Settings',
  'statistics.moves': 'Moves',
  'statistics.captures': 'Captures',
  'statistics.accuracy': 'Accuracy',
  'statistics.material': 'Material',
  'setup.newPieces': '2. New pieces',
  'setup.nextArrow': 'Next ▶',
  skin: 'Skin',
  sound: 'Sound',
  timeLabel: 'Time:',
  'timeControl.classical30': 'Classical 30',
  appName: 'Schach 9x9',
  'error.generic': 'An error occurred',
  'error.label': 'Error',
  'game.drawOffered': 'Draw offered',
  'game.offerDraw': 'Offer draw',
  hint: '💡 Hint',
  leaderboard: 'Leaderboard',
  leaderboardDesc: 'Your best games and results.',
  leaderboardEmoji: '🏆 Leaderboard',
  'mentor.standard': 'Standard (blunders only)',
  'mentor.strict': 'Strict (also mistakes)',
  'modes.armyDesc': 'Assemble your own 9×9 army with 25 points.',
  'modes.fixedSetupDesc':
    'Fixed setup with archbishop and chancellor. Play now or upgrade with 15 points.',
  'modes.hire': 'Hire troops',
  'modes.hire9x9': 'Hire troops (9×9)',
  'modes.standard8x8': 'Standard 8×8',
  'replay.keyboardHint': 'Keyboard: ← / → or J / L',
  'settings.autoHintBlunder': 'Auto-hint after a blunder',
  'settings.displayLanguage': 'Display language',
  'settings.languageLabel': 'Language',
  'setup.archbishopLabel': 'Archbishop (A):',
  'setup.placementLabel': 'Placement:',
  'shop.buyPieces': 'Buy pieces:',
  'modes.classicChessDesc':
    'Classic chess with castling and en passant. Play now or upgrade with 15 points.',
};

export type I18nKey = keyof typeof de;

const dictionaries: Record<Locale, Record<string, string>> = { de, en };

let current: Locale = 'de';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function getLocale(): Locale {
  return current;
}

/** Übersetzt einen Schlüssel; fehlt ein Eintrag, wird der Schlüssel zurückgegeben. */
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  const table = dictionaries[current] ?? dictionaries.de;
  let text = table[key] ?? dictionaries.de[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}

const TRANSLATED_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'] as const;

/**
 * Übersetzt alle Elemente mit `data-i18n`-Markern im Baum.
 *
 * Das Deutsche steht im Markup; die Übersetzung schreibt auch für `de`, damit
 * eine Rückschaltung nicht am überschriebenen Englisch hängenbleibt. Nur
 * Elemente ohne Kind-Elemente bekommen `textContent` zugewiesen — bei gemischtem
 * Inhalt (`<button><span>⚙️</span> Einstellungen</button>`) wird gezielt der
 * Textknoten ersetzt, sonst gingen die Icons verloren.
 */
export function applyI18n(root: ParentNode = document): void {
  const applyTo = (el: Element): void => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      translateElement(el, key as I18nKey);
    }
    for (const attr of TRANSLATED_ATTRIBUTES) {
      const attrKey = el.getAttribute(`data-i18n-${attr}`);
      if (attrKey) {
        el.setAttribute(attr, t(attrKey as I18nKey));
      }
    }
  };

  if (root instanceof Element) applyTo(root);
  root.querySelectorAll('*').forEach(applyTo);
}

function translateElement(el: Element, key: I18nKey): void {
  const target = t(key);
  if (el.childElementCount === 0) {
    el.textContent = target;
    return;
  }
  const textNodes = Array.from(el.childNodes).filter(
    (n): n is Text =>
      n.nodeType === Node.TEXT_NODE && !!n.textContent && n.textContent.trim().length > 0
  );
  if (textNodes.length === 0) return;
  textNodes[0].textContent = target;
  for (const node of textNodes.slice(1)) {
    node.textContent = '';
  }
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Speicher nicht verfügbar (Privatmodus) — die Wahl gilt nur für diese Sitzung.
  }
  document.documentElement.lang = locale;
  applyI18n();
  window.dispatchEvent(new CustomEvent('i18n:locale-changed', { detail: { locale } }));
}

export function initI18n(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  if (saved && isLocale(saved)) {
    current = saved;
  }
  document.documentElement.lang = current;
  applyI18n();
}
