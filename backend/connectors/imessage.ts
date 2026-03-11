/**
 * iMessage connector — placeholder for future iMessage/sms channel integration.
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
 * Stub: no-op for now. Future: send/receive via iMessage bridge.
 */
export const imessageConnector = {
  name: "imessage" as const,

  async send(_recipientId: string, _body: string, _config?: ConnectorConfig): Promise<{ id: string }> {
    throw new Error("imessage connector not implemented");
  },

  async getMessages(_threadId: string, _limit?: number): Promise<ConnectorMessage[]> {
    return [];
  },
};
