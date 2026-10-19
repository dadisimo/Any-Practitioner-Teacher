#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { cmd, why, callout } = require('./rewrite-tutorials-rich.js');

const tutorials = {};

tutorials['cicd-devops-sdk'] = {
  intro: 'Learn CI/CD by understanding what each Git, Docker, and Jenkins command actually does — and how to design gates that tell the truth.',
  levels: [
    {
      id: 'basics',
      title: 'Basics',
      badge: '🌱',
      minutes: 30,
      tagline: 'Git branches, Docker runs, and a pipeline mental model',
      html: `
<p>Goal: move code through <strong>build → test → package</strong> with a reproducible environment.</p>
<h4>1. Create a working branch</h4>
${cmd('git switch -c sdk-verify-fix', [
  ['git switch', 'Change branches (modern alternative to git checkout).'],
  ['-c sdk-verify-fix', 'Create a new branch with this name and switch to it.']
])}
${cmd('git status', [
  ['git status', 'Show staged/unstaged files and the current branch — always run before committing.']
])}
${cmd('git log -1 --oneline', [
  ['git log', 'Show commit history.'],
  ['-1', 'Only the latest commit.'],
  ['--oneline', 'Compact one-line format.']
])}

<h4>2. Run tests inside a container</h4>
${cmd('docker run --rm -it -v "$PWD":/workspace -w /workspace sdk-verify:1.2 bash', [
  ['docker run', 'Create and start a container from an image.'],
  ['--rm', 'Delete the container when it exits (keeps labs clean).'],
  ['-it', 'Interactive terminal (stdin + TTY) so you get a shell.'],
  ['-v "$PWD":/workspace', 'Bind-mount your current directory into /workspace in the container.'],
  ['-w /workspace', 'Set working directory inside the container.'],
  ['sdk-verify:1.2', 'Image name:tag — pin tags (or digests) for reproducibility.'],
  ['bash', 'Command to run inside the container.']
])}
${why('Why Docker for verification',
  'The same pytest that passes on your laptop can fail on a Jenkins agent with a different driver/Python. Containers freeze the userspace toolchain. (Kernel/driver on the host may still differ — that is a separate pin.)')}

<h4>3. Minimal Dockerfile you can explain</h4>
<pre>FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \\
 && apt-get install -y python3 python3-pip \\
 && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace</pre>
<ul>
<li><code>FROM</code> — base image (start from a known OS).</li>
<li><code>ENV DEBIAN_FRONTEND=noninteractive</code> — stop apt from prompting in CI.</li>
<li><code>RUN apt-get ...</code> — install tools at build time; clean lists to shrink layers.</li>
<li><code>WORKDIR</code> — default directory for later <code>RUN</code>/<code>CMD</code>.</li>
</ul>
${cmd('docker build -t sdk-verify:1.2 .', [
  ['docker build', 'Build an image from a Dockerfile.'],
  ['-t sdk-verify:1.2', 'Tag the resulting image.'],
  ['.', 'Build context = current directory (sends files to Docker daemon).']
])}
`
    },
    {
      id: 'advanced',
      title: 'Advanced',
      badge: '🚀',
      minutes: 35,
      tagline: 'Jenkins agents, Gerrit Change-Ids, flake policy',
      html: `
<h4>1. Declarative Jenkins pipeline (what each block means)</h4>
<pre>pipeline {
  agent any
  stages {
    stage('Verify') {
      steps {
        sh 'pytest -q'
      }
    }
  }
}</pre>
<ul>
<li><code>pipeline { }</code> — Declarative pipeline root.</li>
<li><code>agent any</code> — Run on any available executor (replace with <code>label 'nic-lab'</code> for hardware).</li>
<li><code>stages / stage</code> — Named phases shown in the UI.</li>
<li><code>steps { sh '...' }</code> — Shell commands on the agent.</li>
<li><code>pytest -q</code> — Quiet pytest; still fails the step on assertion errors.</li>
</ul>
${why('Agent labels',
  'Labels route jobs to machines with the right NICs/GPUs. Without them, hardware tests randomly land on empty VMs and “flake”.')}

<h4>2. Gerrit Change-Id</h4>
<p>A <strong>Change-Id</strong> footer in the commit message ties patch sets of one logical review together as you amend. Interviewers expect you to know reviews iterate without new unrelated changes.</p>

<h4>3. Flakes: the management-quality rule</h4>
<ul>
<li>Do <strong>not</strong> infinite-retry until green — that hides product risk.</li>
<li>Quarantine with an owner + deadline, keep a minimal honest gate.</li>
<li>Track flake rate as an SLO.</li>
</ul>
${callout('pitfall', 'Anti-pattern', '<p>Marking the entire pipeline optional because it is red. That trains the org to ignore quality.</p>')}
`
    },
    {
      id: 'expert',
      title: 'Expert',
      badge: '🏆',
      minutes: 30,
      tagline: 'Promotion matrices across firmware, driver, and SDK',
      html: `
<p>In HW/SW companies, compatibility is a release artifact.</p>
<pre>SDK nightly consumes:
  driver_version >= promoted_min
  fw_bundle = promoted/latest-stable
Fail closed if fingerprint mismatches.</pre>
<ul>
<li>Promote FW+driver pairs that passed joint smoke.</li>
<li>SDK signs off only against promoted pairs.</li>
<li>Publish environment fingerprints in every CI artifact.</li>
</ul>
${cmd('sha256sum dist/sdk.tar.gz > dist/sdk.tar.gz.sha256', [
  ['sha256sum', 'Compute a cryptographic hash of the artifact.'],
  ['> file.sha256', 'Save the fingerprint for later verify/reproducibility.']
])}
${callout('interview', 'Manager/tech hybrid', `
<p>“Merge-blocking smoke on golden agents; nightlies expand coverage; promotion contracts stop silent mix-and-match of FW/driver/SDK.”</p>`)}
`
    }
  ],
  resources: [
    { title: 'Docker Get Started', url: 'https://docs.docker.com/get-started/', source: 'Docker', note: 'Official free intro to images, containers, volumes.' },
    { title: 'Jenkins Pipeline book', url: 'https://www.jenkins.io/doc/book/pipeline/', source: 'Jenkins', note: 'Declarative syntax and agents.' },
    { title: 'Pro Git book', url: 'https://git-scm.com/book/en/v2', source: 'git-scm', note: 'Free classic for branching and collaboration.' },
    { title: 'Gerrit docs', url: 'https://gerrit-review.googlesource.com/Documentation/', source: 'Gerrit', note: 'Change-Ids and submit requirements.' },
    { title: 'GitHub Skills', url: 'https://skills.github.com/', source: 'GitHub', note: 'Free hands-on Git/Actions courses.' }
  ]
};

tutorials['sdk-verification-automation'] = {
  intro: 'Learn how strong verification teams think: oracles, harnesses, pytest mechanics, and metrics that measure trust — not vanity.',
  levels: [
    {
      id: 'basics',
      title: 'Basics',
      badge: '🌱',
      minutes: 30,
      tagline: 'Verification vs validation, smoke gates, first pytest',
      html: `
<ul>
<li><strong>Verification:</strong> Did we build the product <em>right</em> (matches spec/design)?</li>
<li><strong>Validation:</strong> Did we build the <em>right</em> product (matches user need)?</li>
</ul>
${why('Why managers care',
  'You can be 100% verified against a wrong spec. Validation catches “built the wrong thing.”')}

<h4>Your first pytest</h4>
${cmd('pytest -q test_add.py', [
  ['pytest', 'Test runner that discovers test_* functions/files.'],
  ['-q', 'Quiet summary output.'],
  ['test_add.py', 'File containing tests.']
])}
<pre>from sdkmath import add

def test_add():
    assert add(2, 3) == 5</pre>
<ul>
<li><code>def test_...</code> — discovery naming convention.</li>
<li><code>assert</code> — pytest rewrites asserts to show diffs on failure.</li>
</ul>
${callout('tip', 'First 30 days as verification lead', `
<ol>
<li>Define a tiny merge-blocking smoke with owners</li>
<li>Measure flake % and runtime</li>
<li>Map ownership before rewriting thousands of tests</li>
</ol>`)}
`
    },
    {
      id: 'advanced',
      title: 'Advanced',
      badge: '🚀',
      minutes: 35,
      tagline: 'Oracles, fixtures, retries, HW isolation',
      html: `
<h4>Oracles (how you know a test is meaningful)</h4>
<ul>
<li><strong>Value oracle:</strong> output equals golden/expected.</li>
<li><strong>Liveness oracle:</strong> progress/heartbeat within timeout (catches hangs).</li>
<li><strong>Safety oracle:</strong> never observe duplicate commits / torn messages.</li>
<li><strong>Metamorphic:</strong> transform input in a way that should preserve result.</li>
</ul>

<h4>pytest fixture with cleanup</h4>
<pre>import pytest
from sdk import SdkClient

@pytest.fixture
def client():
    c = SdkClient()
    yield c
    c.close()</pre>
<ul>
<li><code>@pytest.fixture</code> — reusable setup object injected into tests by name.</li>
<li><code>yield</code> — pause here while the test runs; code after yield is teardown.</li>
<li><code>c.close()</code> — always release HW/sessions even if the test failed.</li>
</ul>

<h4>Retries with a limit</h4>
<pre>def retry(fn, attempts=3):
    last = None
    for _ in range(attempts):
        try:
            return fn()
        except Exception as e:
            last = e
    raise last</pre>
${callout('pitfall', 'Coverage theater', '<p>Line coverage without strong oracles can be 100% and still miss hangs, races, and compatibility breaks.</p>')}
${why('Shared lab devices',
  'Never write concurrent jobs to the same mutable device without a lease/lock. That is how you manufacture heisenbugs.')}
`
    },
    {
      id: 'expert',
      title: 'Expert',
      badge: '🏆',
      minutes: 30,
      tagline: 'Compatibility contracts, severity, dashboards',
      html: `
<ul>
<li>Keep v1 clients in CI against v2 SDK (contract/schema + behavioral suite).</li>
<li>Silent data corruption ⇒ high/critical even if rare.</li>
<li>Scale metrics: wall-clock, flake %, parallel efficiency, MTTR, % tests with owners.</li>
</ul>
${callout('interview', 'Pushback line', `
<p>“Coverage is necessary but not sufficient — here is the risk-based scenario set that protects customers.”</p>`)}
`
    }
  ],
  resources: [
    { title: 'pytest documentation', url: 'https://docs.pytest.org/', source: 'pytest', note: 'Fixtures, parametrization, plugins.' },
    { title: 'Google Testing Blog', url: 'https://testing.googleblog.com/', source: 'Google', note: 'Flakes, testability, engineering culture.' },
    { title: 'Practical Test Pyramid', url: 'https://martinfowler.com/articles/practical-test-pyramid.html', source: 'Martin Fowler', note: 'Where tests should live.' },
    { title: 'Ministry of Testing articles', url: 'https://www.ministryoftesting.com/articles', source: 'MoT', note: 'Practitioner testing content.' },
    { title: 'OWASP Testing Guide', url: 'https://owasp.org/www-project-web-security-testing-guide/', source: 'OWASP', note: 'Negative/adversarial testing mindset.' }
  ]
};

tutorials['concurrency-distributed-testing'] = {
  intro: 'Learn concurrency and multi-node failure modes with clear definitions, then practice the tools and oracles used to catch them.',
  levels: [
    {
      id: 'basics',
      title: 'Basics',
      badge: '🌱',
      minutes: 30,
      tagline: 'Races, locks, deadlocks — with working snippets',
      html: `
<p><strong>Data race:</strong> two threads access the same memory, at least one write, no happens-before (lock/atomic/join). In C++ this is undefined behavior.</p>
<pre>import threading
counter = 0
lock = threading.Lock()

def worker():
    global counter
    for _ in range(100000):
        with lock:
            counter += 1</pre>
<ul>
<li><code>threading.Lock()</code> — mutual exclusion primitive.</li>
<li><code>with lock:</code> — acquire on enter, release on exit (even if exception).</li>
<li><code>counter += 1</code> — must be inside the lock; it is read-modify-write, not atomic.</li>
</ul>
${why('Deadlock',
  'Thread A holds L1 waits for L2; B holds L2 waits for L1. Prevent with a global lock order (always acquire L1 before L2).')}
`
    },
    {
      id: 'advanced',
      title: 'Advanced',
      badge: '🚀',
      minutes: 35,
      tagline: 'TSan, heisenbugs, sleep-free synchronization',
      html: `
<p><strong>Heisenbug:</strong> disappears or changes when you add prints/debugger — usually timing/race related.</p>
${cmd('g++ -fsanitize=thread -g -O1 main.cpp -o main && ./main', [
  ['-fsanitize=thread', 'Compile/link with ThreadSanitizer (TSan) to detect data races at runtime.'],
  ['-g', 'Debug symbols for useful stack traces.'],
  ['-O1', 'Some optimization; TSan docs recommend avoiding heavy -O3 at first.']
])}
${callout('pitfall', 'sleep(2) in tests', `
<p>Fixed sleeps are timing assumptions. Prefer waiting on a condition/event with a timeout, or poll a state oracle.</p>`)}
<p><strong>Invariant example:</strong> every enqueued item is dequeued exactly once (conservation).</p>
`
    },
    {
      id: 'expert',
      title: 'Expert',
      badge: '🏆',
      minutes: 30,
      tagline: 'Partitions, herds, p99 honesty',
      html: `
<ul>
<li>Inject disconnect/partition; assert reconnect/resubscribe within an SLO.</li>
<li>Stagger multi-node starts with jitter — synchronized herds amplify storms.</li>
<li>Report p99/p999 with pinned CPUs; averages hide tail latency.</li>
</ul>
${cmd('python -c "import time,random; time.sleep(random.uniform(0,2))"', [
  ['random.uniform(0,2)', 'Example jitter delay before starting a node role — avoid thundering herds.']
])}
${callout('interview', 'Experienced line', `
<p>“We chaos-test recovery and treat liveness as a first-class assertion.”</p>`)}
`
    }
  ],
  resources: [
    { title: 'ThreadSanitizer manual', url: 'https://github.com/google/sanitizers/wiki/ThreadSanitizerCppManual', source: 'Google Sanitizers', note: 'How to build/run TSan.' },
    { title: 'Preshing on Programming', url: 'https://preshing.com/', source: 'Preshing', note: 'Atomics/memory ordering explainers.' },
    { title: 'Python threading docs', url: 'https://docs.python.org/3/library/threading.html', source: 'Python.org', note: 'Locks/events for harnesses.' },
    { title: 'Jepsen analyses', url: 'https://jepsen.io/analyses', source: 'Jepsen', note: 'Distributed failure case studies.' },
    { title: 'Awesome Chaos Engineering', url: 'https://github.com/dastergon/awesome-chaos-engineering', source: 'Community', note: 'Curated free chaos tools/articles.' }
  ]
};

tutorials['verification-leadership'] = {
  intro: 'Practice the management craft for a hands-on SDK verification leader: decisions, coaching, alignment, and protecting signal.',
  levels: [
    {
      id: 'basics',
      title: 'Basics',
      badge: '🌱',
      minutes: 25,
      tagline: 'Tradeoffs, ownership, honest signoff',
      html: `
<p>Your job is not “more tests”. It is <strong>trusted signal</strong> for releases.</p>
<pre>Decision record:
Context: …
Options: A / B / C
Recommendation: …
Residual risk: …
Owners + revisit date: …</pre>
${why('Under schedule pressure',
  'Never fake full signoff when HW dependencies slipped. Renegotiate scoped criteria and name residual risk.')}
<ul>
<li>Healthy scale: ownership, falling flake rate, trusted merge gate</li>
<li>Unhealthy scale: raw test count with no runtime budget</li>
</ul>
`
    },
    {
      id: 'advanced',
      title: 'Advanced',
      badge: '🚀',
      minutes: 25,
      tagline: 'Coaching, onboarding, cross-team meetings',
      html: `
<h4>Coaching “clever but unreadable”</h4>
<ol>
<li>Acknowledge ingenuity</li>
<li>Set the standard: failures must be diagnosable at 2am</li>
<li>Pair on a rewrite; add review checklist items</li>
</ol>
<h4>Onboarding in week 1</h4>
<ul>
<li>Buddy + architecture tour</li>
<li>Run smoke locally/CI by day 2</li>
<li>Own one flake fix with review mentorship</li>
</ul>
${callout('tip', 'Meeting rule', '<p>No decision, no owner, no written note → theater.</p>')}
`
    },
    {
      id: 'expert',
      title: 'Expert',
      badge: '🏆',
      minutes: 25,
      tagline: 'Shift-left and metrics that matter',
      html: `
<ul>
<li>Require verification seats in design/architecture reviews</li>
<li>Metrics: runtime, flake %, escape defects, MTTR, ownership % — not vanity counts</li>
<li>Mission: honest, fast confidence the SDK works on real hardware at customer scale</li>
</ul>
${callout('interview', 'Panel story', `
<p>Prepare a STAR story: protected quality signal under schedule pressure, and what process changed afterward.</p>`)}
`
    }
  ],
  resources: [
    { title: 'Google re:Work — Managers', url: 'https://rework.withgoogle.com/guides/managers-identify-what-makes-a-great-manager/steps/learn-about-googles-manager-research/', source: 'Google re:Work', note: 'Evidence-based management practices.' },
    { title: 'LeadDev', url: 'https://leaddev.com/', source: 'LeadDev', note: 'Engineering leadership articles.' },
    { title: 'Manager Tools podcast', url: 'https://www.manager-tools.com/', source: 'Manager Tools', note: 'Practical 1:1s and feedback.' },
    { title: 'engineer-manager reading list', url: 'https://github.com/ryanburgess/engineer-manager', source: 'Community', note: 'Curated free EM resources.' },
    { title: 'ISTQB syllabi', url: 'https://istqb.org/', source: 'ISTQB', note: 'Shared V&amp;V vocabulary (free PDFs).' }
  ]
};

tutorials['python-cpp-verification'] = {
  intro: 'Become bilingual for SDK work: Python for orchestration and C++ for fidelity — with ownership-safe APIs and explained tooling.',
  levels: [
    {
      id: 'basics',
      title: 'Basics',
      badge: '🌱',
      minutes: 30,
      tagline: 'Parsing, pathlib, pytest — with every line explained',
      html: `
<pre>def parse_kv(line):
    if "=" not in line:
        raise ValueError("missing =")
    k, v = line.split("=", 1)
    return k.strip(), v.strip()</pre>
<ul>
<li><code>split("=", 1)</code> — split on the first <code>=</code> only (values may contain <code>=</code>).</li>
<li><code>strip()</code> — remove surrounding whitespace.</li>
<li><code>ValueError</code> — fail fast on bad input (better than silent wrong tuples).</li>
</ul>
${cmd('python -c "from pathlib import Path; Path(\'reports\').mkdir(parents=True, exist_ok=True)"', [
  ['Path(...).mkdir', 'Create directory.'],
  ['parents=True', 'Create intermediate dirs if needed.'],
  ['exist_ok=True', 'Do not error if it already exists (idempotent CI).']
])}
`
    },
    {
      id: 'advanced',
      title: 'Advanced',
      badge: '🚀',
      minutes: 35,
      tagline: 'RAII, unique_ptr, deleted copies',
      html: `
<p><strong>RAII:</strong> resource lifetime follows object lifetime — constructors acquire, destructors release.</p>
<pre>#include &lt;mutex&gt;
#include &lt;memory&gt;

struct DeviceHandle {
  DeviceHandle();
  ~DeviceHandle();
  DeviceHandle(const DeviceHandle&) = delete;
  DeviceHandle& operator=(const DeviceHandle&) = delete;
};</pre>
<ul>
<li><code>= delete</code> — forbid copying so you cannot double-close a handle.</li>
<li><code>std::unique_ptr&lt;T&gt;</code> — exclusive ownership, movable.</li>
<li><code>std::shared_ptr&lt;T&gt;</code> — shared ownership with refcount (use only with a clear shared lifetime).</li>
</ul>
${why('Polyglot harnesses',
  'Python orchestrates matrices and reporting; C++ stress binaries exercise production-like paths under sanitizers.')}
`
    },
    {
      id: 'expert',
      title: 'Expert',
      badge: '🏆',
      minutes: 30,
      tagline: 'Sanitizer builds and API review instincts',
      html: `
${cmd('g++ -fsanitize=address,undefined -fno-omit-frame-pointer -g -O1 main.cpp -o main', [
  ['-fsanitize=address', 'ASan: catch heap-use-after-free, buffer overflows, etc.'],
  ['-fsanitize=undefined', 'UBSan: catch many undefined behaviors.'],
  ['-fno-omit-frame-pointer', 'Better stack traces.'],
  ['-g -O1', 'Symbols + modest optimization for actionable reports.']
])}
<p>In design reviews, push APIs that return <code>unique_ptr</code>/RAII handles — not raw “caller must free” pointers.</p>
${callout('interview', 'Hybrid answer', `
<p>“Python owns the matrix and reporting; C++ owns the packet path under ASan/TSan builds.”</p>`)}
`
    }
  ],
  resources: [
    { title: 'Official Python Tutorial', url: 'https://docs.python.org/3/tutorial/', source: 'Python.org', note: 'Canonical free Python on-ramp.' },
    { title: 'LearnCpp.com', url: 'https://www.learncpp.com/', source: 'LearnCpp', note: 'Best free structured C++ course-style site.' },
    { title: 'cppreference', url: 'https://en.cppreference.com/', source: 'cppreference', note: 'Standard library reference.' },
    { title: 'C++ Core Guidelines', url: 'https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines', source: 'isocpp', note: 'Ownership/RAII guidance.' },
    { title: 'freeCodeCamp Python', url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/', source: 'freeCodeCamp', note: 'Interactive free practice.' }
  ]
};

// Apply all from part1 exports + part2
const part1 = require('./rewrite-tutorials-rich.js');
Object.assign(part1.tutorials, tutorials);

const qdir = path.join(__dirname, '..', 'questions');
let n = 0;
for (const [id, tutorial] of Object.entries(part1.tutorials)) {
  const file = path.join(qdir, `${id}.json`);
  const section = JSON.parse(fs.readFileSync(file, 'utf8'));
  section.tutorial = tutorial;
  // Keep documentation as a short pointer + first resource links
  const links = tutorial.resources.slice(0, 3).map(r =>
    `<li><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title}</a> — ${r.note}</li>`
  ).join('');
  section.documentation = `
<h3>${section.title} — Study Guide</h3>
<p>For the full interactive course, open this section’s <strong>Learn</strong> path (Basics → Advanced → Expert). Every important command is explained flag-by-flag there.</p>
<h4>Level map</h4>
<ul>
${tutorial.levels.map(l => `<li><strong>${l.title}:</strong> ${l.tagline}</li>`).join('\n')}
</ul>
<h4>Free resources</h4>
<ul>${links}</ul>`;
  fs.writeFileSync(file, JSON.stringify(section, null, 2) + '\n');
  const chars = tutorial.levels.reduce((a, l) => a + l.html.length, 0);
  console.log('rewrote', id, 'htmlChars=', chars);
  n++;
}
console.log('done', n);
