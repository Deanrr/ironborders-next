import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { FrontMomentum } from "../../../core/game/FrontFraming";
import { Cell, PlayerType } from "../../../core/game/Game";
import { FrontStateUpdate } from "../../../core/game/GameUpdates";
import {
  AuthorityState,
  NationalEventType,
  StrategicLocation,
  StrategicLocationType,
} from "../../../core/game/NationalFraming";
import { Controller } from "../../Controller";
import { DragEvent, MouseMoveEvent, ZoomEvent } from "../../InputHandler";
import { GoToPositionEvent, TransformHandler } from "../../TransformHandler";
import { GameView } from "../../view";

/** Map-facing national capital markers and connected-front direction cues. */
@customElement("national-locations-overlay")
export class NationalLocationsOverlay extends LitElement implements Controller {
  @property({ type: Object })
  public game!: GameView;

  @property({ type: Object })
  public eventBus!: EventBus;

  @property({ type: Object })
  public transform!: TransformHandler;

  @state()
  private selectedFrontID: string | null = null;

  private readonly requestTransformUpdate = () => this.requestUpdate();

  private readonly preventMarkerContextMenu = (event: MouseEvent) => {
    // Marker buttons sit above the canvas. Do not let their right-click bubble
    // into the map's context-menu handler and open the build/action panel.
    event.preventDefault();
    event.stopPropagation();
  };

  init() {
    this.eventBus.on(ZoomEvent, this.requestTransformUpdate);
    this.eventBus.on(DragEvent, this.requestTransformUpdate);
  }

  tick() {
    this.requestUpdate();
  }

  getTickIntervalMs() {
    // Keep screen-space markers in lockstep with camera pans, zooms, and
    // smooth camera movement rather than waiting for the next game update.
    return 16;
  }

  private markerColor(authorityState: AuthorityState): string {
    switch (authorityState) {
      case AuthorityState.CapitalThreatened:
      case AuthorityState.CapitalOccupied:
      case AuthorityState.GovernmentDisplaced:
      case AuthorityState.FullyOccupied:
        return "#f87171";
      case AuthorityState.Contested:
      case AuthorityState.PartiallyOccupied:
        return "#fbbf24";
      case AuthorityState.Liberated:
        return "#a78bfa";
      default:
        return "#67e8f9";
    }
  }

  private renderMarker(
    name: string,
    authorityState: AuthorityState,
    x: number,
    y: number,
    worldX: number,
    worldY: number,
  ) {
    const color = this.markerColor(authorityState);
    const isThreatened =
      authorityState === AuthorityState.CapitalThreatened ||
      authorityState === AuthorityState.CapitalOccupied ||
      authorityState === AuthorityState.GovernmentDisplaced ||
      authorityState === AuthorityState.FullyOccupied;

    return html`
      <button
        class="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 text-[10px] font-bold leading-none shadow-lg transition-transform hover:scale-125 focus:scale-125 focus:outline-none"
        style="left: ${x}px; top: ${y}px; width: ${isThreatened
          ? 26
          : 20}px; height: ${isThreatened
          ? 26
          : 20}px; color: ${color}; border-color: ${color}; background: rgba(15, 23, 42, 0.88); pointer-events: auto;"
        title="${name} capital - ${authorityState}"
        aria-label="${name} capital - ${authorityState}"
        @contextmenu=${this.preventMarkerContextMenu}
        @click=${(event: MouseEvent) => {
          event.stopPropagation();
          this.eventBus.emit(new MouseMoveEvent(x, y));
          this.eventBus.emit(new GoToPositionEvent(worldX, worldY));
        }}
      >
        ${isThreatened ? "!" : "*"}
      </button>
      ${isThreatened
        ? html`<span
            class="absolute -translate-x-1/2 mt-3 whitespace-nowrap rounded bg-slate-950/80 px-1 text-[9px] text-white/90"
            style="left: ${x}px; top: ${y}px; pointer-events: none;"
            >${name}</span
          >`
        : html``}
    `;
  }

  private frontColor(momentum: FrontMomentum): string {
    switch (momentum) {
      case FrontMomentum.Breakthrough:
        return "#f87171";
      case FrontMomentum.Advancing:
        return "#fb923c";
      case FrontMomentum.Collapsing:
        return "#c084fc";
      case FrontMomentum.Reinforced:
        return "#60a5fa";
      case FrontMomentum.Overextended:
        return "#facc15";
      default:
        return "#94a3b8";
    }
  }

  private renderStrategicLocation(
    location: StrategicLocation,
    nationID: string,
    x: number,
    y: number,
  ) {
    if (location.type === StrategicLocationType.Capital) return html``;
    const marker = {
      [StrategicLocationType.MajorCity]: {
        label: "C",
        color: "#fcd34d",
        name: "major city",
      },
      [StrategicLocationType.Port]: {
        label: "P",
        color: "#67e8f9",
        name: "port",
      },
      [StrategicLocationType.IndustrialRegion]: {
        label: "I",
        color: "#c4b5fd",
        name: "industrial region",
      },
      [StrategicLocationType.LogisticsHub]: {
        label: "H",
        color: "#34d399",
        name: "logistics hub",
      },
      [StrategicLocationType.Chokepoint]: {
        label: "K",
        color: "#fb923c",
        name: "chokepoint",
      },
      [StrategicLocationType.Crossing]: {
        label: "X",
        color: "#f472b6",
        name: "crossing",
      },
      [StrategicLocationType.StrategicIsland]: {
        label: "S",
        color: "#38bdf8",
        name: "strategic island",
      },
    }[location.type];
    if (!marker) return html``;
    const captured =
      location.ownerID !== null && location.ownerID !== nationID;
    const color = location.threatened
      ? "#fb923c"
      : captured
        ? "#f87171"
        : marker.color;
    const status = location.threatened
      ? "threatened"
      : captured
        ? "captured"
        : "secure";
    return html`<button
      class="absolute -translate-x-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-sm border text-[8px] font-bold leading-none shadow"
      style="left: ${x}px; top: ${y}px; color: ${color}; border-color: ${color}; background: rgba(15, 23, 42, 0.82); pointer-events: auto;"
      title="${marker.name} - ${status}"
      aria-label="${marker.name} - ${status}"
      @contextmenu=${this.preventMarkerContextMenu}
      @click=${(event: MouseEvent) => {
        event.stopPropagation();
        this.eventBus.emit(new MouseMoveEvent(x, y));
        this.eventBus.emit(
          new GoToPositionEvent(
            this.game.x(location.tile),
            this.game.y(location.tile),
          ),
        );
      }}
    >
      ${marker.label}
    </button>`;
  }

  private shouldRenderStrategicLocation(location: StrategicLocation): boolean {
    const isGeographic =
      location.type === StrategicLocationType.Chokepoint ||
      location.type === StrategicLocationType.Crossing ||
      location.type === StrategicLocationType.StrategicIsland;
    if (!isGeographic) return true;

    // Border-derived markers are intentionally quiet when zoomed out. Scale
    // the detail threshold from the current map-to-viewport fit so this works
    // consistently across map sizes and window dimensions.
    const viewport = this.transform.boundingRect();
    const fitScale = Math.min(
      viewport.width / Math.max(1, this.game.width()),
      viewport.height / Math.max(1, this.game.height()),
    );
    const detailScale = Math.max(1.25, fitScale * 1.35);
    return location.threatened === true || this.transform.scale >= detailScale;
  }

  private renderNationalPulse(event: NationalEventType, x: number, y: number) {
    const urgent =
      event === NationalEventType.CapitalCaptured ||
      event === NationalEventType.GovernmentDisplaced ||
      event === NationalEventType.NationEliminated ||
      event === NationalEventType.NationOccupied ||
      event === NationalEventType.StrategicLocationCaptured;
    const color = urgent ? "#f87171" : "#fbbf24";
    return html`<span
      class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 animate-ping"
      style="left: ${x}px; top: ${y}px; width: ${urgent
        ? 42
        : 32}px; height: ${urgent
        ? 42
        : 32}px; border-color: ${color}; pointer-events: none;"
      aria-hidden="true"
    ></span>`;
  }

  private renderFront(front: FrontStateUpdate, x: number, y: number) {
    const color = this.frontColor(front.momentum);
    const angle =
      (Math.atan2(front.directionY, front.directionX) * 180) / Math.PI;
    const width = 18 + Math.round(front.pressure * 14);
    return html`
      <button
        class="absolute -translate-y-1/2 flex h-5 items-center border-0 bg-transparent p-0 focus:outline-none"
        style="left: ${x}px; top: ${y}px; width: ${width}px; transform: rotate(${angle}deg); pointer-events: auto;"
        title="${front.name} - ${front.momentum}"
        aria-label="${front.name} - ${front.momentum}"
        @contextmenu=${this.preventMarkerContextMenu}
        @click=${(event: MouseEvent) => {
          event.stopPropagation();
          this.selectedFrontID = front.frontID;
        }}
      >
        <span
          class="h-0.5 w-full rounded-full shadow-sm"
          style="background: ${color};"
        ></span>
        <span
          class="absolute right-0 text-[9px] font-bold"
          style="color: ${color}; text-shadow: 0 1px 2px #020617;"
          aria-hidden="true"
          >></span
        >
      </button>
    `;
  }

  private renderFrontBoundary(
    front: FrontStateUpdate,
    first: { x: number; y: number },
    second: { x: number; y: number },
  ) {
    const color = this.frontColor(front.momentum);
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 4) return html``;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return html`<span
      class="absolute h-0.5 origin-left border-t border-dashed opacity-70"
      style="left: ${first.x}px; top: ${first.y}px; width: ${length}px; border-color: ${color}; transform: rotate(${angle}deg); pointer-events: none;"
      title="${front.name} boundary"
    ></span>`;
  }

  private renderFrontInspector(front: FrontStateUpdate | undefined) {
    if (!front) return html``;
    let attacker = front.attackerID;
    let defender = front.defenderID;
    try {
      attacker = this.game.player(front.attackerID).displayName();
      defender = this.game.player(front.defenderID).displayName();
    } catch {
      // A player may be removed between front and player snapshots.
    }
    return html`
      <div
        class="pointer-events-auto fixed top-16 left-1/2 z-[45] -translate-x-1/2 rounded-lg bg-slate-950/90 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-sm"
        @contextmenu=${this.preventMarkerContextMenu}
        @click=${() => (this.selectedFrontID = null)}
      >
        <div class="font-semibold text-cyan-200">${front.name}</div>
        <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-white/80">
          <span>${attacker} -> ${defender}</span>
          <span>Momentum: ${front.momentum}</span>
          <span>Pressure: ${Math.round(front.pressure * 100)}%</span>
          <span>Committed: ${Math.round(front.troopsCommitted)}</span>
          <span>Territory: +${front.territoryGained} / -${front.territoryLost}</span>
          <span
            >Direction: ${Math.round(front.directionX * 100)}%,
            ${Math.round(front.directionY * 100)}%</span
          >
        </div>
      </div>
    `;
  }

  render() {
    if (!this.game || !this.transform) return html``;

    const frontStates = this.game.frontStates();
    const fronts = frontStates.flatMap((front) => {
      const results = [];
      const screenPositions: { x: number; y: number }[] = [];
      for (const tile of front.positions.slice(0, 2)) {
        const cell = new Cell(this.game.x(tile), this.game.y(tile));
        if (!this.transform.isOnScreen(cell)) continue;
        const screen = this.transform.worldToScreenCoordinates(cell);
        screenPositions.push(screen);
        results.push(this.renderFront(front, screen.x, screen.y));
      }
      if (screenPositions.length === 2) {
        results.unshift(
          this.renderFrontBoundary(
            front,
            screenPositions[0],
            screenPositions[1],
          ),
        );
      }
      return results;
    });

    const nationalPulses = this.game.nationalEventPulses().flatMap((pulse) => {
      const cell = new Cell(this.game.x(pulse.tile), this.game.y(pulse.tile));
      if (!this.transform.isOnScreen(cell)) return [];
      const screen = this.transform.worldToScreenCoordinates(cell);
      return [this.renderNationalPulse(pulse.event, screen.x, screen.y)];
    });

    const markers = this.game
      .players()
      .filter((player) => player.type() !== PlayerType.Bot)
      .flatMap((player) => {
        const state = this.game.nationalState(player.id());
        if (!state || !Number.isFinite(state.capitalTile)) return [];
        const cell = new Cell(
          this.game.x(state.capitalTile),
          this.game.y(state.capitalTile),
        );
        if (!this.transform.isOnScreen(cell)) return [];
        const screen = this.transform.worldToScreenCoordinates(cell);
        return [
          this.renderMarker(
            player.displayName(),
            state.authorityState,
            screen.x,
            screen.y,
            cell.x,
            cell.y,
          ),
        ];
      });

    const strategicLocations = this.game
      .players()
      .filter((player) => player.type() !== PlayerType.Bot)
      .flatMap((player) => {
        const state = this.game.nationalState(player.id());
        return (state?.locations ?? [])
          .filter(
            (location) =>
              location.type !== StrategicLocationType.Capital &&
              this.shouldRenderStrategicLocation(location),
          )
          .flatMap((location) => {
            const cell = new Cell(
              this.game.x(location.tile),
              this.game.y(location.tile),
            );
            if (!this.transform.isOnScreen(cell)) return [];
            const screen = this.transform.worldToScreenCoordinates(cell);
            return [
              this.renderStrategicLocation(
                location,
                player.id(),
                screen.x,
                screen.y,
              ),
            ];
          });
      });

    const selectedFront = frontStates.find(
      (front) => front.frontID === this.selectedFrontID,
    );
    return html`${nationalPulses}${fronts}${strategicLocations}${markers}${this.renderFrontInspector(
      selectedFront,
    )}`;
  }

  createRenderRoot() {
    return this;
  }
}
