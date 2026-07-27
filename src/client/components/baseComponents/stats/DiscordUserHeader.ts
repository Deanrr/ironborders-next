import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { DiscordUser } from "../../../../core/ApiSchemas";
import { getDiscordAvatarUrl, translateText } from "../../../Utils";

@customElement("discord-user-header")
export class DiscordUserHeader extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() private _data: DiscordUser | null = null;

  @property({ attribute: false })
  get data(): DiscordUser | null {
    return this._data;
  }
  set data(v: DiscordUser | null) {
    this._data = v;
    this.requestUpdate();
  }

  private get avatarUrl(): string | null {
    const u = this._data;
    if (!u) return null;
    return getDiscordAvatarUrl(u);
  }

  private get discordDisplayName(): string {
    return this._data?.username ?? "";
  }

  render() {
    const imgSrc = this.avatarUrl;
    return html`
      <div class="flex items-center gap-2">
        ${this._data
          ? html`
              <div class="p-[3px] rounded-full bg-gray-500">
                ${imgSrc
                  ? html`<img
                      class="w-12 h-12 rounded-full block"
                      src="${imgSrc}"
                      alt="${translateText("discord_user_header.avatar_alt")}"
                    />`
                  : html`<div
                      class="w-12 h-12 rounded-full flex items-center justify-center bg-slate-700 text-white font-bold"
                      aria-hidden="true"
                    >
                      ${this.discordDisplayName.charAt(0).toUpperCase()}
                    </div>`}
              </div>
            `
          : null}
        <span class="font-semibold text-white">${this.discordDisplayName}</span>
      </div>
    `;
  }
}
