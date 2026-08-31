import { HttpClient } from '../http/client.js';
import type { HttpClientConfig } from '../http/client.js';
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
  AudiencesModule,
  CompanyDiscoveryRunsModule,
  JobsModule,
  LocksModule,
  EmailDeliveriesModule,
  IntelligenceModule,
  WorkspaceMemoryModule,
  AuditLogsModule,
  SystemLogsModule,
  GoogleConnectionsModule,
  AttachmentsModule
} from '../modules/index.js';

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
  public readonly audiences: AudiencesModule;
  public readonly companyDiscoveryRuns: CompanyDiscoveryRunsModule;
  public readonly jobs: JobsModule;
  public readonly locks: LocksModule;
  public readonly emailDeliveries: EmailDeliveriesModule;
  public readonly intelligence: IntelligenceModule;
  public readonly workspaceMemory: WorkspaceMemoryModule;
  public readonly auditLogs: AuditLogsModule;
  public readonly systemLogs: SystemLogsModule;
  public readonly googleConnections: GoogleConnectionsModule;
  public readonly attachments: AttachmentsModule;

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
    this.audiences = new AudiencesModule(this.httpClient);
    this.companyDiscoveryRuns = new CompanyDiscoveryRunsModule(this.httpClient);
    this.jobs = new JobsModule(this.httpClient);
    this.locks = new LocksModule(this.httpClient);
    this.emailDeliveries = new EmailDeliveriesModule(this.httpClient);
    this.intelligence = new IntelligenceModule(this.httpClient);
    this.workspaceMemory = new WorkspaceMemoryModule(this.httpClient);
    this.auditLogs = new AuditLogsModule(this.httpClient);
    this.systemLogs = new SystemLogsModule(this.httpClient);
    this.googleConnections = new GoogleConnectionsModule(this.httpClient);
    this.attachments = new AttachmentsModule(this.httpClient);
  }
}
