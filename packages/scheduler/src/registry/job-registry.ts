import { prisma, createLogger } from "@dacc/core";

interface MaintenanceJob {
  id: string;
  name: string;
  handler: string;
  cronExpr: string;
  config: unknown;
  status: string;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  runCount: number;
}

const log = createLogger("job-registry");

export class JobRegistry {
  async loadEnabledJobs(): Promise<MaintenanceJob[]> {
    const jobs = await prisma.maintenanceJob.findMany({
      where: { status: "ENABLED" },
      orderBy: { name: "asc" },
    });
    log.info({ count: jobs.length }, "Loaded enabled maintenance jobs");
    return jobs;
  }

  async markRunStarted(jobId: string): Promise<void> {
    await prisma.maintenanceJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", lastRunAt: new Date() },
    });
  }

  async markRunCompleted(jobId: string): Promise<void> {
    await prisma.maintenanceJob.update({
      where: { id: jobId },
      data: {
        status: "ENABLED",
        lastRunStatus: "success",
        lastRunError: null,
        runCount: { increment: 1 },
      },
    });
  }

  async markRunFailed(jobId: string, error: string): Promise<void> {
    await prisma.maintenanceJob.update({
      where: { id: jobId },
      data: {
        status: "ENABLED",
        lastRunStatus: "failure",
        lastRunError: error,
        runCount: { increment: 1 },
      },
    });
  }
}
