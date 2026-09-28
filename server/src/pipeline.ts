// Scrape → Claude analysis → GitHub repo → Web Push, for one or many targets.
import type { Env, Target } from './env';
import { scrapeJob } from './scrape';
import { analyzeJob } from './claude';
import { createRepoWithReadme } from './github';
import { broadcastPush } from './webpush';

export type TargetResult = {
  targetId: number;
  status: 'analyzed' | 'unchanged' | 'failed';
  analysisId?: number;
  repoUrl?: string;
  error?: string;
};

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500);

const markTarget = (env: Env, id: number, status: TargetResult['status'], error: string | null = null) =>
  env.DB.prepare(
    `UPDATE targets SET last_checked_at = CURRENT_TIMESTAMP, last_status = ?, last_error = ? WHERE id = ?`,
  ).bind(status, error, id).run();

export const processTarget = async (env: Env, target: Target, force = false): Promise<TargetResult> => {
  let analysisId: number | undefined;
  try {
    const job = await scrapeJob(target.url);

    if (!force) {
      const seen = await env.DB.prepare(
        `SELECT id FROM analyses WHERE target_id = ? AND content_hash = ? AND status = 'completed' LIMIT 1`,
      ).bind(target.id, job.hash).first();
      if (seen) {
        await markTarget(env, target.id, 'unchanged');
        return { targetId: target.id, status: 'unchanged' };
      }
    }

    const row = await env.DB.prepare(
      `INSERT INTO analyses (target_id, url, content_hash, status, job_title)
       VALUES (?, ?, ?, 'pending', ?) RETURNING id`,
    ).bind(target.id, target.url, job.hash, target.label || job.title || null).first<{ id: number }>();
    analysisId = row!.id;

    const { results } = await env.DB.prepare('SELECT name FROM skills ORDER BY name').all<{ name: string }>();
    const plan = await analyzeJob(env, { url: target.url, pageTitle: job.title, ...job }, results.map((r) => r.name));

    await env.DB.prepare(
      `UPDATE analyses SET job_title = ?, company = ?, required_skills = ?, missing_skills = ?,
         project_name = ?, project_title = ?, project_summary = ?, readme = ? WHERE id = ?`,
    ).bind(
      plan.job_title || target.label || job.title, plan.company, JSON.stringify(plan.required_skills),
      JSON.stringify(plan.missing_skills), plan.project_name, plan.project_title, plan.project_summary,
      plan.readme_markdown, analysisId,
    ).run();

    const repo = await createRepoWithReadme(env, {
      name: plan.project_name,
      description: plan.project_summary,
      readme: plan.readme_markdown,
    });

    await env.DB.prepare(
      `UPDATE analyses SET status = 'completed', repo_full_name = ?, repo_url = ? WHERE id = ?`,
    ).bind(repo.fullName, repo.url, analysisId).run();
    await markTarget(env, target.id, 'analyzed');

    const gaps = plan.missing_skills.map((m) => m.skill).slice(0, 4).join(', ');
    await broadcastPush(env, {
      title: `New project: ${plan.project_title}`,
      body: `${plan.project_summary}${gaps ? `\nGaps: ${gaps}` : ''}`,
      url: repo.url,
      dashboardUrl: env.DASHBOARD_URL ? `${env.DASHBOARD_URL}/?analysis=${analysisId}` : undefined,
      tag: `analysis-${analysisId}`,
    });

    return { targetId: target.id, status: 'analyzed', analysisId, repoUrl: repo.url };
  } catch (err) {
    const message = errorMessage(err);
    console.error(`target ${target.id} failed:`, err);
    if (analysisId) {
      await env.DB.prepare(`UPDATE analyses SET status = 'failed', error = ? WHERE id = ?`)
        .bind(message, analysisId).run();
    }
    await markTarget(env, target.id, 'failed', message);
    return { targetId: target.id, status: 'failed', analysisId, error: message };
  }
};

/** Cron entry point: processes the least-recently-checked active targets. */
export const runAll = async (env: Env, force = false) => {
  const limit = Math.max(1, Number(env.MAX_TARGETS_PER_RUN) || 5);
  const { results } = await env.DB.prepare(
    `SELECT * FROM targets WHERE active = 1
     ORDER BY last_checked_at IS NOT NULL, last_checked_at ASC LIMIT ?`,
  ).bind(limit).all<Target>();

  // Sequential keeps us well inside Workers subrequest limits.
  const out: TargetResult[] = [];
  for (const target of results) out.push(await processTarget(env, target, force));
  return out;
};
