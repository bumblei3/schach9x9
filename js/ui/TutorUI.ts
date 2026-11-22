/**
 * Modul für das Tutor-System UI.
 * @module TutorUI
 */
import { PHASES } from '../config.js';
import { updateShopUI } from './ShopUI.js';
import { showToast, showModal } from '../ui.js';
import { t } from '../i18n.js';
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
        <div style="font-weight: bold; color: var(--accent-primary);">${t('tutor.thinking')}</div>
        <div style="font-size: 0.8rem; opacity: 0.7;">${t('tutor.analyzing')}</div>
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
        ${template.isRecommended
          ? `<div class="recommended-badge">${t('tutor.recommendedBadge')}</div>`
          : ''}
        <div class="template-name">${template.name}</div>
        <div class="template-description">${template.description}</div>
        <div class="template-pieces">
          <span>${t('tutor.contains')}</span>
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
  // Der Debounce-Timer aus `TutorController` ueberlebt den Test-Aufbau: ist
  // jsdom bereits abgerissen, ist `document` weg und der Aufruf wuerde als
  // Unhandled Rejection den vitest-Lauf rot machen — alle Tests grün, aber
  // `Errors 1 error`. Gleiches Muster wie in `MoveAnalyzer`.
  if (typeof document === 'undefined') return;
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
      showToast(t('toast.tutorUnavailable'), 'error');
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
              ${template.isRecommended ? `<div class="recommended-badge">${t('tutor.aiTipBadge')}</div>` : ''}
              <div class="template-name">${template.name}</div>
              <div class="template-description" style="font-size: 0.85rem; color: #cbd5e1;">${template.description}</div>
              <div style="margin-top: 10px; display: flex; gap: 4px;">${piecesPreview}</div>
            `;
          div.addEventListener('click', () => {
            // Kein natives `confirm()`: die App hat ein eigenes Modal, und
            // `#generic-modal` ist E2E-klickbar, ein OS-Dialog nicht.
            showModal(`Aufstellung "${template.name}" anwenden?`, '', [
              {
                text: 'Anwenden',
                class: 'btn-primary',
                callback: () => {
                  g.tutorController!.applySetupTemplate(template.id);
                  overlay!.classList.add('hidden');
                  updateShopUI(game);
                },
              },
              { text: 'Abbrechen', class: 'btn-secondary' },
            ]);
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
        showToast(t('toast.tutorNoHints'), 'info');
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
            <h2>${t('tutor.hintsTitle')}</h2>
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
}
