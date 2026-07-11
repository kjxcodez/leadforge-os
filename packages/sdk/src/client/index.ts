import { HttpClient } from '../http/client';
import type { HttpClientConfig } from '../http/client';
import {
  HealthModule,
  AuthModule,
  CompaniesModule,
  ContactsModule,
  CampaignsModule,
  OutreachModule,
  WorkspacesModule,
  DiscoveryModule,
  ActivitiesModule,
  SequencesModule,
  ExecutionsModule,
} from '../modules';

export class SdkClient {
  private httpClient: HttpClient;

  public readonly health: HealthModule;
  public readonly auth: AuthModule;
  public readonly companies: CompaniesModule;
  public readonly contacts: ContactsModule;
  public readonly campaigns: CampaignsModule;
  public readonly outreach: OutreachModule;
  public readonly workspaces: WorkspacesModule;
  public readonly discovery: DiscoveryModule;
  public readonly activities: ActivitiesModule;
  public readonly sequences: SequencesModule;
  public readonly executions: ExecutionsModule;

  constructor(config: HttpClientConfig) {
    this.httpClient = new HttpClient(config);

    this.health = new HealthModule(this.httpClient);
    this.auth = new AuthModule(this.httpClient);
    this.companies = new CompaniesModule(this.httpClient);
    this.contacts = new ContactsModule(this.httpClient);
    this.campaigns = new CampaignsModule(this.httpClient);
    this.outreach = new OutreachModule(this.httpClient);
    this.workspaces = new WorkspacesModule(this.httpClient);
    this.discovery = new DiscoveryModule(this.httpClient);
    this.activities = new ActivitiesModule(this.httpClient);
    this.sequences = new SequencesModule(this.httpClient);
    this.executions = new ExecutionsModule(this.httpClient);
  }
}
