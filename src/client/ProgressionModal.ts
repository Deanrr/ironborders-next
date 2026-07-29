import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Progression } from "../core/ApiSchemas";
import { fetchProgression } from "./Api";

@customElement("progression-modal")
export class ProgressionModal extends LitElement {
  @state() private progression: Progression | null = null;
  @state() private loaded = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    const result = await fetchProgression();
    this.progression = result === false ? null : result;
    this.loaded = true;
  }

  render() {
    if (!this.loaded) {
      return html`<div class="text-sm text-white/50">Loading progression…</div>`;
    }
    if (!this.progression) {
      return html`<div class="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
        Sign in to track campaign progression.
      </div>`;
    }

    const p = this.progression;
    const progress = Math.min(100, (p.currentXp / p.nextLevelXp) * 100);
    return html`
      <div class="flex flex-col gap-4 text-white">
        <div class="rounded-xl border border-indigo-300/25 bg-indigo-500/10 p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-xs uppercase tracking-[0.2em] text-indigo-200/70">Campaign progression</div>
              <div class="mt-1 text-2xl font-semibold">Level ${p.level} · ${p.title}</div>
            </div>
            <div class="rounded-full bg-indigo-300/15 px-3 py-1 text-sm text-indigo-100">${p.currentXp} XP</div>
          </div>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
            <div class="h-full rounded-full bg-indigo-300" style="width:${progress}%"></div>
          </div>
          <div class="mt-1 text-right text-xs text-white/50">${p.currentXp} / ${p.nextLevelXp} XP</div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          ${this.stat("Matches", p.lifetimeMatches)}
          ${this.stat("Wins", p.lifetimeWins)}
          ${this.stat("Fronts won", p.frontsWon)}
          ${this.stat("Capitals captured", p.capitalsCaptured)}
          ${this.stat("Nations liberated", p.nationsLiberated)}
          ${this.stat("Locations secured", p.strategicLocationsSecured)}
        </div>
        <p class="text-xs text-white/45">Progression unlocks cosmetics and presentation themes, never stronger combat units.</p>
      </div>
    `;
  }

  private stat(label: string, value: number) {
    return html`<div class="rounded-lg border border-white/10 bg-white/5 p-3">
      <div class="text-xs uppercase tracking-wide text-white/45">${label}</div>
      <div class="mt-1 text-xl font-semibold">${value.toLocaleString()}</div>
    </div>`;
  }
}
