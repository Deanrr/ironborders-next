import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("page-footer")
export class Footer extends LitElement {
  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <footer
        class="[.in-game_&]:hidden bg-zinc-900/90 backdrop-blur-md flex flex-col items-center justify-center gap-2 py-3 text-white/50 w-full border-t border-white/10 shrink-0 relative z-50"
      >
        <div class="flex items-center justify-center gap-5 text-xs px-4">
          <a
            href="https://github.com/Deanrr/ironborders-next"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-white transition-colors"
            >Iron Borders source</a
          >
          <a
            href="https://github.com/openfrontio/OpenFrontIO"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-white transition-colors"
            >OpenFrontIO upstream</a
          >
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-white transition-colors"
            >AGPL-3.0</a
          >
          <lang-selector></lang-selector>
        </div>
        <div class="text-xs px-4" data-i18n="main.copyright"></div>
      </footer>
    `;
  }
}
