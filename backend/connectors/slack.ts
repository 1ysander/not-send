/**
 * Slack connector — placeholder for future Slack channel integration.
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
  channel?: string;
}

/**
 * Stub: no-op for now. Future: send/receive via Slack API.
 */
export const slackConnector = {
  name: "slack" as const,

  async send(_channelId: string, _body: string, _config?: ConnectorConfig): Promise<{ id: string }> {
    throw new Error("slack connector not implemented");
  },

  async getMessages(_channelId: string, _limit?: number): Promise<ConnectorMessage[]> {
    return [];
  },
};
