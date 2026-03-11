/**
 * Email connector — placeholder for future email channel integration.
 * Does not change existing API behavior.
 */

export interface ConnectorMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
}

export interface ConnectorConfig {
  enabled?: boolean;
}

/**
 * Stub: no-op for now. Future: send/receive via email provider.
 */
export const emailConnector = {
  name: "email" as const,

  async send(_to: string, _subject: string, _body: string, _config?: ConnectorConfig): Promise<{ id: string }> {
    throw new Error("email connector not implemented");
  },

  async getMessages(_threadId: string, _limit?: number): Promise<ConnectorMessage[]> {
    return [];
  },
};
