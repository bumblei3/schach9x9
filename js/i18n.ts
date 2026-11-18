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
  'game.startMessage':
    'Dieselbe Aufstellung. Sofort spielen, oder vorher 15 Punkte zum Verbessern ausgeben.',
  'game.playNow': 'Sofort spielen',
  'game.upgrade15': 'Mit 15 Punkten verbessern',
  'toast.gameAutosaved': 'Spiel automatisch gespeichert',
  'toast.achievementUnlocked': 'Erfolg freigeschaltet: {name}',
  'toast.3dUnavailable': '3D-Ansicht konnte nicht geladen werden.',
  'toast.hintMovePiece': 'Hinweis: diese Figur ziehen',
  'toast.noMovesToExport': 'Keine Züge zum Exportieren!',
  'toast.pgnCopied': 'PGN in die Zwischenablage kopiert!',
  'toast.gifFailed': 'GIF-Export fehlgeschlagen.',
  'toast.startGameFirst': 'Starte zuerst ein Spiel.',
  'toast.autoHintEnabled': 'Auto-Hinweis nach Patzer aktiviert',
  'toast.autoHintDisabled': 'Auto-Hinweis nach Patzer deaktiviert',
  'toast.perkBought': '{name} erfolgreich gekauft!',
  'toast.notEnoughGold': 'Nicht genug Gold!',
  'toast.championSet': '{name} ist jetzt dein Champion!',
  'toast.talentLearned': '{name} erlernt!',
  'toast.tutorUnavailable': 'Tutor nicht verfügbar!',
  'toast.tutorNoHints':
    'Keine Vorschläge verfügbar. Möglicherweise ist die KI noch am Denken oder es gibt keine legalen Züge.',
  'toast.field': 'Feld: {key}…',
  'toast.fieldSelected': '{square} ausgewählt',
  'toast.undo': 'Undo',
  'toast.redo': 'Redo',
  'toast.threatsOn': 'Drohungen AN',
  'toast.threatsOff': 'Drohungen AUS',
  'toast.opportunitiesOn': 'Chancen AN',
  'toast.opportunitiesOff': 'Chancen AUS',
  'toast.bestMoveOn': 'Bester Zug AN',
  'toast.bestMoveOff': 'Bester Zug AUS',
  'toast.emergencyRecovery': '🔧 Emergency Recovery - Game unstuck!',
  'toast.guessCorrect': 'Richtig geraten! +10 Tutor-Punkte',
  'toast.guessNotBest': 'Nicht der beste Zug, aber das Spiel geht weiter.',
  'toast.reportCopied': 'Bericht kopiert.',
  'toast.copyFailed': 'Kopieren fehlgeschlagen.',
  'toast.popupBlockedCopied': 'Popup blockiert. Bericht ist kopiert — auf GitHub einfügen.',
  'toast.popupBlockedFailed': 'Popup blockiert. Bericht konnte nicht kopiert werden.',
  'toast.mentorDisabled': 'KI-Mentor deaktiviert',
  'toast.mentorStandard': 'KI-Mentor: Standard (Patzer)',
  'toast.mentorStrict': 'KI-Mentor: Streng (Fehler & Patzer)',
  'achievement.first_win.name': 'Erster Sieg',
  'achievement.first_win.description': 'Gewinne dein erstes Spiel',
  'achievement.win_streak_5.name': 'Siegeslauf',
  'achievement.win_streak_5.description': 'Gewinne 5 Spiele in Folge',
  'achievement.ten_wins.name': 'Zehnfacher Sieger',
  'achievement.ten_wins.description': 'Gewinne insgesamt 10 Spiele',
  'achievement.checkmate_in_5.name': 'Schneller Matt',
  'achievement.checkmate_in_5.description': 'Erziehe ein Matt in 5 Zügen oder weniger',
  'achievement.promote_pawn.name': 'Bauernbeförderung',
  'achievement.promote_pawn.description': 'Förgere einen Bauern zu einer höheren Figur',
  'achievement.win_with_king_only.name': 'König allein',
  'achievement.win_with_king_only.description': 'Gewinne ein Spiel mit nur deinem König übrig',
  'achievements.title': 'Erfolge',
  'campaign.level.peasant_revolt.title': 'Kapitel 1: Der Aufstand',
  'campaign.level.peasant_revolt.description':
    'Eine Armee von Bauern marschiert auf. Dein König muss sich verteidigen. Lerne die Macht der Bauernstruktur.',
  'campaign.level.bandit_ambush.title': 'Kapitel 2: Die Kavallerie',
  'campaign.level.bandit_ambush.description':
    'Vier Springer bedrohen das Land. Ihre Unberechenbarkeit ist gefährlich. Nutze deine Läufer weise.',
  'campaign.level.skirmish_bridge.title': 'Kapitel 3: Der General',
  'campaign.level.skirmish_bridge.description':
    'Ein echter militärischer Test. Eine ausgeglichene Armee erwartet dich. Zeige, dass du bereit für die 9x9 Welt bist.',
  'campaign.level.boss_1.title': 'Kapitel 4: Die Belagerung des dunklen Turms',
  'campaign.level.boss_1.description':
    'Der Turm des Tyrannen steht vor dir. Durchbrich die Verteidigung und stürze den Lord.',
  'campaign.level.knight_mission.title': 'Kapitel 5: Der Ritt der Gerechten',
  'campaign.level.knight_mission.description':
    'Deine Springer sind der Schlüssel zum Sieg. Nutze ihre Wendigkeit, um die feindliche Kavallerie zu umgehen.',
  'campaign.level.final_battle.title': 'Kapitel 6: Der Kampf um den Eisernen Thron',
  'campaign.level.final_battle.description':
    'Der Imperator stellt sich dir im Thronsaal entgegen. Das Schicksal des Reiches liegt in deinen Händen!',
  'campaign.level.endgame_rook.title': 'Endspiel 1: Turm-Matt',
  'campaign.level.endgame_rook.description':
    'Lerne das grundlegende Mattmuster: König und Turm gegen König. Dränge den König an den Rand!',
  'campaign.level.endgame_queen.title': 'Endspiel 2: Damen-Matt',
  'campaign.level.endgame_queen.description':
    'Die Dame ist mächtig. Nutze sie, um den gegnerischen König schnell mattzusetzen.',
  'campaign.level.endgame_pawn.title': 'Endspiel 3: Bauernumwandlung',
  'campaign.level.endgame_pawn.description':
    'Ein einzelner Bauer kann das Spiel entscheiden. Führe ihn zur Umwandlung und gewinne!',
  'campaign.level.endgame_bishops.title': 'Endspiel 4: Zwei Läufer',
  'campaign.level.endgame_bishops.description':
    'Zwei Läufer können den König mattsetzen. Koordiniere sie geschickt!',
  'campaign.level.endgame_exchange.title': 'Endspiel 5: Turm gegen Läufer',
  'campaign.level.endgame_exchange.description':
    'Du hast einen Turm, der Gegner einen Läufer. Nutze deinen Materialvorteil zum Sieg!',
  'campaign.level.archbishop_gabel.title': 'Kapitel 7: Die Gabel des Erzbischofs',
  'campaign.level.archbishop_gabel.description':
    'Der Erzbischof vereint Läufer und Springer in einer Figur. Nutze seine Reichweite, um zwei Ziele gleichzeitig anzugreifen!',
  'campaign.level.chancellor_xray.title': 'Kapitel 8: Der Stachel der Kanzlerin',
  'campaign.level.chancellor_xray.description':
    'Die Kanzlerin kombiniert Turm und Springer. Ihre Linien sehen durch — Spieße und X-Ray-Angriffe sind ihre Waffe.',
  'campaign.level.angel_vs_queen.title': 'Kapitel 9: Der Engel und die Königin',
  'campaign.level.angel_vs_queen.description':
    'Dein Engel ist der Königin ebenbürtig — mit einem extra Springersprung. Zeige, dass die Feenfigur die klassische Dame schlägt!',
  'campaign.level.nightrider_lines.title': 'Kapitel 10: Der Nachtreiter-Sturm',
  'campaign.level.nightrider_lines.description':
    'Nachtreiter reiten in Springer-Sprüngen über das ganze Brett. Kontrolliere die Linien, bevor sie dich erreichen!',
  'campaign.level.fairy_battle.title': 'Kapitel 11: Der Rat der Feen',
  'campaign.level.fairy_battle.description':
    'Alle vier Feenfiguren auf einmal! Koordiniere Erzbischof, Kanzlerin, Engel und Nachtreiter gegen die Elite des Imperators.',
  'campaign.level.boss_emperor_return.title': 'Kapitel 12: Die Rückkehr des Imperators',
  'campaign.level.boss_emperor_return.description':
    'Der Imperator ist zurück — mit einer Feenarmee. Der finale Kampf um das Schicksal des 9x9-Reiches!',
  'campaign.level.archbishop_solo.title': 'Kapitel 13: Der Erzbischof-Solitär',
  'campaign.level.archbishop_solo.description':
    'Ein einzelner Erzbischof gegen eine ganze Armee. Seine Gabelkraft aus Läufer und Springer reicht aus — wenn du ihn richtig führst.',
  'campaign.level.chancellor_lines.title': 'Kapitel 14: Die Linien der Kanzlerin',
  'campaign.level.chancellor_lines.description':
    'Die Kanzlerin beherrscht Linien und Reihen. Nutze ihre Turm-Schärfe, um den Gegner in die Enge zu treiben.',
  'campaign.level.angel_storm.title': 'Kapitel 15: Der Engel-Sturm',
  'campaign.level.angel_storm.description':
    'Der Engel ist die stärkste Feenfigur. Führe ihn an die Front und zerreiße die feindlichen Linien!',
  'campaign.level.nightrider_speed.title': 'Kapitel 16: Der Nachtreiter-Sprint',
  'campaign.level.nightrider_speed.description':
    'Der Nachtreiter überrascht durch seine Geschwindigkeit. Nutze seine Springer-Sprünge, um den Gegner zu überrumpeln.',
  'campaign.level.fairy_synergy.title': 'Kapitel 17: Feen-Synergie',
  'campaign.level.fairy_synergy.description':
    'Erzbischof und Kanzlerin arbeiten zusammen. Läufer + Springer + Turm = unaufhaltbare Gabeln!',
  'campaign.level.fairy_master.title': 'Kapitel 18: Der Feen-Meister',
  'campaign.level.fairy_master.description':
    'Alle vier Feenfiguren auf einmal gegen eine Elite-Armee. Der ultimative Test deiner 9x9-Kunst!',
  'campaign.level.archbishop_fork.title': 'Kapitel 19: Der Doppelangriff des Erzbischofs',
  'campaign.level.archbishop_fork.description':
    'Der Erzbischof auf e6 springt nach c7. Von dort gabelt er den König auf a9 und die Dame auf d9 — das ist Matt.',
  'campaign.level.chancellor_xray_2.title': 'Kapitel 20: Der Kanzler-Spieß',
  'campaign.level.chancellor_xray_2.description':
    'Die Kanzlerin zieht von h9 nach e9. Der König auf e8 steht im Spieß, dahinter der Springer. Die Dame hält die Fluchtfelder.',
  'campaign.level.angel_battery.title': 'Kapitel 21: Engelsbatterie',
  'campaign.level.angel_battery.description':
    'Der Engel springt von b5 nach c7, in die Linie des Turmes auf c3. Die Bauern schließen die Ecke. Nur dieser Sprung setzt matt.',
  'campaign.level.nightrider_fork.title': 'Kapitel 22: Nachtreiter-Gabel',
  'campaign.level.nightrider_fork.description':
    'Der Nachtreiter springt von a5 nach b7 und gabelt den König auf a9 und die Dame auf c5. Die Dame auf c8 hält die Fluchtfelder.',
  'campaign.level.archbishop_chancellor_duo.title':
    'Kapitel 23: Erzbischof + Kanzler: Doppelwirkung',
  'campaign.level.archbishop_chancellor_duo.description':
    'Der Erzbischof springt von c9 nach b7 und öffnet die Reihe der Kanzlerin. Beide geben Schach. Ohne eine der beiden Figuren gibt es kein Matt.',
  'campaign.level.angel_endgame.title': 'Kapitel 24: Der Engel im Endspiel',
  'campaign.level.angel_endgame.description':
    'Schwarz hat nur König und Springer. Der Engel auf b5 springt nach a7: Schach auf der a-Linie und Gabel auf den Springer auf f7.',
  'campaign.level.fairy_sacrifice.title': 'Kapitel 25: Sprung und Dame',
  'campaign.level.fairy_sacrifice.description':
    'Noch kein Matt. Der Erzbischof springt von d6 nach c8 und gibt Schach. Im nächsten Zug setzt die Dame matt.',
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
  'settings.tutorMode': 'Tutor-Modus',
  'tutorMode.off': 'Aus',
  'tutorMode.guessTheMove': 'Rate den Zug!',
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
  'toast.gameAutosaved': 'Game saved automatically',
  'toast.achievementUnlocked': 'Achievement unlocked: {name}',
  'toast.3dUnavailable': 'Could not load the 3D view.',
  'toast.hintMovePiece': 'Hint: move this piece',
  'toast.noMovesToExport': 'No moves to export!',
  'toast.pgnCopied': 'PGN copied to the clipboard!',
  'toast.gifFailed': 'GIF export failed.',
  'toast.startGameFirst': 'Start a game first.',
  'toast.autoHintEnabled': 'Auto-hint after blunders enabled',
  'toast.autoHintDisabled': 'Auto-hint after blunders disabled',
  'toast.perkBought': '{name} purchased!',
  'toast.notEnoughGold': 'Not enough gold!',
  'toast.championSet': '{name} is now your champion!',
  'toast.talentLearned': '{name} learned!',
  'toast.tutorUnavailable': 'Tutor unavailable!',
  'toast.tutorNoHints':
    'No suggestions available. The AI may still be thinking, or there are no legal moves.',
  'toast.field': 'Square: {key}…',
  'toast.fieldSelected': '{square} selected',
  'toast.undo': 'Undo',
  'toast.redo': 'Redo',
  'toast.threatsOn': 'Threats ON',
  'toast.threatsOff': 'Threats OFF',
  'toast.opportunitiesOn': 'Opportunities ON',
  'toast.opportunitiesOff': 'Opportunities OFF',
  'toast.bestMoveOn': 'Best move ON',
  'toast.bestMoveOff': 'Best move OFF',
  'toast.emergencyRecovery': '🔧 Emergency Recovery - Game unstuck!',
  'toast.guessCorrect': 'Correct! +10 tutor points',
  'toast.guessNotBest': 'Not the best move, but the game goes on.',
  'toast.reportCopied': 'Report copied.',
  'toast.copyFailed': 'Copy failed.',
  'toast.popupBlockedCopied': 'Popup blocked. The report is copied — paste it on GitHub.',
  'toast.popupBlockedFailed': 'Popup blocked. The report could not be copied.',
  'toast.mentorDisabled': 'AI mentor disabled',
  'toast.mentorStandard': 'AI mentor: standard (blunders)',
  'toast.mentorStrict': 'AI mentor: strict (mistakes & blunders)',
  'achievement.first_win.name': 'First win',
  'achievement.first_win.description': 'Win your first game',
  'achievement.win_streak_5.name': 'Winning streak',
  'achievement.win_streak_5.description': 'Win 5 games in a row',
  'achievement.ten_wins.name': 'Ten-time winner',
  'achievement.ten_wins.description': 'Win 10 games in total',
  'achievement.checkmate_in_5.name': 'Quick mate',
  'achievement.checkmate_in_5.description': 'Force mate in 5 moves or fewer',
  'achievement.promote_pawn.name': 'Promotion',
  'achievement.promote_pawn.description': 'Promote a pawn to a higher piece',
  'achievement.win_with_king_only.name': 'King alone',
  'achievement.win_with_king_only.description': 'Win a game with only your king left',
  'achievements.title': 'Achievements',
  'campaign.level.peasant_revolt.title': 'Chapter 1: The Uprising',
  'campaign.level.peasant_revolt.description':
    'An army of peasants is marching on. Your king must defend himself. Learn the power of the pawn structure.',
  'campaign.level.bandit_ambush.title': 'Chapter 2: The Cavalry',
  'campaign.level.bandit_ambush.description':
    'Four knights threaten the land. Their unpredictability is dangerous. Use your bishops wisely.',
  'campaign.level.skirmish_bridge.title': 'Chapter 3: The General',
  'campaign.level.skirmish_bridge.description':
    'A true military test. A balanced army awaits you. Show that you are ready for the 9x9 world.',
  'campaign.level.boss_1.title': 'Chapter 4: The Siege of the Dark Tower',
  'campaign.level.boss_1.description':
    "The tyrant's tower stands before you. Break through the defence and topple the lord.",
  'campaign.level.knight_mission.title': 'Chapter 5: The Ride of the Righteous',
  'campaign.level.knight_mission.description':
    'Your knights are the key to victory. Use their agility to outflank the enemy cavalry.',
  'campaign.level.final_battle.title': 'Chapter 6: The Battle for the Iron Throne',
  'campaign.level.final_battle.description':
    'The emperor faces you in the throne room. The fate of the realm is in your hands!',
  'campaign.level.endgame_rook.title': 'Endgame 1: Rook Mate',
  'campaign.level.endgame_rook.description':
    'Learn the basic mate pattern: king and rook against king. Drive the king to the edge!',
  'campaign.level.endgame_queen.title': 'Endgame 2: Queen Mate',
  'campaign.level.endgame_queen.description':
    'The queen is powerful. Use her to mate the enemy king quickly.',
  'campaign.level.endgame_pawn.title': 'Endgame 3: Pawn Promotion',
  'campaign.level.endgame_pawn.description':
    'A single pawn can decide the game. Lead him to promotion and win!',
  'campaign.level.endgame_bishops.title': 'Endgame 4: Two Bishops',
  'campaign.level.endgame_bishops.description':
    'Two bishops can mate the king. Coordinate them skilfully!',
  'campaign.level.endgame_exchange.title': 'Endgame 5: Rook vs Bishop',
  'campaign.level.endgame_exchange.description':
    'You have a rook, the opponent a bishop. Use your material advantage to win!',
  'campaign.level.archbishop_gabel.title': "Chapter 7: The Archbishop's Fork",
  'campaign.level.archbishop_gabel.description':
    'The archbishop combines bishop and knight in one piece. Use his reach to attack two targets at once!',
  'campaign.level.chancellor_xray.title': "Chapter 8: The Chancellor's Sting",
  'campaign.level.chancellor_xray.description':
    'The chancellor combines rook and knight. Her lines see through — skewers and x-ray attacks are her weapon.',
  'campaign.level.angel_vs_queen.title': 'Chapter 9: The Angel and the Queen',
  'campaign.level.angel_vs_queen.description':
    "Your angel is the queen's equal — with an extra knight jump. Show that the fairy piece beats the classical queen!",
  'campaign.level.nightrider_lines.title': 'Chapter 10: The Nightrider Storm',
  'campaign.level.nightrider_lines.description':
    'Nightriders ride in knight jumps across the whole board. Control the lines before they reach you!',
  'campaign.level.fairy_battle.title': 'Chapter 11: The Council of Fairies',
  'campaign.level.fairy_battle.description':
    "All four fairy pieces at once! Coordinate archbishop, chancellor, angel and nightrider against the emperor's elite.",
  'campaign.level.boss_emperor_return.title': 'Chapter 12: The Return of the Emperor',
  'campaign.level.boss_emperor_return.description':
    'The emperor is back — with a fairy army. The final battle for the fate of the 9x9 realm!',
  'campaign.level.archbishop_solo.title': 'Chapter 13: The Lonely Archbishop',
  'campaign.level.archbishop_solo.description':
    'A single archbishop against a whole army. His fork power from bishop and knight is enough — if you lead him well.',
  'campaign.level.chancellor_lines.title': "Chapter 14: The Chancellor's Lines",
  'campaign.level.chancellor_lines.description':
    'The chancellor masters lines and ranks. Use her rook sharpness to corner the opponent.',
  'campaign.level.angel_storm.title': 'Chapter 15: The Angel Storm',
  'campaign.level.angel_storm.description':
    'The angel is the strongest fairy piece. Lead him to the front and tear apart the enemy lines!',
  'campaign.level.nightrider_speed.title': 'Chapter 16: The Nightrider Sprint',
  'campaign.level.nightrider_speed.description':
    'The nightrider surprises with his speed. Use his knight jumps to overwhelm the opponent.',
  'campaign.level.fairy_synergy.title': 'Chapter 17: Fairy Synergy',
  'campaign.level.fairy_synergy.description':
    'Archbishop and chancellor work together. Bishop + knight + rook = unstoppable forks!',
  'campaign.level.fairy_master.title': 'Chapter 18: The Fairy Master',
  'campaign.level.fairy_master.description':
    'All four fairy pieces at once against an elite army. The ultimate test of your 9x9 skill!',
  'campaign.level.archbishop_fork.title': "Chapter 19: The Archbishop's Double Attack",
  'campaign.level.archbishop_fork.description':
    'The archbishop on e6 jumps to c7. From there he forks the king on a9 and the queen on d9 — that is mate.',
  'campaign.level.chancellor_xray_2.title': "Chapter 20: The Chancellor's Skewer",
  'campaign.level.chancellor_xray_2.description':
    'The chancellor moves from h9 to e9. The king on e8 is skewered, with the knight behind it. The queen covers the escape squares.',
  'campaign.level.angel_battery.title': 'Chapter 21: Angel Battery',
  'campaign.level.angel_battery.description':
    'The angel jumps from b5 to c7, into the line of the rook on c3. The pawns close the corner. Only this jump mates.',
  'campaign.level.nightrider_fork.title': 'Chapter 22: Nightrider Fork',
  'campaign.level.nightrider_fork.description':
    'The nightrider jumps from a5 to b7 and forks the king on a9 and the queen on c5. The queen on c8 covers the escape squares.',
  'campaign.level.archbishop_chancellor_duo.title':
    'Chapter 23: Archbishop + Chancellor: Double Effect',
  'campaign.level.archbishop_chancellor_duo.description':
    "The archbishop jumps from c9 to b7 and opens the chancellor's rank. Both give check. Without one of the two pieces there is no mate.",
  'campaign.level.angel_endgame.title': 'Chapter 24: The Angel in the Endgame',
  'campaign.level.angel_endgame.description':
    'Black has only a king and a knight. The angel on b5 jumps to a7: check along the a-file and a fork on the knight at f7.',
  'campaign.level.fairy_sacrifice.title': 'Chapter 25: Leap and Queen',
  'campaign.level.fairy_sacrifice.description':
    'Not yet mate. The archbishop jumps from d6 to c8 and gives check. On the next move the queen mates.',
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
  'settings.tutorMode': 'Tutor mode',
  'tutorMode.off': 'Off',
  'tutorMode.guessTheMove': 'Guess the move!',
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
