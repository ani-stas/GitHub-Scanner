import { IWebhookResponse } from "./webhook-response.interface";

export interface IFetchRepositoryDetailsResult {
  id: string;
  name: string;
  size: number;
  owner: string;
  isPrivate: boolean;
  filesAmount: number;
  activeWebhooks: IWebhookResponse[];
  yamlContent: string;
}
