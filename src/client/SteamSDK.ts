import type { SteamSDK as SteamSDKAdapter } from "./SteamSDKAdapter";

class SteamSDK {
  private adapter: SteamSDKAdapter | null = null;

  install(adapter: SteamSDKAdapter): void {
    this.adapter = adapter;
  }
  isOnSteam(): boolean {
    return this.adapter?.isOnSteam() ?? false;
  }
  getTicket(): Promise<string | null> {
    return this.adapter?.getTicket() ?? Promise.resolve(null);
  }
  getUser(): Promise<{ steamId: string; name: string } | null> {
    return this.adapter?.getUser() ?? Promise.resolve(null);
  }
}

export const steamSDK = new SteamSDK();

export async function loadSteamSDK(): Promise<void> {
  const { SteamSDK: Adapter } = await import("./SteamSDKAdapter");
  steamSDK.install(new Adapter());
}
