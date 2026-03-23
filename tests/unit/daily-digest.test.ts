import { describe, it, expect, vi } from "vitest";
import {
  buildDigestMessage,
  collectVisitsForDigest,
  sendDailyDigestCore,
} from "../../amplify/data/daily-digest";

describe("dailyDigest", () => {
  it("collects all pages from DynamoDB scan", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({
        Items: [{ visitId: "visit-001", createdAt: "2026-03-23T00:30:00.000Z" }],
        LastEvaluatedKey: { visitId: "visit-001" },
      })
      .mockResolvedValueOnce({
        Items: [{ visitId: "visit-002", createdAt: "2026-03-23T01:30:00.000Z" }],
      });

    const items = await collectVisitsForDigest({ send }, "Visit-test");

    expect(items).toHaveLength(2);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("publishes one digest for visits created on the target JST date", async () => {
    const dynamoSend = vi.fn().mockResolvedValue({
      Items: [
        {
          visitId: "visit-001",
          cowId: "0123456789",
          createdAt: "2026-03-23T01:00:00.000Z",
          status: "COMPLETED",
          templateType: "general_soap",
          soapText: "SOAP preview text",
        },
        {
          visitId: "visit-002",
          cowId: "0001234567",
          createdAt: "2026-03-22T15:30:00.000Z",
          status: "IN_PROGRESS",
          transcriptRaw: "Follow-up transcript",
        },
        {
          visitId: "visit-outside-range",
          cowId: "9999999999",
          createdAt: "2026-03-22T10:00:00.000Z",
          status: "COMPLETED",
        },
      ],
    });
    const snsSend = vi.fn().mockResolvedValue({});

    const result = await sendDailyDigestCore(
      { send: dynamoSend },
      { send: snsSend },
      {
        tableName: "Visit-test",
        topicArn: "arn:aws:sns:us-east-1:123456789012:vetvoice-daily-digest",
        timeZone: "Asia/Tokyo",
        subjectPrefix: "[VetVoice]",
        now: new Date("2026-03-23T09:00:00.000Z"),
      }
    );

    expect(result.published).toBe(true);
    expect(result.summary.totalVisits).toBe(2);
    expect(result.summary.completedVisits).toBe(1);
    expect(result.summary.inProgressVisits).toBe(1);
    expect(snsSend).toHaveBeenCalledTimes(1);

    const publishArg = snsSend.mock.calls[0][0];
    expect(publishArg.input.Subject).toBe("[VetVoice] Daily digest for 2026-03-23");
    expect(publishArg.input.Message).toContain("visit-001");
    expect(publishArg.input.Message).toContain("visit-002");
    expect(publishArg.input.Message).not.toContain("visit-outside-range");
  });

  it("does not publish when no visits match the digest day", async () => {
    const dynamoSend = vi.fn().mockResolvedValue({
      Items: [
        {
          visitId: "visit-old",
          cowId: "0123456789",
          createdAt: "2026-03-21T10:00:00.000Z",
          status: "COMPLETED",
        },
      ],
    });
    const snsSend = vi.fn().mockResolvedValue({});

    const result = await sendDailyDigestCore(
      { send: dynamoSend },
      { send: snsSend },
      {
        tableName: "Visit-test",
        topicArn: "arn:aws:sns:us-east-1:123456789012:vetvoice-daily-digest",
        timeZone: "Asia/Tokyo",
        subjectPrefix: "[VetVoice]",
        now: new Date("2026-03-23T09:00:00.000Z"),
      }
    );

    expect(result.published).toBe(false);
    expect(result.summary.totalVisits).toBe(0);
    expect(snsSend).not.toHaveBeenCalled();
  });

  it("formats a readable digest message with visit previews", () => {
    const message = buildDigestMessage({
      digestDateJst: "2026-03-23",
      totalVisits: 1,
      completedVisits: 1,
      inProgressVisits: 0,
      visits: [
        {
          visitId: "visit-001",
          cowId: "0123456789",
          createdAt: "2026-03-23T01:00:00.000Z",
          status: "COMPLETED",
          templateType: "general_soap",
          soapText: "S: test\nO: test",
        },
      ],
    });

    expect(message).toContain("Date: 2026-03-23 (JST)");
    expect(message).toContain("Total visits: 1");
    expect(message).toContain("cowId=0123456789");
    expect(message).toContain("preview: S: test O: test");
  });
});
