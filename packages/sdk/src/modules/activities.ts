import { HttpClient } from '../http/client.js';
import { toQueryString } from '../utils/query.js';

/**
 * ActivitiesModule handles SDK operations for retrieving audit activities.
 */
export class ActivitiesModule {
  constructor(private client: HttpClient) {}

  /**
   * Retrieves logged audit activities from the API.
   */
  public async list(filters?: Record<string, any>): Promise<any[]> {
    const queryParams = toQueryString(filters);
    return this.client.get<any[]>(`/activities${queryParams}`);
  }
}
