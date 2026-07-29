import type {
  CrazyGamesSDK as CrazyGamesSDKAdapter,
  CrazyGamesUser,
} from "./CrazyGamesSDKAdapter";

export type { CrazyGamesUser };

class CrazyGamesSDK {
  private adapter: CrazyGamesSDKAdapter | null = null;

  install(adapter: CrazyGamesSDKAdapter): void {
    this.adapter = adapter;
  }

  ready(): Promise<boolean> {
    return this.adapter?.ready() ?? Promise.resolve(false);
  }
  isOnCrazyGames(): boolean {
    return this.adapter?.isOnCrazyGames() ?? false;
  }
  isReady(): boolean {
    return this.adapter?.isReady() ?? false;
  }
  maybeInit(): Promise<void> {
    return this.adapter?.maybeInit() ?? Promise.resolve();
  }
  getUsername(): Promise<string | null> {
    return this.adapter?.getUsername() ?? Promise.resolve(null);
  }
  getUserToken(): Promise<string | null> {
    return this.adapter?.getUserToken() ?? Promise.resolve(null);
  }
  getUserProfile(): Promise<CrazyGamesUser | null> {
    return this.adapter?.getUserProfile() ?? Promise.resolve(null);
  }
  showAuthPrompt(): Promise<void> {
    return this.adapter?.showAuthPrompt() ?? Promise.resolve();
  }
  addAuthListener(
    listener: (user: CrazyGamesUser | null) => void,
  ): Promise<void> {
    return this.adapter?.addAuthListener(listener) ?? Promise.resolve();
  }
  isInstantMultiplayer(): Promise<boolean> {
    return this.adapter?.isInstantMultiplayer() ?? Promise.resolve(false);
  }
  gameplayStart(): Promise<void> {
    return this.adapter?.gameplayStart() ?? Promise.resolve();
  }
  gameplayStop(): Promise<void> {
    return this.adapter?.gameplayStop() ?? Promise.resolve();
  }
  happytime(): Promise<void> {
    return this.adapter?.happytime() ?? Promise.resolve();
  }
  loadingStart(): void {
    this.adapter?.loadingStart();
  }
  loadingStop(): void {
    this.adapter?.loadingStop();
  }
  showInviteButton(gameId: string): string | null {
    return this.adapter?.showInviteButton(gameId) ?? null;
  }
  hideInviteButton(): void {
    this.adapter?.hideInviteButton();
  }
  createInviteLink(gameId: string): string | null {
    return this.adapter?.createInviteLink(gameId) ?? null;
  }
  getInviteGameId(): Promise<string | null> {
    return this.adapter?.getInviteGameId() ?? Promise.resolve(null);
  }
  requestMidgameAd(): Promise<void> {
    return this.adapter?.requestMidgameAd() ?? Promise.resolve();
  }
}

export const crazyGamesSDK = new CrazyGamesSDK();

export async function loadCrazyGamesSDK(): Promise<void> {
  const { CrazyGamesSDK: Adapter } = await import("./CrazyGamesSDKAdapter");
  const adapter = new Adapter();
  crazyGamesSDK.install(adapter);
  await adapter.maybeInit();
}
