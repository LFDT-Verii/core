const LEASE_IN_MS = 30 * 1000;
const RETRY_IN_MS = 60 * 1000;

const providerMessageId = (response) =>
  response?.MessageId ?? response?.messageId;

const leaseJob = (db, now) =>
  db.collection('notificationJobs').findOneAndUpdate(
    {
      status: { $in: ['PENDING', 'RETRY'] },
      nextAttemptAt: { $lte: now },
      $or: [
        { leaseUntil: { $exists: false } },
        { leaseUntil: null },
        { leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        leaseUntil: new Date(now.getTime() + LEASE_IN_MS),
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );

const sendJob = async (job, { config, db, now, sendEmail }) => {
  const attemptedAt = new Date(now());
  try {
    const response = await sendEmail({
      subject: job.subject,
      message: job.message,
      sender: config.senderEmail,
      recipients: [job.recipient],
      replyTo: config.supportEmail,
    });
    await db.collection('notificationJobs').updateOne(
      { jobId: job.jobId },
      {
        $set: {
          status: 'SENT',
          providerMessageId: providerMessageId(response),
          sentAt: attemptedAt,
          updatedAt: attemptedAt,
          leaseUntil: null,
        },
        $inc: { attemptCount: 1 },
      },
    );
    return true;
  } catch {
    await db.collection('notificationJobs').updateOne(
      { jobId: job.jobId },
      {
        $set: {
          status: 'RETRY',
          lastErrorCode: 'delivery_failed',
          nextAttemptAt: new Date(attemptedAt.getTime() + RETRY_IN_MS),
          updatedAt: attemptedAt,
          leaseUntil: null,
        },
        $inc: { attemptCount: 1 },
      },
    );
    return false;
  }
};

const processNextJob = async (context, totals) => {
  if (totals.processed >= 25) {
    return totals;
  }
  const job = await leaseJob(context.db, new Date(context.now()));
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
