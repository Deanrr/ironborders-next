import { html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { DirectiveResult } from "lit/directive.js";
import { unsafeHTML, UnsafeHTMLDirective } from "lit/directives/unsafe-html.js";
import { EventBus } from "../../../core/EventBus";
import { FactionEventType } from "../../../core/game/FactionFraming";
import { FrontEventType, FrontMomentum } from "../../../core/game/FrontFraming";
import { AllPlayers, MessageType } from "../../../core/game/Game";
import { TileRef } from "../../../core/game/GameMap";
import {
  AllianceExpiredUpdate,
  AllianceRequestReplyUpdate,
  BrokeAllianceUpdate,
  DisplayChatMessageUpdate,
  DisplayMessageUpdate,
  DonateEventUpdate,
  EmojiUpdate,
  FactionEventUpdate,
  FrontEventUpdate,
  GameUpdateType,
  NationalEventUpdate,
  TargetPlayerUpdate,
  UnitIncomingUpdate,
} from "../../../core/game/GameUpdates";
import {
  NationalEventType,
  StrategicLocationType,
} from "../../../core/game/NationalFraming";
import { UserSettings } from "../../../core/game/UserSettings";
import { Controller } from "../../Controller";
import { SendAllianceRequestIntentEvent } from "../../Transport";

import { onlyImages } from "../../../core/Util";
import { GoToPlayerEvent, GoToUnitEvent } from "../../TransformHandler";
import { GameView, PlayerView, UnitView } from "../../view";

import { PlaySoundEffectEvent } from "../../sound/Sounds";
import { UIState } from "../../UIState";
import {
  getMessageTypeClasses,
  renderNumber,
  renderTroops,
  translateText,
} from "../../Utils";

interface GameEvent {
  description: string;
  unsafeDescription?: boolean;
  type: MessageType;
  category?: EventCategory;
  tone?: EventTone;
  highlight?: boolean;
  createdAt: number;
  onDelete?: () => void;
  focusID?: number;
  unitView?: UnitView;
  /** True when this notice is addressed to the local player. */
  playerSpecific?: boolean;
}

export type EventCategory =
  | "threat"
  | "front"
  | "conquest"
  | "diplomacy"
  | "logistics"
  | "economy"
  | "faction"
  | "progression";

export type EventTone = "positive" | "neutral" | "warning" | "critical";
type EventFilter =
  | "all"
  | "player"
  | "war"
  | "nation"
  | "diplomacy"
  | "threats";

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  threat: "THREAT",
  front: "FRONT",
  conquest: "NATION",
  diplomacy: "DIPLOMACY",
  logistics: "LOGISTICS",
  economy: "ECONOMY",
  faction: "FACTION",
  progression: "PROGRESS",
};

const EVENT_CATEGORY_ICONS: Record<EventCategory, string> = {
  threat: "!",
  front: "→",
  conquest: "◆",
  diplomacy: "⚑",
  logistics: "◇",
  economy: "¤",
  faction: "✦",
  progression: "★",
};

const EVENT_TONE_CLASSES: Record<EventTone, string> = {
  positive: "border-emerald-400 bg-emerald-500/10 text-emerald-100",
  neutral: "border-slate-500 bg-slate-500/10 text-slate-100",
  warning: "border-amber-400 bg-amber-500/10 text-amber-100",
  critical: "border-red-500 bg-red-500/15 text-red-100",
};

const EVENT_FILTER_LABELS: Record<EventFilter, string> = {
  all: "All",
  player: "My alerts",
  war: "War",
  nation: "Nation",
  diplomacy: "Diplomacy",
  threats: "Threats",
};

const TIER_1_TYPES: ReadonlySet<MessageType> = new Set([
  MessageType.NUKE_INBOUND,
  MessageType.HYDROGEN_BOMB_INBOUND,
  MessageType.CRUISE_MISSILE_INBOUND,
  MessageType.MIRV_INBOUND,
  MessageType.NUKE_DETONATED,
  MessageType.CRUISE_MISSILE_DETONATED,
  MessageType.NAVAL_INVASION_INBOUND,
  MessageType.NAVAL_CONVOY_INBOUND,
  MessageType.ATTACK_REQUEST,
  MessageType.ALLIANCE_ACCEPTED,
  MessageType.ALLIANCE_REJECTED,
  MessageType.ALLIANCE_BROKEN,
  MessageType.RENEW_ALLIANCE,
  MessageType.CONQUERED_PLAYER,
  MessageType.CHAT,
  MessageType.DONATION_RECEIVED,
]);

const isTier1 = (type: MessageType): boolean => TIER_1_TYPES.has(type);

const ACTIONABLE_NATIONAL_EVENTS: ReadonlySet<NationalEventType> = new Set([
  NationalEventType.BorderBreached,
  NationalEventType.DefensiveLineBroken,
  NationalEventType.MajorRegionSecured,
  NationalEventType.CapitalThreatened,
  NationalEventType.CapitalSecured,
  NationalEventType.CapitalEncircled,
  NationalEventType.CapitalCaptured,
  NationalEventType.GovernmentDisplaced,
  NationalEventType.NationOccupied,
  NationalEventType.NationLiberated,
  NationalEventType.LiberationAttempted,
  NationalEventType.NationEliminated,
  NationalEventType.StrategicLocationThreatened,
  NationalEventType.StrategicLocationCaptured,
]);

const ACTIONABLE_FRONT_MOMENTA: ReadonlySet<FrontMomentum> = new Set([
  FrontMomentum.Advancing,
  FrontMomentum.Overextended,
  FrontMomentum.Collapsing,
  FrontMomentum.Reinforced,
  FrontMomentum.Breakthrough,
]);

const INCOMING_THREAT_TYPES: ReadonlySet<MessageType> = new Set([
  MessageType.NAVAL_INVASION_INBOUND,
  MessageType.NAVAL_CONVOY_INBOUND,
  MessageType.MIRV_INBOUND,
  MessageType.NUKE_INBOUND,
  MessageType.HYDROGEN_BOMB_INBOUND,
  MessageType.CRUISE_MISSILE_INBOUND,
]);

const EVENT_RETENTION_TICKS = 300;
const PLAYER_EVENT_RETENTION_TICKS = 600;

@customElement("events-display")
export class EventsDisplay extends LitElement implements Controller {
  public eventBus: EventBus;
  public game: GameView;
  public uiState: UIState;

  private active: boolean = false;
  private events: GameEvent[] = [];
  private userSettings = new UserSettings();

  @state() private _isVisible: boolean = false;
  @state() private _isExpanded: boolean = true;
  @state() private _eventFilter: EventFilter = "all";

  @query(".events-container")
  private _eventsContainer?: HTMLDivElement;
  private _shouldScrollToBottom = true;

  @query(".important-events-container")
  private _importantEventsContainer?: HTMLDivElement;
  private _shouldScrollImportantToBottom = true;

  updated(changed: Map<string, unknown>) {
    super.updated(changed);
    if (this._eventsContainer && this._shouldScrollToBottom) {
      this._eventsContainer.scrollTop = this._eventsContainer.scrollHeight;
    }
    if (this._importantEventsContainer && this._shouldScrollImportantToBottom) {
      this._importantEventsContainer.scrollTop =
        this._importantEventsContainer.scrollHeight;
    }
  }

  private renderButton(options: {
    content: any; // Can be string, TemplateResult, or other renderable content
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
    translate?: boolean;
    hidden?: boolean;
  }) {
    const {
      content,
      onClick,
      className = "",
      disabled = false,
      translate = true,
      hidden = false,
    } = options;

    if (hidden) {
      return html``;
    }

    return html`
      <button
        class="${className}"
        @click=${onClick}
        ?disabled=${disabled}
        ?translate=${translate}
      >
        ${content}
      </button>
    `;
  }

  private updateMap = [
    [GameUpdateType.DisplayEvent, this.onDisplayMessageEvent.bind(this)],
    [GameUpdateType.DisplayChatEvent, this.onDisplayChatEvent.bind(this)],
    [
      GameUpdateType.AllianceRequestReply,
      this.onAllianceRequestReplyEvent.bind(this),
    ],
    [GameUpdateType.BrokeAlliance, this.onBrokeAllianceEvent.bind(this)],
    [GameUpdateType.TargetPlayer, this.onTargetPlayerEvent.bind(this)],
    [GameUpdateType.Emoji, this.onEmojiMessageEvent.bind(this)],
    [GameUpdateType.UnitIncoming, this.onUnitIncomingEvent.bind(this)],
    [GameUpdateType.AllianceExpired, this.onAllianceExpiredEvent.bind(this)],
    [GameUpdateType.DonateEvent, this.onDonateEvent.bind(this)],
    [GameUpdateType.NationalEvent, this.onNationalEvent.bind(this)],
    [GameUpdateType.FrontEvent, this.onFrontEvent.bind(this)],
    [GameUpdateType.FactionEvent, this.onFactionEvent.bind(this)],
  ] as const;

  constructor() {
    super();
    this.events = [];
  }

  init() {
    this.eventBus.on(
      SendAllianceRequestIntentEvent,
      this.onAllianceRequestSentConfirmation.bind(this),
    );
  }

  private onAllianceRequestSentConfirmation(e: SendAllianceRequestIntentEvent) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer || e.requestor.id() !== myPlayer.id()) {
      return;
    }
    // If the recipient already has a pending alliance request to us, this
    // action accepts that request instead of sending a new one, so don't
    // show the "alliance request sent" confirmation.
    if (e.recipient.isRequestingAllianceWith(e.requestor)) {
      return;
    }
    this.addEvent({
      description: translateText("events_display.alliance_request_sent", {
        name: e.recipient.name(),
      }),
      type: MessageType.ALLIANCE_REQUEST,
      createdAt: this.game.ticks(),
      playerSpecific: true,
    });
  }

  tick() {
    this.active = true;

    if (this._eventsContainer) {
      const el = this._eventsContainer;
      this._shouldScrollToBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 5;
    } else {
      this._shouldScrollToBottom = true;
    }

    if (this._importantEventsContainer) {
      const el = this._importantEventsContainer;
      this._shouldScrollImportantToBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 5;
    } else {
      this._shouldScrollImportantToBottom = true;
    }

    if (!this._isVisible && !this.game.inSpawnPhase()) {
      this._isVisible = true;
      this.requestUpdate();
    }

    const myPlayer = this.game.myPlayer();
    if (!myPlayer || !myPlayer.isAlive()) {
      if (this._isVisible) {
        this._isVisible = false;
        this.requestUpdate();
      }
      return;
    }

    const updates = this.game.updatesSinceLastTick();
    if (updates) {
      for (const [ut, fn] of this.updateMap) {
        updates[ut]?.forEach(fn as (event: unknown) => void);
      }
    }

    let remainingEvents = this.events.filter((event) => {
      const retentionTicks = event.playerSpecific
        ? PLAYER_EVENT_RETENTION_TICKS
        : EVENT_RETENTION_TICKS;
      const expired = this.game.ticks() - event.createdAt >= retentionTicks;
      const isInboundWarning =
        event.type === MessageType.NUKE_INBOUND ||
        event.type === MessageType.HYDROGEN_BOMB_INBOUND ||
        event.type === MessageType.MIRV_INBOUND ||
        event.type === MessageType.NAVAL_INVASION_INBOUND ||
        event.type === MessageType.CRUISE_MISSILE_INBOUND ||
        event.type === MessageType.NAVAL_CONVOY_INBOUND;
      const unitGone =
        isInboundWarning &&
        event.unitView !== undefined &&
        !event.unitView.isActive();
      const shouldKeep = !expired && !unitGone;
      if (!shouldKeep && event.onDelete) {
        event.onDelete();
      }
      return shouldKeep;
    });

    if (remainingEvents.length > 30) {
      remainingEvents = remainingEvents.slice(-30);
    }

    if (this.events.length !== remainingEvents.length) {
      this.events = remainingEvents;
      this.requestUpdate();
    }

    this.requestUpdate();
  }

  private addEvent(event: GameEvent) {
    const category = event.category ?? this.categoryForMessageType(event.type);
    const tone = event.tone ?? this.toneForMessageType(event.type);
    this.events = [...this.events, { ...event, category, tone }];
    this.requestUpdate();
  }

  private categoryForMessageType(type: MessageType): EventCategory {
    if (INCOMING_THREAT_TYPES.has(type)) return "threat";
    if (
      type === MessageType.ATTACK_REQUEST ||
      type === MessageType.NUKE_DETONATED ||
      type === MessageType.CRUISE_MISSILE_DETONATED
    ) {
      return "front";
    }
    if (
      type === MessageType.ALLIANCE_ACCEPTED ||
      type === MessageType.ALLIANCE_REJECTED ||
      type === MessageType.ALLIANCE_BROKEN ||
      type === MessageType.RENEW_ALLIANCE ||
      type === MessageType.ALLIANCE_REQUEST
    ) {
      return "diplomacy";
    }
    if (type === MessageType.DONATION_RECEIVED) return "economy";
    if (type === MessageType.CONQUERED_PLAYER) return "conquest";
    return "logistics";
  }

  private toneForMessageType(type: MessageType): EventTone {
    if (INCOMING_THREAT_TYPES.has(type)) return "critical";
    if (type === MessageType.CRUISE_MISSILE_DETONATED) return "critical";
    if (type === MessageType.ALLIANCE_ACCEPTED) return "positive";
    if (
      type === MessageType.ALLIANCE_REJECTED ||
      type === MessageType.ALLIANCE_BROKEN
    ) {
      return "warning";
    }
    return "neutral";
  }

  private eventMatchesFilter(event: GameEvent): boolean {
    switch (this._eventFilter) {
      case "all":
        return true;
      case "player":
        return (
          event.playerSpecific === true &&
          (event.category === "threat" ||
            event.category === "front" ||
            (event.category === "conquest" &&
              (event.tone === "warning" || event.tone === "critical")))
        );
      case "war":
        return event.category === "front";
      case "nation":
        return event.category === "conquest";
      case "diplomacy":
        return event.category === "diplomacy" || event.category === "faction";
      case "threats":
        return event.category === "threat";
    }
  }

  /** Keep national-war notices local to the player's current theater. */
  private isTileNearMyNation(tile: TileRef | undefined): boolean {
    if (tile === undefined || !this.game.isValidRef(tile)) return false;
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return false;

    const anchors: TileRef[] = [];
    const nationalState = this.game.nationalState(myPlayer.id());
    if (nationalState) {
      anchors.push(nationalState.capitalTile);
      anchors.push(...nationalState.locations.map((location) => location.tile));
    }
    const nameLocation = myPlayer.nameLocation();
    if (
      nameLocation &&
      this.game.isValidCoord(nameLocation.x, nameLocation.y)
    ) {
      anchors.push(this.game.ref(nameLocation.x, nameLocation.y));
    }
    anchors.push(...myPlayer.units().map((unit) => unit.tile()));
    if (anchors.length === 0) return false;

    const radius = Math.max(
      24,
      Math.min(
        80,
        Math.round(Math.sqrt(Math.max(1, myPlayer.numTilesOwned())) * 2),
      ),
    );
    const targetX = this.game.x(tile);
    const targetY = this.game.y(tile);
    return anchors.some((anchor) => {
      if (!this.game.isValidRef(anchor)) return false;
      const dx = this.game.x(anchor) - targetX;
      const dy = this.game.y(anchor) - targetY;
      return dx * dx + dy * dy <= radius * radius;
    });
  }

  private isFrontRelevant(update: FrontEventUpdate): boolean {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return false;
    if (
      update.attackerID === myPlayer.id() ||
      update.defenderID === myPlayer.id()
    ) {
      return true;
    }
    const front = this.game
      .frontStates()
      .find((candidate) => candidate.frontID === update.frontID);
    return (
      (front?.positions ?? []).some((tile) => this.isTileNearMyNation(tile)) ||
      this.isTileNearMyNation(update.tile)
    );
  }

  private onNationalEvent(update: NationalEventUpdate) {
    if (!ACTIONABLE_NATIONAL_EVENTS.has(update.event)) return;
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return;
    if (
      update.nationID !== myPlayer.id() &&
      update.relatedNationID !== myPlayer.id() &&
      !this.isTileNearMyNation(update.tile)
    ) {
      return;
    }

    let nation: PlayerView;
    try {
      nation = this.game.player(update.nationID);
    } catch {
      return;
    }

    const name = nation.displayName();
    const descriptions: Record<NationalEventType, string> = {
      [NationalEventType.BorderBreached]: `${name} border breached`,
      [NationalEventType.DefensiveLineBroken]: `${name} defensive line broken`,
      [NationalEventType.MajorRegionSecured]: `${name} major region secured`,
      [NationalEventType.CapitalThreatened]: `${name} capital threatened`,
      [NationalEventType.CapitalSecured]: `${name} capital secured`,
      [NationalEventType.CapitalEncircled]: `${name} capital encircled`,
      [NationalEventType.CapitalCaptured]: `${name} capital captured`,
      [NationalEventType.GovernmentDisplaced]: `${name} government displaced`,
      [NationalEventType.NationOccupied]: `${name} occupied`,
      [NationalEventType.ResistanceSurging]: `${name} resistance surging`,
      [NationalEventType.ResistanceContained]: `${name} resistance contained`,
      [NationalEventType.NationPartiallyOccupied]: `${name} partially occupied`,
      [NationalEventType.NationLiberated]: `${name} liberated`,
      [NationalEventType.LiberationAttempted]: `${name} liberation attempt`,
      [NationalEventType.NationEliminated]: `${name} eliminated`,
      [NationalEventType.SupplyCrisis]: `${name} supply crisis`,
      [NationalEventType.SupplyRestored]: `${name} supply restored`,
      [NationalEventType.WarExhaustionHigh]: `${name} war exhaustion high`,
      [NationalEventType.WarExhaustionRecovered]: `${name} war exhaustion eased`,
      [NationalEventType.ProductionDisrupted]: `${name} production disrupted`,
      [NationalEventType.ProductionRecovered]: `${name} production recovered`,
      [NationalEventType.OverextensionHigh]: `${name} overextended`,
      [NationalEventType.OverextensionRecovered]: `${name} overextension eased`,
      [NationalEventType.StrategicLocationThreatened]: `${name} strategic location threatened`,
      [NationalEventType.StrategicLocationCaptured]: `${name} strategic location captured`,
      [NationalEventType.StrategicLocationSecured]: `${name} strategic location secured`,
    };
    const locationLabels: Partial<Record<StrategicLocationType, string>> = {
      [StrategicLocationType.MajorCity]: "major city",
      [StrategicLocationType.Port]: "port",
      [StrategicLocationType.IndustrialRegion]: "industrial region",
      [StrategicLocationType.LogisticsHub]: "logistics hub",
      [StrategicLocationType.Chokepoint]: "chokepoint",
      [StrategicLocationType.Crossing]: "crossing",
      [StrategicLocationType.StrategicIsland]: "strategic island",
    };
    const locationLabel = update.locationType
      ? locationLabels[update.locationType]
      : undefined;
    const baseDescription = locationLabel
      ? `${name} ${locationLabel} ${
          update.event === NationalEventType.StrategicLocationThreatened
            ? "threatened"
            : update.event === NationalEventType.StrategicLocationCaptured
              ? "captured"
              : "secured"
        }`
      : descriptions[update.event];
    let relatedName: string | undefined;
    if (
      update.relatedNationID !== undefined &&
      update.relatedNationID !== update.nationID
    ) {
      try {
        relatedName = this.game.player(update.relatedNationID).displayName();
      } catch {
        // The related player may have been removed on the same tick.
      }
    }
    const description = relatedName
      ? `${baseDescription} by ${relatedName}`
      : baseDescription;
    this.addEvent({
      description,
      createdAt: this.game.ticks(),
      highlight: true,
      type: MessageType.CONQUERED_PLAYER,
      category: "conquest",
      tone: this.nationalEventTone(update.event),
      focusID: nation.smallID(),
      playerSpecific:
        update.nationID === myPlayer.id() ||
        update.relatedNationID === myPlayer.id(),
    });
  }

  private nationalEventTone(event: NationalEventType): EventTone {
    if (
      event === NationalEventType.CapitalThreatened ||
      event === NationalEventType.CapitalEncircled ||
      event === NationalEventType.StrategicLocationThreatened ||
      event === NationalEventType.LiberationAttempted
    ) {
      return "warning";
    }
    if (
      event === NationalEventType.CapitalCaptured ||
      event === NationalEventType.NationOccupied ||
      event === NationalEventType.NationEliminated ||
      event === NationalEventType.GovernmentDisplaced
    ) {
      return "critical";
    }
    if (
      event === NationalEventType.CapitalSecured ||
      event === NationalEventType.NationLiberated ||
      event === NationalEventType.StrategicLocationSecured ||
      event === NationalEventType.MajorRegionSecured
    ) {
      return "positive";
    }
    return "neutral";
  }

  private onFrontEvent(update: FrontEventUpdate) {
    if (!this.isFrontRelevant(update)) return;
    if (
      update.event === FrontEventType.MomentumChanged &&
      !ACTIONABLE_FRONT_MOMENTA.has(update.momentum)
    ) {
      return;
    }

    let description: string;
    if (update.event === FrontEventType.Opened) {
      description = `${update.name} opened`;
    } else if (update.event === FrontEventType.Ended) {
      description = `${update.name} ended`;
    } else {
      const previous = update.previousMomentum
        ? ` from ${update.previousMomentum}`
        : "";
      description = `${update.name} momentum ${previous} -> ${update.momentum}`;
    }

    let focusID: number | undefined;
    const myPlayer = this.game.myPlayer();
    try {
      focusID = this.game.player(update.defenderID).smallID();
    } catch {
      // A front can end on the same tick its defender is removed.
    }
    this.addEvent({
      description,
      createdAt: this.game.ticks(),
      highlight: update.event !== FrontEventType.Ended,
      type: MessageType.ATTACK_REQUEST,
      category: "front",
      tone:
        update.momentum === FrontMomentum.Collapsing ||
        update.momentum === FrontMomentum.Overextended
          ? "warning"
          : update.momentum === FrontMomentum.Advancing ||
              update.momentum === FrontMomentum.Breakthrough ||
              update.momentum === FrontMomentum.Reinforced
            ? "positive"
            : "neutral",
      focusID,
      playerSpecific:
        myPlayer !== null &&
        (update.attackerID === myPlayer.id() ||
          update.defenderID === myPlayer.id()),
    });
  }

  private onFactionEvent(update: FactionEventUpdate) {
    const myPlayer = this.game.myPlayer();
    // Coalition churn is not a player-facing alert. Keep only actionable
    // objectives for the player's own faction.
    if (
      !myPlayer ||
      !update.members.includes(myPlayer.id()) ||
      (update.event !== FactionEventType.VictoryReady &&
        update.event !== FactionEventType.ObjectiveSecured)
    ) {
      return;
    }

    const target = update.objectiveLocationType
      ? ` -> ${update.objectiveLocationType.replace(/_/g, " ")}`
      : "";
    const description =
      update.event === FactionEventType.VictoryReady
        ? `${update.label} victory objective ready${target}`
        : `${update.label} objective secured${target}`;
    this.addEvent({
      description,
      createdAt: this.game.ticks(),
      highlight: true,
      type: MessageType.CONQUERED_PLAYER,
      category: "faction",
      tone: "positive",
      playerSpecific: true,
    });
  }

  onDisplayMessageEvent(event: DisplayMessageUpdate) {
    const myPlayer = this.game.myPlayer();
    if (
      event.playerID !== null &&
      (!myPlayer || myPlayer.smallID() !== event.playerID)
    ) {
      return;
    }

    // Captured trade-ship gold is surfaced as a transient +gold pip in
    // control-panel rather than as a scroll-list entry.
    if (event.message === "events_display.received_gold_from_captured_ship") {
      return;
    }

    let description: string = event.message;
    if (event.message.startsWith("events_display.")) {
      description = translateText(event.message, event.params ?? {});
    }

    const unitView =
      event.unitID !== undefined ? this.game.unit(event.unitID) : undefined;
    this.addEvent({
      description: description,
      createdAt: this.game.ticks(),
      highlight: true,
      type: event.messageType,
      unsafeDescription: true,
      unitView: unitView,
      focusID: event.focusPlayerID,
      playerSpecific:
        event.playerID !== null || event.focusPlayerID === myPlayer?.smallID(),
    });
  }

  onDisplayChatEvent(event: DisplayChatMessageUpdate) {
    const myPlayer = this.game.myPlayer();
    if (
      event.playerID === null ||
      !myPlayer ||
      myPlayer.smallID() !== event.playerID
    ) {
      return;
    }

    const baseMessage = translateText(`chat.${event.category}.${event.key}`);
    let translatedMessage = baseMessage;
    if (event.target) {
      try {
        const targetPlayer = this.game.player(event.target);
        const targetName = targetPlayer?.displayName() ?? event.target;
        translatedMessage = baseMessage.replace("[P1]", targetName);
      } catch (e) {
        console.warn(
          `Failed to resolve player for target ID '${event.target}'`,
          e,
        );
        return;
      }
    }

    let otherPlayerDiplayName: string = "";
    if (event.recipient !== null) {
      //'recipient' parameter contains sender ID or recipient ID
      const player = this.game.player(event.recipient);
      otherPlayerDiplayName = player ? player.displayName() : "";
    }

    this.addEvent({
      description: translateText(event.isFrom ? "chat.from" : "chat.to", {
        user: otherPlayerDiplayName,
        msg: translatedMessage,
      }),
      createdAt: this.game.ticks(),
      highlight: true,
      type: MessageType.CHAT,
      unsafeDescription: false,
      playerSpecific: true,
    });
    this.eventBus.emit(new PlaySoundEffectEvent("message"));
  }

  onAllianceRequestReplyEvent(update: AllianceRequestReplyUpdate) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer || update.request.requestorID !== myPlayer.smallID()) {
      return;
    }

    const recipient = this.game.playerBySmallID(
      update.request.recipientID,
    ) as PlayerView;
    this.addEvent({
      description: translateText("events_display.alliance_request_status", {
        name: recipient.displayName(),
        status: update.accepted
          ? translateText("events_display.alliance_accepted")
          : translateText("events_display.alliance_rejected"),
      }),
      type: update.accepted
        ? MessageType.ALLIANCE_ACCEPTED
        : MessageType.ALLIANCE_REJECTED,
      highlight: true,
      createdAt: this.game.ticks(),
      focusID: update.request.recipientID,
      playerSpecific: true,
    });
  }

  onBrokeAllianceEvent(update: BrokeAllianceUpdate) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return;

    const betrayed = this.game.playerBySmallID(update.betrayedID) as PlayerView;
    const traitor = this.game.playerBySmallID(update.traitorID) as PlayerView;

    if (betrayed.isDisconnected()) return; // Do not send the message if betraying a disconnected player

    if (!betrayed.isTraitor() && traitor === myPlayer) {
      this.eventBus.emit(new PlaySoundEffectEvent("alliance-broken"));
      const malusPercent = Math.round(
        (1 - this.game.config().traitorDefenseDebuff()) * 100,
      );

      const traitorDuration = Math.floor(
        this.game.config().traitorDuration() * 0.1,
      );
      const durationText =
        traitorDuration === 1
          ? translateText("events_display.duration_second")
          : translateText("events_display.duration_seconds_plural", {
              seconds: traitorDuration,
            });

      this.addEvent({
        description: translateText("events_display.betrayal_description", {
          name: betrayed.displayName(),
          malusPercent: malusPercent,
          durationText: durationText,
        }),
        type: MessageType.ALLIANCE_BROKEN,
        highlight: true,
        createdAt: this.game.ticks(),
        focusID: update.betrayedID,
        playerSpecific: true,
      });
    } else if (betrayed === myPlayer) {
      this.eventBus.emit(new PlaySoundEffectEvent("alliance-broken"));
      this.addEvent({
        description: translateText("events_display.betrayed_you", {
          name: traitor.displayName(),
        }),
        type: MessageType.ALLIANCE_BROKEN,
        highlight: true,
        createdAt: this.game.ticks(),
        focusID: update.traitorID,
        playerSpecific: true,
      });
    }
  }

  onAllianceExpiredEvent(update: AllianceExpiredUpdate) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return;

    const otherID =
      update.player1ID === myPlayer.smallID()
        ? update.player2ID
        : update.player2ID === myPlayer.smallID()
          ? update.player1ID
          : null;
    if (otherID === null) return;
    const other = this.game.playerBySmallID(otherID) as PlayerView;
    if (!other || !myPlayer.isAlive() || !other.isAlive()) return;

    this.addEvent({
      description: translateText("events_display.alliance_expired", {
        name: other.displayName(),
      }),
      type: MessageType.ALLIANCE_EXPIRED,
      highlight: true,
      createdAt: this.game.ticks(),
      focusID: otherID,
      playerSpecific: true,
    });
  }

  onDonateEvent(update: DonateEventUpdate) {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return;

    const isRecipient = update.recipientId === myPlayer.id();
    const isSender = update.senderId === myPlayer.id();
    if (!isRecipient && !isSender) return;

    const other = isRecipient
      ? (this.game.player(update.senderId) as PlayerView)
      : (this.game.player(update.recipientId) as PlayerView);

    const isGold = update.donationType === "gold";
    const messageKey = isRecipient
      ? isGold
        ? "events_display.received_gold_from_player"
        : "events_display.received_troops_from_player"
      : isGold
        ? "events_display.sent_gold_to_player"
        : "events_display.sent_troops_to_player";
    const params: Record<string, string | number> = {
      name: other.displayName(),
      [isGold ? "gold" : "troops"]: isGold
        ? renderNumber(update.amount)
        : renderTroops(Number(update.amount)),
    };

    this.addEvent({
      description: translateText(messageKey, params),
      type: isRecipient
        ? MessageType.DONATION_RECEIVED
        : MessageType.DONATION_SENT,
      highlight: true,
      createdAt: this.game.ticks(),
      focusID: other.smallID(),
      playerSpecific: true,
    });
  }

  onTargetPlayerEvent(event: TargetPlayerUpdate) {
    const other = this.game.playerBySmallID(event.playerID) as PlayerView;
    const myPlayer = this.game.myPlayer() as PlayerView;
    if (!myPlayer || !myPlayer.isFriendly(other)) return;

    const target = this.game.playerBySmallID(event.targetID) as PlayerView;

    this.addEvent({
      description: translateText("events_display.attack_request", {
        name: other.displayName(),
        target: target.displayName(),
      }),
      type: MessageType.ATTACK_REQUEST,
      highlight: true,
      createdAt: this.game.ticks(),
      focusID: event.targetID,
      playerSpecific: true,
    });
  }

  emitGoToPlayerEvent(attackerID: number) {
    const attacker = this.game.playerBySmallID(attackerID) as PlayerView;
    if (!attacker) return;
    this.eventBus.emit(new GoToPlayerEvent(attacker));
  }

  emitGoToUnitEvent(unit: UnitView) {
    this.eventBus.emit(new GoToUnitEvent(unit));
  }

  onEmojiMessageEvent(update: EmojiUpdate) {
    // Honor the "Disable emojis" setting: don't surface received emojis in the
    // events feed either (#4430).
    if (!this.userSettings.emojis()) return;
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) return;

    const recipient =
      update.emoji.recipientID === AllPlayers
        ? AllPlayers
        : this.game.playerBySmallID(update.emoji.recipientID);
    const sender = this.game.playerBySmallID(
      update.emoji.senderID,
    ) as PlayerView;

    if (recipient === myPlayer) {
      this.addEvent({
        description: `${sender.displayName()}: ${update.emoji.message}`,
        unsafeDescription: true,
        type: MessageType.CHAT,
        highlight: true,
        createdAt: this.game.ticks(),
        focusID: update.emoji.senderID,
        playerSpecific: true,
      });
    } else if (sender === myPlayer && recipient !== AllPlayers) {
      this.addEvent({
        description: translateText("events_display.sent_emoji", {
          name: (recipient as PlayerView).displayName(),
          emoji: update.emoji.message,
        }),
        unsafeDescription: true,
        type: MessageType.CHAT,
        highlight: true,
        createdAt: this.game.ticks(),
        focusID: recipient.smallID(),
        playerSpecific: true,
      });
    }
  }

  onUnitIncomingEvent(event: UnitIncomingUpdate) {
    const myPlayer = this.game.myPlayer();

    if (
      !myPlayer ||
      myPlayer.smallID() !== event.playerID ||
      !INCOMING_THREAT_TYPES.has(event.messageType)
    ) {
      return;
    }

    const unitView = this.game.unit(event.unitID);
    const isNaval =
      event.messageType === MessageType.NAVAL_INVASION_INBOUND ||
      event.messageType === MessageType.NAVAL_CONVOY_INBOUND;
    const isCruise = event.messageType === MessageType.CRUISE_MISSILE_INBOUND;
    const isMirv = event.messageType === MessageType.MIRV_INBOUND;
    const prefix =
      event.messageType === MessageType.NAVAL_CONVOY_INBOUND
        ? "Supply convoy inbound"
        : isNaval
          ? "Naval fleet inbound"
          : isCruise
            ? "Cruise missile inbound"
            : isMirv
              ? "MIRV inbound"
              : "Missile inbound";

    this.addEvent({
      description: `${prefix} — ${event.message}`,
      type: event.messageType,
      unsafeDescription: false,
      highlight: true,
      createdAt: this.game.ticks(),
      unitView: unitView,
      playerSpecific: true,
    });
  }

  private getEventDescription(
    event: GameEvent,
  ): string | DirectiveResult<typeof UnsafeHTMLDirective> {
    return event.unsafeDescription
      ? unsafeHTML(onlyImages(event.description))
      : event.description;
  }

  private renderBetrayalDebuffTimer() {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer || !myPlayer.isTraitor()) {
      return html``;
    }

    const remainingTicks = myPlayer.getTraitorRemainingTicks();
    const remainingSeconds = Math.ceil(remainingTicks / 10);

    if (remainingSeconds <= 0) {
      return html``;
    }

    return html`
      ${this.renderButton({
        content: html`${translateText("events_display.betrayal_debuff_ends", {
          time: remainingSeconds,
        })}`,
        className: "text-left text-yellow-400",
        translate: false,
      })}
    `;
  }

  private renderEventRow(event: GameEvent) {
    const category = event.category ?? "logistics";
    const tone = event.tone ?? "neutral";
    return html`
      <tr>
        <td
          class="lg:px-2 lg:py-1 p-1 text-left border-l-4 ${EVENT_TONE_CLASSES[
            tone
          ]} ${getMessageTypeClasses(event.type)}"
        >
          <div class="flex items-start gap-2">
            <span
              class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold"
              aria-hidden="true"
              >${EVENT_CATEGORY_ICONS[category]}</span
            >
            <div class="min-w-0">
              <div
                class="text-[9px] font-semibold tracking-[0.14em] opacity-70"
              >
                ${EVENT_CATEGORY_LABELS[category]}
              </div>
              ${event.focusID
                ? this.renderButton({
                    content: this.getEventDescription(event),
                    onClick: () => {
                      if (event.focusID)
                        this.emitGoToPlayerEvent(event.focusID);
                    },
                    className: "text-left",
                  })
                : event.unitView
                  ? this.renderButton({
                      content: this.getEventDescription(event),
                      onClick: () => {
                        if (event.unitView)
                          this.emitGoToUnitEvent(event.unitView);
                      },
                      className: "text-left",
                    })
                  : this.getEventDescription(event)}
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  render() {
    if (!this.active || !this._isVisible) {
      return html``;
    }

    const myPlayer = this.game.myPlayer();
    const showBetrayalTimer = !!(
      myPlayer &&
      myPlayer.isTraitor() &&
      myPlayer.getTraitorRemainingTicks() > 0
    );

    const tier1Events: GameEvent[] = [];
    let tier2Events: GameEvent[] = [];
    for (const event of this.events) {
      if (!this.eventMatchesFilter(event)) continue;
      (isTier1(event.type) ? tier1Events : tier2Events).push(event);
    }
    tier1Events.sort((a, b) => a.createdAt - b.createdAt);
    tier2Events.sort((a, b) => a.createdAt - b.createdAt);
    tier2Events = tier2Events.slice(-4);

    const visibleEventCount = tier1Events.length + tier2Events.length;

    return html`
      <div class="flex flex-col gap-1 w-full min-[1200px]:w-96">
        <div
          class="flex items-center justify-between gap-2 rounded-md bg-gray-900/90 p-1 text-[10px] uppercase tracking-wide pointer-events-auto"
        >
          <span class="px-2 text-slate-300"
            >EVENT LOG (${visibleEventCount})</span
          >
          <button
            class="rounded px-2 py-1 text-slate-300 hover:bg-white/10 hover:text-white"
            @click=${() => {
              this._isExpanded = !this._isExpanded;
            }}
            aria-expanded=${this._isExpanded}
          >
            ${this._isExpanded ? "Hide" : "Show"}
          </button>
        </div>
        ${this._isExpanded
          ? html`
              <div
                class="flex items-center gap-1 rounded-md bg-gray-900/85 p-1 text-[10px] uppercase tracking-wide pointer-events-auto"
              >
                ${(
                  [
                    "all",
                    "player",
                    "war",
                    "nation",
                    "diplomacy",
                    "threats",
                  ] as EventFilter[]
                ).map(
                  (filter) =>
                    html`<button
                      class="rounded px-2 py-1 transition-colors ${this
                        ._eventFilter === filter
                        ? "bg-white/15 text-white"
                        : "text-slate-400 hover:bg-white/10 hover:text-slate-200"}"
                      @click=${() => {
                        this._eventFilter = filter;
                      }}
                      aria-pressed=${this._eventFilter === filter}
                    >
                      ${EVENT_FILTER_LABELS[filter]}
                    </button>`,
                )}
              </div>
            `
          : ""}
        ${this._isExpanded && tier2Events.length > 0
          ? html`
              <div
                class="bg-gray-800/92 backdrop-blur-sm max-h-[12vh] lg:max-h-[22vh] overflow-y-auto rounded-lg opacity-90 events-container"
              >
                <table
                  class="w-full border-collapse text-white text-xs lg:text-sm pointer-events-auto"
                >
                  <tbody>
                    ${tier2Events.map((event) => this.renderEventRow(event))}
                  </tbody>
                </table>
              </div>
            `
          : ""}
        ${this._isExpanded && (tier1Events.length > 0 || showBetrayalTimer)
          ? html`
              <div
                class="bg-gray-800 backdrop-blur-sm max-h-[30vh] lg:max-h-[40vh] overflow-y-auto rounded-lg shadow-lg border-l-4 border-red-500 important-events-container"
              >
                <table
                  class="w-full border-collapse text-white text-base lg:text-lg font-medium pointer-events-auto"
                >
                  <tbody>
                    ${tier1Events.map((event) => this.renderEventRow(event))}
                    ${showBetrayalTimer
                      ? html`
                          <tr>
                            <td class="lg:px-2 lg:py-1 p-1 text-left">
                              ${this.renderBetrayalDebuffTimer()}
                            </td>
                          </tr>
                        `
                      : ""}
                  </tbody>
                </table>
              </div>
            `
          : ""}
        ${this._isExpanded && visibleEventCount === 0 && !showBetrayalTimer
          ? html`<div
              class="rounded-md bg-gray-900/80 px-3 py-2 text-xs text-slate-400 pointer-events-auto"
            >
              No recent events
            </div>`
          : ""}
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
