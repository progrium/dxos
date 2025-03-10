//
// Copyright 2023 DXOS.org
//

import yaml from 'js-yaml';
import { ChildProcess, fork } from 'node:child_process';
import * as fs from 'node:fs';
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import seedrandom from 'seedrandom';

import { Event, sleep } from '@dxos/async';
import { PublicKey } from '@dxos/keys';
import { LogLevel, createFileProcessor, log } from '@dxos/log';

import { AgentEnv } from './env';
import { AgentParams, PlanResults, TestPlan } from './spec';

const AGENT_LOG_FILE = 'agent.log';
const DEBUG_PORT_START = 9229;
const SUMMARY_FILENAME = 'test.json';

export type PlanOptions = {
  staggerAgents?: number;
  repeatAnalysis?: string;
  randomSeed?: string;
  profile?: boolean;
  debug?: boolean;
};

type TestSummary = {
  options: PlanOptions;
  spec: any;
  stats: any;
  results: PlanResults;
  params: {
    testId: string;
    outDir: string;
  };
  agents: Record<string, any>;
};

export type RunPlanParams<S, C> = {
  plan: TestPlan<S, C>;
  spec: S;
  options: PlanOptions;
};

export const runAgentForPlan = async <S, C>(planName: string, agentParamsJSON: string, plan: TestPlan<S, C>) => {
  const params: AgentParams<S, C> = JSON.parse(agentParamsJSON);
  await runAgent(plan, params);
};

// TODO(mykola): Introduce Executor class.
export const runPlan = async <S, C>(name: string, { plan, spec, options }: RunPlanParams<S, C>) => {
  options.randomSeed && seedrandom(options.randomSeed, { global: true });
  if (options.repeatAnalysis) {
    // Analysis mode.
    const summary: TestSummary = JSON.parse(fs.readFileSync(options.repeatAnalysis, 'utf8'));
    await plan.finish(
      { spec: summary.spec, outDir: summary.params?.outDir, testId: summary.params?.testId },
      summary.results,
    );
    return;
  }
  // Planner mode.
  await runPlanner(name, { plan, spec, options });
};

// TODO(nf): merge with defaults
export const readYAMLSpecFile = async <S, C>(
  path: string,
  plan: TestPlan<S, C>,
  options: PlanOptions,
): Promise<() => RunPlanParams<any, any>> => {
  const yamlSpec = yaml.load(await readFile(path, 'utf8')) as S;
  return () => ({
    plan,
    spec: yamlSpec,
    options,
  });
};

const runPlanner = async <S, C>(name: string, { plan, spec, options }: RunPlanParams<S, C>) => {
  const testId = createTestPathname();
  const outDirBase = process.env.GRAVITY_OUT_BASE || process.cwd();
  const outDir = `${outDirBase}/out/results/${testId}`;
  fs.mkdirSync(outDir, { recursive: true });
  log.info('starting plan', {
    outDir,
  });

  const agentsArray = await plan.init({ spec, outDir, testId });
  const agents = Object.fromEntries(agentsArray.map((config) => [PublicKey.random().toHex(), config]));
  log.info('starting agents', {
    count: agentsArray.length,
  });

  const children: ChildProcess[] = [];
  const planResults: PlanResults = { agents: {} };
  const promises: Promise<void>[] = [];

  {
    //
    // Start agents
    //

    for (const [agentIdx, [agentId, agentConfig]] of Object.entries(agents).entries()) {
      log.debug('runPlanner starting agent', { agentIdx });
      const agentParams: AgentParams<S, C> = {
        agentIdx,
        agentId,
        spec,
        agents,
        testId,
        outDir: join(outDir, agentId),
        config: agentConfig,
      };

      if (options.staggerAgents !== undefined && options.staggerAgents > 0) {
        await sleep(options.staggerAgents);
      }

      fs.mkdirSync(agentParams.outDir, { recursive: true });

      const execArgv = process.execArgv;

      if (options.profile) {
        execArgv.push(
          '--cpu-prof', //
          '--cpu-prof-dir',
          agentParams.outDir,
          '--cpu-prof-name',
          'agent.cpuprofile',
        );
      }

      const childProcess = fork(process.argv[1], {
        execArgv: options.debug
          ? [
              '--inspect=:' + (DEBUG_PORT_START + agentIdx), //
              ...execArgv,
            ]
          : execArgv,
        env: {
          ...process.env,
          GRAVITY_AGENT_PARAMS: JSON.stringify(agentParams),
          GRAVITY_SPEC: name,
        },
      });

      children.push(childProcess);
      promises.push(
        Event.wrap<number>(childProcess, 'exit')
          .waitForCount(1)
          .then((exitCode) => {
            planResults.agents[agentId] = {
              exitCode,
              outDir: agentParams.outDir,
              logFile: join(agentParams.outDir, AGENT_LOG_FILE),
            };
          }),
      );
    }

    await Promise.all(promises);

    log.info('test complete', {
      summary: join(outDir, SUMMARY_FILENAME),
    });
  }

  let stats: any;
  try {
    stats = await plan.finish({ spec, outDir, testId }, planResults);
  } catch (err) {
    log.warn('error finishing plan', err);
  }

  const summary: TestSummary = {
    options,
    spec,
    stats,
    params: {
      testId,
      outDir,
    },
    results: planResults,
    agents,
  };

  writeFileSync(join(outDir, SUMMARY_FILENAME), JSON.stringify(summary, null, 4));
  log.info('plan complete');
  process.exit(0);
};

const runAgent = async <S, C>(plan: TestPlan<S, C>, params: AgentParams<S, C>) => {
  try {
    log.addProcessor(
      createFileProcessor({
        path: join(params.outDir, AGENT_LOG_FILE),
        levels: [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.TRACE],
      }),
    );

    const env = new AgentEnv<S, C>(params);
    await env.open();
    await plan.run(env);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    log.info('agent complete', { agentId: params.agentId });
    process.exit(0);
  }
};

const createTestPathname = () => new Date().toISOString().replace(/\W/g, '-');
