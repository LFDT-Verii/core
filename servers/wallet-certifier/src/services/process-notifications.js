const LEASE_IN_MS = 30 * 1000;
const RETRY_IN_MS = 60 * 1000;

const providerMessageId = (response) =>
  response?.MessageId ?? response?.messageId;

const leaseJob = (repositories, now) =>
  repositories.notificationJobs.acquireNext({
    now,
    leaseUntil: new Date(now.getTime() + LEASE_IN_MS),
  });

const sendJob = async (job, { config, repositories, now, sendEmail }) => {
  const attemptedAt = new Date(now());
  try {
    const response = await sendEmail({
      subject: job.subject,
      message: job.message,
      sender: config.senderEmail,
      recipients: [job.recipient],
      replyTo: config.supportEmail,
    });
    await repositories.notificationJobs.markSent({
      jobId: job.jobId,
      providerMessageId: providerMessageId(response),
      sentAt: attemptedAt,
      updatedAt: attemptedAt,
    });
    return true;
  } catch {
    await repositories.notificationJobs.markRetry({
      jobId: job.jobId,
      lastErrorCode: 'delivery_failed',
      nextAttemptAt: new Date(attemptedAt.getTime() + RETRY_IN_MS),
      updatedAt: attemptedAt,
    });
    return false;
  }
};

const processNextJob = async (context, totals) => {
  if (totals.processed >= 25) {
    return totals;
  }
  const job = await leaseJob(context.repositories, new Date(context.now()));
  if (!job) {
    return totals;
  }
  const delivered = await sendJob(job, context);
  return processNextJob(context, {
    processed: totals.processed + 1,
    sent: totals.sent + Number(delivered),
  });
};

const processNotificationJobs = async (context) => {
  const { processed, sent } = await processNextJob(context, {
    processed: 0,
    sent: 0,
  });
  return { processed, sent, failed: processed - sent };
};

module.exports = { processNotificationJobs };
