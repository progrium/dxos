//
// Copyright 2023 DXOS.org
//

import { ChildProcess, fork } from 'node:child_process';
import * as fs from 'node:fs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import seedrandom from 'seedrandom';

import { Event, Trigger, sleep } from '@dxos/async';
import { PublicKey } from '@dxos/keys';
import { LogLevel, createFileProcessor, invariant, log } from '@dxos/log';

import { AgentEnv } from './agent-env';
import { AgentParams, PlanResults, Platform, TestPlan } from './spec-base';
import { mkdir, readFile } from 'node:fs/promises';
import { v4 } from 'uuid';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  NodeGlobalsPolyfillPlugin,
  FixMemdownPlugin,
  FixGracefulFsPlugin,
  NodeModulesPlugin,
} from '@dxos/esbuild-plugins';
import type { BrowserType } from 'playwright';

const AGENT_LOG_FILE = 'agent.log';
const DEBUG_PORT_START = 9229;

type PlanOptions = {
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


// fixup env in browser
if (typeof (globalThis as any).dxgravity_env !== 'undefined') {
  process.env = (globalThis as any).dxgravity_env;
}

// TODO(mykola): Introduce Executor class.
export const runPlan = async <S, C>({ plan, spec, options }: RunPlanParams<S, C>) => {
  options.randomSeed && seedrandom(options.randomSeed, { global: true });
  if (options.repeatAnalysis) {
    // Analysis mode
    const summary: TestSummary = JSON.parse(fs.readFileSync(options.repeatAnalysis, 'utf8'));
    await plan.finish(
      { spec: summary.spec, outDir: summary.params?.outDir, testId: summary.params?.testId },
      summary.results,
    );
    return;
  }

  if (!process.env.GRAVITY_AGENT_PARAMS) {
    // Planner mode
    await runPlanner({ plan, spec, options });
  } else {
    // Agent mode
    const params: AgentParams<S, C> = JSON.parse(process.env.GRAVITY_AGENT_PARAMS);
    await runAgent(plan, params);
  }
};

const runPlanner = async <S, C>({ plan, spec, options }: RunPlanParams<S, C>) => {
  const testId = genTestId();
  const outDir = `${process.cwd()}/out/results/${testId}`;
  fs.mkdirSync(outDir, { recursive: true });

  log.info('starting plan', {
    outDir,
  });

  const agentsArray = await plan.init({
    spec,
    outDir,
    testId,
  });
  const agents = Object.fromEntries(agentsArray.map((config) => [PublicKey.random().toHex(), config]));

  if (Object.values(agents).some((agent) => agent.runtime?.platform !== 'nodejs' && agent.runtime?.platform !== undefined)) {
    const begin = Date.now();
    await buildBrowserBundle(join(outDir, 'browser.js'))
    log.info('browser bundle built', {
      time: Date.now() - begin,
    });
  }

  log.info('starting agents', {
    count: agentsArray.length,
  });

  const planResults: PlanResults = {
    agents: {},
  };
  const promises: Promise<void>[] = [];

  {
    //
    // Start agents
    //

    for (const [agentIdx, [agentId, agentRunOptions]] of Object.entries(agents).entries()) {
      log.debug('runPlanner starting agent', { agentIdx });
      const agentParams: AgentParams<S, C> = {
        agentIdx,
        agentId,
        spec,
        agents,
        runtime: agentRunOptions.runtime ?? {},
        testId,
        outDir: join(outDir, agentId),
        planRunDir: outDir,
        config: agentRunOptions.config,
      };
      agentParams.runtime.platform ??= 'nodejs';

      if (options.staggerAgents !== undefined && options.staggerAgents > 0) {
        await sleep(options.staggerAgents);
      }

      fs.mkdirSync(agentParams.outDir, { recursive: true });

      const promise = agentParams.runtime.platform === 'nodejs' ? runNode(agentParams, options) : runBrowser(agentParams, options);
      promises.push(
        promise
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
      summary: join(outDir, 'test.json'),
    });
  }

  let stats: any;
  try {
    stats = await await plan.finish(
      {
        spec,
        outDir,
        testId,
      },
      planResults,
    );
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
  writeFileSync(join(outDir, 'test.json'), JSON.stringify(summary, null, 4));

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

const genTestId = () => `${new Date().toISOString().slice(0, -5)}-${PublicKey.random().truncate()}`;


const runNode = <S, C>(agentParams: AgentParams<S, C>, options: PlanOptions): Promise<number> => {
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
        '--inspect=:' + (DEBUG_PORT_START + agentParams.agentIdx), //
        ...execArgv,
      ]
      : execArgv,
    env: {
      ...process.env,
      GRAVITY_AGENT_PARAMS: JSON.stringify(agentParams),
    },
  });
  return Event.wrap<number>(childProcess, 'exit').waitForCount(1)
}

const runBrowser = async <S, C>(agentParams: AgentParams<S, C>, options: PlanOptions): Promise<number> => {
  invariant(agentParams.runtime.platform);
  const { page } = await getNewBrowserContext(agentParams.runtime.platform, { headless: false });


  const doneTrigger = new Trigger<number>();

  const apis: EposedApis = {
    dxgravity_done: (code) => {
      doneTrigger.wake(code);
    },
  }
  for (const [name, fn] of Object.entries(apis)) {
    await page.exposeFunction(name, fn);
  }

  const server = await servePage({
    '/index.html': {
      contentType: 'text/html',
      data: `
      <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Browser-Mocha</title>
</head>
<body>
  <h1>TESTING TESTING.</h1>
  <script>
    window.dxgravity_env = ${JSON.stringify({
        ...process.env,
        GRAVITY_AGENT_PARAMS: JSON.stringify(agentParams),
      })}
  </script>
  <script src="index.js"></script>
</body>
</html>
`
    },
    '/index.js': {
      contentType: 'text/javascript',
      data: await readFile(join(agentParams.planRunDir, 'browser.js'), 'utf8')
    }
  });

  const port = (server.address() as AddressInfo).port;
  await page.goto(`http://localhost:${port}`);

  return doneTrigger.wait();
}

const getBrowser = (browserType: Platform): BrowserType => {
  const { chromium, firefox, webkit } = require('playwright');
  switch (browserType) {
    case 'chromium':
      return chromium;
    case 'firefox':
      return firefox;
    case 'webkit':
      return webkit;
    default:
      throw new Error(`Unsupported browser: ${browserType}`);
  }
};

const getNewBrowserContext = async (browserType: Platform, options: BrowserOptions) => {
  const userDataDir = `/tmp/browser-mocha/${v4()}`;
  await mkdir(userDataDir, { recursive: true });

  const browserRunner = getBrowser(browserType);
  const context = await browserRunner.launchPersistentContext(userDataDir, {
    headless: options.headless,
    args: [...(options.headless ? [] : ['--auto-open-devtools-for-tabs']), ...(options.browserArgs ?? [])],
  });
  const page = await context.newPage();

  return {
    browserType,
    context,
    page,
  };
};

type BrowserOptions = {
  headless: boolean;
  browserArgs?: string[];
};

type WebResource = {
  contentType: string;
  data: string;
}

const servePage = async (resources: Record<string, WebResource>, port = 5176) => {
  const server = createServer((req, res) => {
    const fileName = req.url === '/' ? '/index.html' : req.url!;
    if (!resources[fileName]) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': resources[fileName].contentType });
    res.end(resources[fileName].data);
  });

  let retries = 0;
  server.on('error', (err) => {
    if (err.message.includes('EADDRINUSE') && retries < 100) {
      retries++;
      server.close();
      server.listen(port++, () => {
        trigger();
      });
    } else {
      throw err;
    }
  });

  let trigger: () => void;
  const serverReady = new Promise<void>((resolve) => {
    trigger = resolve;
  });

  server.listen(port++, () => {
    trigger();
  });
  await serverReady;
  return server;
};

type EposedApis = {
  dxgravity_done: (code: number) => void
}

const buildBrowserBundle = async (outfile: string) => {
  const { build } = require('esbuild');
  await build({
    entryPoints: [process.argv[1]],
    write: true,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    sourcemap: 'inline',
    outfile: outfile,
    plugins: [FixGracefulFsPlugin(), FixMemdownPlugin(), NodeGlobalsPolyfillPlugin(), NodeModulesPlugin()],
  });
}