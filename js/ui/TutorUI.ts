/**
 * Modul für das Tutor-System UI.
 * @module TutorUI
 */
import { PHASES } from '../config.js';
import { updateShopUI } from './ShopUI.js';
import type { Game } from '../gameEngine.js';
import type { MoveExplanation } from '../tutor/MoveAnalyzer.js';
import type { MoveResult } from '../aiEngine.js';

export interface TutorHint {
  move: MoveResult | { from: { r: number; c: number }; to: { r: number; c: number } } | null;
  score: number;
  notation: string;
  analysis: MoveExplanation;
  tacticsHighlight: string[];
  pv: string | MoveResult[] | unknown[] | null;
}

interface SetupTemplate {
  id: string;
  name: string;
  description: string;
  pieces: string[];
  cost: number;
  isRecommended?: boolean;
}

interface ScoreDescription {
  label: string;
  color: string;
  emoji: string;
}

interface GameExtensions {
  executeMove: (_from: { r: number; c: number }, _to: { r: number; c: number }) => void;
  getTutorHints: () => Promise<TutorHint[]>;
  analyzeMoveWithExplanation: (_move: unknown, _score: number) => MoveExplanation;
  getScoreDescription: (_score: number) => ScoreDescription | null;
}

type GameWithExtensions = Game & Partial<GameExtensions> & Record<string, unknown>;

/**
 * Zeigt oder verbirgt einen Lade-Status für den Tutor.
 */
export function setTutorLoading(loading: boolean): void {
  const suggestionsEl = document.getElementById('tutor-suggestions');
  if (!suggestionsEl) return;

  if (loading) {
    suggestionsEl.innerHTML = `
      <div class="tutor-thinking-container" style="padding: 2rem; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
        <div class="tutor-thinking-icon" style="font-size: 2.5rem; animation: pulse 1.5s infinite;">🤖</div>
        <div style="font-weight: bold; color: var(--accent-primary);">KI-Tutor denkt nach...</div>
        <div style="font-size: 0.8rem; opacity: 0.7;">Analysiere hunderte Spielverläufe für den optimalen Tipp.</div>
      </div>
    `;
    const panel = document.getElementById('tutor-panel');
    if (panel) panel.classList.remove('hidden');
  }
}

/**
 * Aktualisiert die Tutor-Empfehlungen für die Aufstellungsphase.
 * @param game - Die Game-Instanz
 */
export function updateTutorRecommendations(game: Game): void {
  const toggleBtn = document.getElementById('toggle-tutor-recommendations');
  const container = document.getElementById('tutor-recommendations-container');

  if (!toggleBtn || !container) {
    return;
  }

  const g = game as GameWithExtensions;
  const inSetupPhase = g.phase && String(g.phase).startsWith('SETUP');
  const tutorSection = document.getElementById('tutor-recommendations-section');

  if (!inSetupPhase || !g.tutorController || !g.tutorController.getSetupTemplates) {
    if (tutorSection) tutorSection.classList.add('hidden');
    return;
  }

  if (tutorSection) tutorSection.classList.remove('hidden');

  if (!toggleBtn.dataset.initialized) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = container.classList.contains('hidden');
      container.classList.toggle('hidden');
      toggleBtn.textContent = isHidden
        ? '💡 KI-Empfehlungen ausblenden'
        : '💡 KI-Empfehlungen anzeigen';
    });
    toggleBtn.dataset.initialized = 'true';
  }

  if (container.children.length === 0 || container.dataset.points !== String(g.initialPoints)) {
    const templates = g.tutorController.getSetupTemplates();
    container.innerHTML = '';
    container.dataset.points = String(g.initialPoints);

    (templates as SetupTemplate[]).forEach((template: SetupTemplate) => {
      const card = document.createElement('div');
      card.className = 'setup-template-card';
      if (template.isRecommended) card.classList.add('recommended');

      const color = g.phase === PHASES.SETUP_WHITE_PIECES ? 'white' : 'black';
      const svgs =
        ((window as unknown as Record<string, unknown>).PIECE_SVGS as Record<
          string,
          Record<string, string>
        >) || {};

      const piecesPreview = template.pieces
        .map((pieceType: string) => {
          if (svgs[color] && svgs[color][pieceType]) {
            return `<span class="template-piece-icon">${svgs[color][pieceType]}</span>`;
          } else {
            const symbols: Record<string, string> = {
              p: '♟',
              n: '♞',
              b: '♝',
              r: '♜',
              q: '♛',
              k: '♚',
              a: '🏰',
              c: '⚖️',
              e: '👼',
            };
            return `<span class="template-piece-icon">${symbols[pieceType] || pieceType}</span>`;
          }
        })
        .join('');

      card.innerHTML = `
        ${template.isRecommended ? '<div class="recommended-badge">Empfohlen</div>' : ''}
        <div class="template-name">${template.name}</div>
        <div class="template-description">${template.description}</div>
        <div class="template-pieces">
          <span>Enthält:</span>
          ${piecesPreview}
        </div>
      `;

      card.addEventListener('click', () => {
        g.tutorController!.applySetupTemplate(template.id);
        updateShopUI(game);
      });
      container.appendChild(card);
    });
  }
}

/**
 * Zeigt Tutor-Vorschläge an.
 * @param game - Die Game-Instanz
 * @param providedHints - Optional bereits berechnete Hints
 */
export async function showTutorSuggestions(
  game: Game,
  providedHints: TutorHint[] | null = null
): Promise<void> {
  const g = game as GameWithExtensions;
  const tutorPanel = document.getElementById('tutor-panel');
  const suggestionsEl = document.getElementById('tutor-suggestions');

  const currentPhase = String(g.phase || '');
  const inSetup = currentPhase.startsWith('SETUP');

  if (!tutorPanel || !suggestionsEl) {
    if (
      !g.tutorController ||
      (inSetup ? !g.tutorController.getSetupTemplates : !g.tutorController.getTutorHints)
    ) {
      alert('Tutor nicht verfügbar!');
      return;
    }

    if (inSetup) {
      const templates = g.tutorController.getSetupTemplates();
      let overlay = document.getElementById('tutor-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tutor-overlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 600px; text-align: left;">
              <div class="menu-header">
                <h2>🏗️ Aufstellungs-Vorlagen</h2>
                <button id="close-tutor-btn" class="close-icon-btn">×</button>
              </div>
              <div id="tutor-hints-body" class="templates-overlay-grid" style="max-height: 60vh; overflow-y: auto; padding: 1rem;"></div>
            </div>
          `;
        document.body.appendChild(overlay);
        const closeBtn = document.getElementById('close-tutor-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => overlay!.classList.add('hidden'));
      }

      const body = document.getElementById('tutor-hints-body');
      if (body) {
        body.innerHTML = '';
        body.className = 'templates-overlay-grid';

        const isWhite = currentPhase.includes('WHITE');
        const color = isWhite ? 'white' : 'black';
        const svgs =
          ((window as unknown as Record<string, unknown>).PIECE_SVGS as Record<
            string,
            Record<string, string>
          >) || {};

        (templates as SetupTemplate[]).forEach((template: SetupTemplate) => {
          const div = document.createElement('div');
          div.className = 'setup-template-card' + (template.isRecommended ? ' recommended' : '');

          const piecesPreview = template.pieces
            .map((p: string) => {
              if (svgs[color] && svgs[color][p])
                return `<span class="template-piece-icon">${svgs[color][p]}</span>`;
              return p;
            })
            .join('');

          div.innerHTML = `
              ${template.isRecommended ? '<div class="recommended-badge">KI-Tipp</div>' : ''}
              <div class="template-name">${template.name}</div>
              <div class="template-description" style="font-size: 0.85rem; color: #cbd5e1;">${template.description}</div>
              <div style="margin-top: 10px; display: flex; gap: 4px;">${piecesPreview}</div>
            `;
          div.addEventListener('click', () => {
            if (confirm(`Aufstellung "${template.name}" anwenden?`)) {
              g.tutorController!.applySetupTemplate(template.id);
              overlay!.classList.add('hidden');
              updateShopUI(game);
            }
          });
          body.appendChild(div);
        });
      }
      overlay.classList.remove('hidden');
    } else {
      const hints = providedHints || (await g.tutorController.getTutorHints());
      if (!hints || hints.length === 0) {
        // Instead of an alert, we could show a toast or just a log
        console.log('[TutorUI] No hints available yet.');
        // Show user-friendly toast
        import('../ui.js')
          .then(ui => {
            ui.showToast(
              'Keine Vorschläge verfügbar. Möglicherweise ist die KI noch am Denken oder es gibt keine legalen Züge.',
              'info'
            );
          })
          .catch(() => {});
        return;
      }

      let overlay = document.getElementById('tutor-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'tutor-overlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
        <div class="modal-content" style="max-width: 500px; text-align: left;">
          <div class="menu-header">
            <h2>💡 KI-Tipps</h2>
            <button id="close-tutor-btn" class="close-icon-btn">×</button>
          </div>
          <div id="tutor-hints-body" style="max-height: 60vh; overflow-y: auto;"></div>
        </div>
      `;
        document.body.appendChild(overlay);
        const closeBtn = document.getElementById('close-tutor-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => overlay!.classList.add('hidden'));
      }

      const body = document.getElementById('tutor-hints-body');
      if (body) {
        body.innerHTML = '';
        (hints as TutorHint[]).forEach((hint: TutorHint, index: number) => {
          if (!hint.move) return;
          const move = hint.move!;
          const div = document.createElement('div');
          div.className = 'tutor-hint-item';
          const getQualityColor = (cat: string) => {
            const colors: Record<string, string> = {
              brilliant: '#a855f7',
              best: '#22c55e',
              excellent: '#10b981',
              good: '#3b82f6',
              inaccuracy: '#f59e0b',
              mistake: '#ef4444',
              blunder: '#b91c1c',
            };
            return colors[cat] || '#94a3b8';
          };

          const badgeColor = getQualityColor(hint.analysis.category);

          div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 1.1em;">${index + 1}. ${hint.notation}</strong>
            <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 99px; background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}44; font-weight: 600;">
              ${hint.analysis.category.toUpperCase()}
            </span>
          </div>
          ${
            hint.tacticsHighlight && hint.tacticsHighlight.length > 0
              ? `
          <div style="background: linear-gradient(90deg, #a855f711, transparent); border-left: 3px solid #a855f7; padding: 6px 10px; margin-bottom: 8px; border-radius: 4px;">
            ${hint.tacticsHighlight.map((t: string) => `<div style="color: #e879f9; font-weight: 600;">${t}</div>`).join('')}
          </div>
          `
              : ''
          }
          <div style="font-size: 0.9em; color: ${badgeColor}; margin-bottom: 4px;">${hint.analysis.qualityLabel}</div>
          <div style="font-size: 0.9em; color: #ccc;">
            ${(hint.analysis.tacticalExplanations || []).map((e: string) => `<div>${e}</div>`).join('')}
            ${(hint.analysis.strategicExplanations || []).map((e: string) => `<div>${e}</div>`).join('')}
          </div>
        `;
          div.addEventListener('click', () => {
            overlay!.classList.add('hidden');
            g.executeMove(move.from, move.to);
          });
          body.appendChild(div);
        });
      }
      overlay.classList.remove('hidden');
    }
    return;
  }

  document
    .querySelectorAll('.suggestion-highlight')
    .forEach(el => el.classList.remove('suggestion-highlight'));
  if (g.arrowRenderer) g.arrowRenderer.clearArrows();
  suggestionsEl!.innerHTML = '';

  if (g.phase === PHASES.SETUP_WHITE_PIECES || g.phase === PHASES.SETUP_BLACK_PIECES) {
    if (g.tutorController && g.tutorController.getSetupTemplates) {
      const templates = g.tutorController.getSetupTemplates();
      const header = document.createElement('h3');
      header.textContent = '🏗️ Empfohlene Aufstellungen';
      header.style.marginBottom = '1rem';
      suggestionsEl!.appendChild(header);
      (templates as SetupTemplate[]).forEach((template: SetupTemplate) => {
        const el = document.createElement('div');
        el.className = 'setup-template';
        el.style.cssText =
          'background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s;';
        el.onmouseover = () => {
          el.style.background = 'rgba(34, 197, 94, 0.2)';
        };
        el.onmouseout = () => {
          el.style.background = 'rgba(34, 197, 94, 0.1)';
        };
        const colorPrefix = g.phase === PHASES.SETUP_WHITE_PIECES ? 'white' : 'black';
        const pieceSvgs = (window as unknown as Record<string, unknown>).PIECE_SVGS as Record<
          string,
          Record<string, string>
        >;
        el.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 0.5rem; font-size: 1.1rem;">${template.name}</div>
            <div style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem;">${template.description}</div>
            <div style="font-size: 0.8rem; color: #94a3b8;">Kosten: ${template.cost} Punkte</div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.25rem;">
                <span>Enthält:</span>
                ${template.pieces.map((p: string) => `<span style="display: inline-block; width: 28px; height: 28px;">${pieceSvgs ? pieceSvgs[colorPrefix][p] : p}</span>`).join('')}
            </div>
        `;
        el.onclick = () => {
          if (
            confirm(
              `Möchtest du die Aufstellung "${template.name}" anwenden? Deine aktuelle Aufstellung wird überschrieben.`
            )
          ) {
            g.tutorController!.applySetupTemplate(template.id);
          }
        };
        suggestionsEl!.appendChild(el);
      });
      tutorPanel!.classList.remove('hidden');
      return;
    }
  }

  if (!g.getTutorHints && !providedHints) return;
  const hints = providedHints || (await g.getTutorHints!());
  if (!hints || hints.length === 0) {
    suggestionsEl!.innerHTML =
      '<p style="padding: 1rem; color: #94a3b8;">Keine Vorschläge verfügbar.</p>';
    tutorPanel!.classList.remove('hidden');
    return;
  }

  const header = document.createElement('h3');
  header.innerHTML = `🤖 Tutor Vorschläge <span style="font-size: 0.8rem; font-weight: normal; color: #94a3b8; display: block; margin-top: 0.25rem;">Beste Züge für ${g.turn === 'white' ? 'Weiß' : 'Schwarz'}</span>`;
  suggestionsEl!.appendChild(header);

  (hints as TutorHint[]).forEach((hint: TutorHint, index: number) => {
    if (!hint.move) return;
    const move = hint.move!;
    const analysis = hint.analysis || g.analyzeMoveWithExplanation!(move, hint.score);
    const suggEl = document.createElement('div');
    suggEl.className = `tutor-suggestion ${analysis.category}`;
    suggEl.style.cssText = 'margin-bottom: 1rem; cursor: pointer; transition: all 0.2s ease;';

    const overview = document.createElement('div');
    overview.className = 'suggestion-overview';
    overview.style.cssText =
      'display: flex; align-items: center; gap: 0.75rem; font-weight: 600; padding: 0.75rem; background: rgba(15, 23, 42, 0.6); border-radius: 8px;';
    const rankBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    const scoreDesc = g.getScoreDescription ? g.getScoreDescription(hint.score) : null;
    const scoreDisplay = scoreDesc
      ? `<span style="color: ${scoreDesc.color};">${scoreDesc.emoji} ${scoreDesc.label}</span>`
      : `<span style="color: ${hint.score > 0 ? '#22c55e' : '#888'};">${(hint.score / 100).toFixed(1)}</span>`;
    overview.innerHTML = `<span style="font-size: 1.2rem;">${rankBadge}</span><span style="flex: 1;">${hint.notation}</span>${scoreDisplay}`;
    suggEl.appendChild(overview);

    if (analysis.qualityLabel) {
      const qualityEl = document.createElement('div');
      qualityEl.style.cssText = `font-size: 0.9rem; margin-top: 0.5rem; padding: 0 0.75rem; font-weight: 500; color: ${analysis.category === 'excellent' ? '#fbbf24' : analysis.category === 'good' ? '#4ade80' : '#94a3b8'};`;
      qualityEl.textContent = analysis.qualityLabel;
      suggEl.appendChild(qualityEl);
    }

    const actionsEl = document.createElement('div');
    actionsEl.className = 'suggestion-actions';
    actionsEl.style.cssText =
      'display: flex; gap: 0.5rem; margin-top: 0.75rem; padding: 0 0.75rem;';
    const tryBtn = document.createElement('button');
    tryBtn.className = 'try-move-btn';
    tryBtn.style.cssText =
      'flex: 1; padding: 0.5rem 1rem; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 0.85rem;';
    tryBtn.innerHTML = '▶️ Diesen Zug probieren';
    tryBtn.onmouseover = () => {
      tryBtn.style.transform = 'translateY(-2px)';
    };
    tryBtn.onmouseout = () => {
      tryBtn.style.transform = '';
    };
    tryBtn.onclick = (e: MouseEvent) => {
      e.stopPropagation();
      if (g.executeMove) {
        g.executeMove(move.from, move.to);
        if (tutorPanel) tutorPanel.classList.add('hidden');
      }
    };
    actionsEl.appendChild(tryBtn);
    suggEl.appendChild(actionsEl);

    if (
      (analysis.questions && analysis.questions.length > 0) ||
      (analysis.tacticalExplanations && analysis.tacticalExplanations.length > 0) ||
      (analysis.strategicExplanations && analysis.strategicExplanations.length > 0) ||
      (analysis.warnings && analysis.warnings.length > 0)
    ) {
      const detailsEl = document.createElement('div');
      detailsEl.className = 'suggestion-details hidden';
      detailsEl.style.cssText =
        'margin-top: 0.75rem; padding: 0.75rem; background: rgba(0, 0, 0, 0.3); border-radius: 6px; font-size: 0.85rem;';

      const questionEl = document.createElement('div');
      if (analysis.questions && analysis.questions.length > 0) {
        questionEl.innerHTML = `
          <div style="color: #fbbf24; font-weight: 600; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>🧐</span> 
            <span>${analysis.questions[0]}</span>
          </div>
          <button class="show-details-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
            Erklärung anzeigen
          </button>
        `;
      } else {
        questionEl.innerHTML = `
          <button class="show-details-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
            Warum ist das ein guter Zug?
          </button>
        `;
      }
      questionEl.style.cssText = 'margin-top: 0.75rem; padding: 0 0.75rem;';

      const showBtn = questionEl.querySelector('.show-details-btn') as HTMLElement;
      showBtn.onclick = (e: MouseEvent) => {
        e.stopPropagation();
        detailsEl.classList.toggle('hidden');
        showBtn.textContent = detailsEl.classList.contains('hidden')
          ? analysis.questions?.length > 0
            ? 'Erklärung anzeigen'
            : 'Warum ist das ein guter Zug?'
          : 'Erklärung ausblenden';
      };

      if (analysis.tacticalExplanations && analysis.tacticalExplanations.length > 0) {
        const tactDiv = document.createElement('div');
        tactDiv.style.marginBottom = '0.5rem';
        analysis.tacticalExplanations.forEach((expl: string) => {
          const explItem = document.createElement('div');
          explItem.style.cssText =
            'color: #fca5a5; font-weight: 500; margin: 0.25rem 0; padding-left: 0.5rem; border-left: 2px solid #ef4444;';
          explItem.textContent = expl;
          tactDiv.appendChild(explItem);
        });
        detailsEl.appendChild(tactDiv);
      }
      if (analysis.strategicExplanations && analysis.strategicExplanations.length > 0) {
        const stratDiv = document.createElement('div');
        analysis.strategicExplanations.forEach((expl: string) => {
          const explItem = document.createElement('div');
          explItem.style.cssText = 'color: #cbd5e1; margin: 0.25rem 0; padding-left: 0.5rem;';
          explItem.textContent = expl;
          stratDiv.appendChild(explItem);
        });
        detailsEl.appendChild(stratDiv);
      }
      if (analysis.warnings && analysis.warnings.length > 0) {
        const warnDiv = document.createElement('div');
        warnDiv.style.marginTop = '0.5rem';
        analysis.warnings.forEach((warn: string) => {
          const warnItem = document.createElement('div');
          warnItem.style.cssText =
            'color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 0.25rem 0.5rem; border-radius: 4px; margin: 0.25rem 0;';
          warnItem.textContent = warn;
          warnDiv.appendChild(warnItem);
        });
        detailsEl.appendChild(warnDiv);
      }
      suggEl.appendChild(questionEl);
      suggEl.appendChild(detailsEl);
    }

    suggEl.addEventListener('click', () => {
      document
        .querySelectorAll<HTMLElement>('.tutor-suggestion')
        .forEach(el => (el.style.borderLeft = ''));
      const color =
        analysis.category === 'excellent'
          ? '#fbbf24'
          : analysis.category === 'good'
            ? '#22c55e'
            : '#4f9cf9';
      suggEl.style.borderLeft = `4px solid ${color}`;
      document
        .querySelectorAll('.suggestion-highlight')
        .forEach(el => el.classList.remove('suggestion-highlight'));
      const quality = index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze';

      const arrows = [
        {
          fromR: move.from.r,
          fromC: move.from.c,
          toR: move.to.r,
          toC: move.to.c,
          colorKey: quality,
        },
      ];

      if (analysis.tacticalPatterns) {
        (
          analysis.tacticalPatterns as Array<{
            type: string;
            severity: string;
            explanation: string;
            question?: string;
            targets?: Array<{ r: number; c: number }>;
          }>
        ).forEach(p => {
          if (p.targets) {
            p.targets.forEach((t: { r: number; c: number }) => {
              arrows.push({
                fromR: move.to.r,
                fromC: move.to.c,
                toR: t.r,
                toC: t.c,
                colorKey: 'red',
              });
            });
          }
        });
      }

      if (g.arrowRenderer) {
        g.arrowRenderer.highlightMoves!(arrows);
      }
      const fromCell = document.querySelector(
        `.cell[data-r="${move.from.r}"][data-c="${move.from.c}"]`
      );
      const toCell = document.querySelector(`.cell[data-r="${move.to.r}"][data-c="${move.to.c}"]`);
      if (fromCell) fromCell.classList.add('suggestion-highlight');
      if (toCell) toCell.classList.add('suggestion-highlight');
    });
    suggestionsEl!.appendChild(suggEl);
  });
  tutorPanel!.classList.remove('hidden');
}
