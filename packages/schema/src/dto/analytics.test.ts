import { describe, it, expect } from 'vitest';
import {
  createMetricWithDenominator,
  campaignAnalyticsOverviewSchema,
  campaignTimelinePointSchema,
  campaignFunnelStageSchema,
  metricWithDenominatorSchema
} from './analytics.js';
import { EmailQualityStatus } from '../enums/index.js';

describe('Phase 11: Campaign Analytics DTOs & Invariants', () => {
  describe('createMetricWithDenominator', () => {
    it('calculates percentage accurately with explicit formula and denominator', () => {
      const metric = createMetricWithDenominator(
        23,
        412,
        '23 / 412 eligible contacts = 5.58%',
        'Unique contact reply rate among eligible enrolled contacts',
        'percent',
        'Only includes contacts whose initial email was provider-accepted'
      );

      expect(metric.value).toBeCloseTo(0.0558, 4);
      expect(metric.formatted).toBe('5.58%');
      expect(metric.numerator).toBe(23);
      expect(metric.denominator).toBe(412);
      expect(metric.formula).toBe('23 / 412 eligible contacts = 5.58%');
      expect(metric.limitations).toBe('Only includes contacts whose initial email was provider-accepted');
    });

    it('safely handles zero denominator without NaN or Infinity', () => {
      const metric = createMetricWithDenominator(
        0,
        0,
        '0 / 0 eligible contacts = 0.00%',
        'Zero enrolled contacts rate'
      );

      expect(metric.value).toBe(0);
      expect(metric.formatted).toBe('0.00%');
      expect(metric.numerator).toBe(0);
      expect(metric.denominator).toBe(0);
      expect(metric.limitations).toBeNull();
    });

    it('handles negative or invalid denominator safely', () => {
      const metric = createMetricWithDenominator(5, -10, 'formula', 'desc');
      expect(metric.value).toBe(0);
      expect(metric.denominator).toBe(0);
      expect(metric.formatted).toBe('0.00%');
    });

    it('formats count and ratio types appropriately', () => {
      const countMetric = createMetricWithDenominator(15, 30, 'formula', 'desc', 'count');
      expect(countMetric.formatted).toBe('15 / 30');

      const ratioMetric = createMetricWithDenominator(15, 30, 'formula', 'desc', 'ratio');
      expect(ratioMetric.formatted).toBe('0.50');
    });
  });

  describe('Schema Validation', () => {
    it('validates a complete CampaignAnalyticsOverview DTO', () => {
      const mockOverview = {
        campaignId: 'camp_123',
        campaignName: 'Q3 Enterprise Outreach',
        status: 'ACTIVE',
        timezone: 'America/New_York',
        timeRange: { startDate: '2026-09-01T00:00:00Z', endDate: null },
        counts: {
          contactsEnrolled: 100,
          contactsEligible: 95,
          contactsSuppressed: 5,
          emailsScheduled: 200,
          emailsQueued: 0,
          emailsAttempted: 95,
          emailsAccepted: 90,
          emailsFailed: 5,
          emailsAmbiguous: 0,
          observedOpens: 45,
          uniqueOpenedDeliveries: 40,
          uniqueOpenedContacts: 38,
          observedClicks: 12,
          uniqueClickedDeliveries: 10,
          uniqueClickedContacts: 10,
          repliesReceived: 8,
          replyingContacts: 7,
          hardBounces: 3,
          softBounces: 2,
          sequencesStoppedByReply: 7,
          sequencesCompleted: 15,
          sequencesCancelled: 0
        },
        rates: {
          contactReplyRate: createMetricWithDenominator(7, 95, '7/95', 'desc'),
          messageReplyRate: createMetricWithDenominator(8, 90, '8/90', 'desc'),
          observedOpenRate: createMetricWithDenominator(45, 90, '45/90', 'desc'),
          uniqueOpenRate: createMetricWithDenominator(40, 90, '40/90', 'desc'),
          observedClickRate: createMetricWithDenominator(12, 90, '12/90', 'desc'),
          uniqueClickRate: createMetricWithDenominator(10, 90, '10/90', 'desc'),
          clickToOpenRate: createMetricWithDenominator(10, 40, '10/40', 'desc'),
          providerAcceptanceRate: createMetricWithDenominator(90, 95, '90/95', 'desc'),
          hardBounceRate: createMetricWithDenominator(3, 95, '3/95', 'desc'),
          suppressionRate: createMetricWithDenominator(5, 100, '5/100', 'desc')
        },
        funnel: [
          {
            stage: 'enrolled',
            label: 'Contacts Enrolled',
            count: 100,
            conversionRate: 1.0,
            formattedConversionRate: '100.00%',
            dropoffCount: 0,
            dropoffRate: 0,
            denominator: 100,
            formula: '100 / 100',
            isTerminal: false
          }
        ],
        latency: {
          minHours: 1.2,
          medianHours: 4.5,
          averageHours: 8.1,
          p90Hours: 18.3,
          totalRepliesCalculated: 7,
          sampleSizeNote: 'Calculated across 7 correlated replies'
        },
        attributionConfidence: {
          directThread: 6,
          directHeader: 1,
          contactMatch: 1
        },
        computedAt: new Date().toISOString()
      };

      const parsed = campaignAnalyticsOverviewSchema.safeParse(mockOverview);
      expect(parsed.success).toBe(true);
    });
  });
});
