#!/usr/bin/env node
/**
 * Merges progressive Learn-path tutorials into NVIDIA prep section JSON files.
 * Run: node scripts/apply-nvidia-tutorials.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'questions');

const callout = (kind, title, body) =>
  `<div class="tutorial-callout ${kind}"><strong>${title}</strong>${body}</div>`;

const tutorials = {
  'networking-l2-l3': {
    intro: 'Build networking intuition the way NIC/SDK teams use it: frames and MACs first, then routes and troubleshooting, then offloads/RDMA performance paths.',
    levels: [
      {
        id: 'basics',
        title: 'Basics',
        badge: '🌱',
        minutes: 18,
        tagline: 'Packets, MACs, ARP, and “why can’t I ping?”',
        html: `
<p>Start with a mental model: <strong>apps talk to sockets → IP delivers between networks → Ethernet delivers on a link</strong>.</p>
<h4>Layer 2 in practice</h4>
<ul>
<li><strong>MAC address:</strong> hardware identity on a NIC port.</li>
<li><strong>Switch:</strong> learns source MACs, forwards/filters/floods by destination MAC.</li>
<li><strong>VLAN (802.1Q):</strong> tag that splits one physical LAN into logical broadcast domains.</li>
<li><strong>ARP:</strong> “Who has 10.0.0.5? Tell 10.0.0.9” → maps IPv4 → MAC on the local subnet.</li>
</ul>
<h4>Layer 3 in practice</h4>
<ul>
<li><strong>IP + prefix:</strong> <code>/24</code> means first 24 bits are network; hosts share that prefix.</li>
<li><strong>Default gateway:</strong> next hop when the destination is not on-link.</li>
<li><strong>Router:</strong> forwards between subnets using a routing table (longest prefix match).</li>
<li><strong>ICMP ping:</strong> cheap reachability + RTT check, not a full app test.</li>
</ul>
${callout('tip', 'Remember', '<p>If you can ping the gateway but not the internet, L2 to the gateway is probably fine — look upstream (routes, WAN, DNS separately).</p>')}
${callout('lab', '5-minute lab', '<ol class="checklist"><li>Draw Host A, switch, router, Host B on another subnet</li><li>Label where ARP happens vs where routing happens</li><li>Predict the Ethernet dest MAC for a remote IP (hint: gateway MAC)</li></ol>')}
<h4>Toolbox you must know</h4>
<pre>ip addr / ip route
ping / traceroute
tcpdump -i eth0 -n
arp -n   # or ip neigh</pre>
${callout('interview', 'Interview cue', '<p>Explain a failed ping by layer: link up? same VLAN? ARP complete? route present? ACL/firewall?</p>')}
`
      },
      {
        id: 'advanced',
        title: 'Advanced',
        badge: '🚀',
        minutes: 22,
        tagline: 'ECMP, MTU, TCP vs UDP, capture-driven debugging',
        html: `
<h4>Forwarding at scale</h4>
<ul>
<li><strong>ECMP:</strong> multiple equal-cost next hops; flows hashed across paths. Polarization = bad hash → one path overloaded.</li>
<li><strong>BGP vs IGP:</strong> BGP between autonomous systems; OSPF/IS-IS typically inside an AS.</li>
<li><strong>TTL:</strong> decremented each hop to kill loops.</li>
</ul>
<h4>Transports</h4>
<ul>
<li><strong>TCP:</strong> connection, reliability, ordering, congestion control.</li>
<li><strong>UDP:</strong> minimal; apps invent reliability if needed (games, custom RPC, tunnels).</li>
<li><strong>MTU 1500:</strong> common Ethernet payload size for IP; jumbo frames need end-to-end support. Fragmentation/PMTUD issues are classic lab bugs.</li>
</ul>
${callout('pitfall', 'Classic footgun', '<p>Host ARPs for a remote IP → missing/incorrect default route or wrong mask. The packet never reaches the gateway.</p>')}
<h4>Capture discipline</h4>
<pre>tcpdump -i eth0 -v icmp
tcpdump -i eth0 host 10.0.1.10 and port 443
# Compare: expected SYN/ACK vs RST, VLAN tags, wrong checksums</pre>
<p>Always ask: <em>where</em> you capture (sender NIC, switch SPAN, receiver). Path asymmetry lies.</p>
${callout('lab', 'Scenario drill', '<p>A↔B same VLAN, links UP, switch CAM correct, still fail. Next check: host ARP tables / IP config / host firewall. Write the hypothesis before touching config.</p>')}
${callout('interview', 'Sound experienced', '<p>Talk about evidence: “tcpdump showed ARP who-has for remote IP” beats “networking is broken.”</p>')}
`
      },
      {
        id: 'expert',
        title: 'Expert',
        badge: '🏆',
        minutes: 24,
        tagline: 'NIC offloads, RSS, RDMA/RoCE — verification mindset',
        html: `
<p>SDK/NIC verification lives at the intersection of <strong>correctness</strong> and <strong>performance path</strong>.</p>
<h4>Offloads</h4>
<ul>
<li><strong>Checksum / TSO / GSO / GRO:</strong> work moves into the NIC or stack aggregation points.</li>
<li>Bugs often appear only with offloads ON, or only through middleboxes that rewrite packets.</li>
<li>A/B with <code>ethtool -k/-K</code> is a professional habit.</li>
</ul>
<h4>Multi-queue &amp; RSS</h4>
<ul>
<li>RSS hashes flows to queues/CPUs for parallelism.</li>
<li>Bad hashing → imbalance, cache issues, surprising reordering across queues.</li>
<li>Verify with traffic patterns + <code>/proc/interrupts</code> + per-queue stats.</li>
</ul>
<h4>RDMA / RoCE</h4>
<ul>
<li><strong>RDMA:</strong> remote memory access with low latency and less CPU than kernel TCP sockets.</li>
<li><strong>RoCE:</strong> RDMA over Converged Ethernet — common in AI/HPC clusters.</li>
<li>Verification concerns: lossy vs lossless setup, PFC/ECN, connection migration, fault recovery.</li>
</ul>
${callout('tip', 'Expert habit', '<p>Build a matrix: kernel × driver × offload flags × peer OS × MTU. Escape defects love the cell you skipped.</p>')}
${callout('interview', 'Manager/tech hybrid answer', '<p>“I’d gate releases on a smoke path with offloads both on and off, plus a perf job watching RSS balance and p99 — not only average Gbps.”</p>')}
`
      }
    ],
    resources: [
      { title: 'Cloudflare Learning Center — Networking basics', url: 'https://www.cloudflare.com/learning/network-layer/what-is-a-computer-network/', source: 'Cloudflare', note: 'Clear free explainers for IP, DNS, TLS, CDN concepts.' },
      { title: 'Practical Networking', url: 'https://www.practicalnetworking.net/', source: 'Practical Networking', note: 'Excellent free subnetting &amp; packet-flow lessons.' },
      { title: 'Wireshark University / Official docs', url: 'https://www.wireshark.org/docs/', source: 'Wireshark', note: 'Learn capture filters and protocol decoding hands-on.' },
      { title: 'Linux iproute2 utilities (ip-route man)', url: 'https://man7.org/linux/man-pages/man8/ip-route.8.html', source: 'man7', note: 'Authoritative reference for modern Linux routing commands.' },
      { title: 'RoCE Initiative overview', url: 'https://www.roceinitiative.org/', source: 'RoCE Initiative', note: 'Free high-level RDMA-over-Ethernet orientation.' }
    ]
  },

  'linux-systems-verification': {
    intro: 'Become dangerous (in a good way) on a Linux lab box: permissions, NICs, logs, and reproducible performance.',
    levels: [
      {
        id: 'basics',
        title: 'Basics',
        badge: '🌱',
        minutes: 16,
        tagline: 'Processes, permissions, and where the kernel talks',
        html: `
<ul>
<li><strong>Process vs thread:</strong> process ≈ address space; threads share it and are scheduled separately.</li>
<li><strong>User vs kernel:</strong> SDKs make syscalls; drivers and the network stack live in the kernel.</li>
<li><strong>Permissions:</strong> UID/GID, file modes on <code>/dev/*</code>, supplementary groups, capabilities.</li>
</ul>
<pre>ss -lntp
ip link / ip addr
dmesg | tail
journalctl -k -b</pre>
${callout('pitfall', 'CI classic', '<p>Permission denied on a device node is often udev group membership — not “the SDK is broken.”</p>')}
${callout('lab', 'Try', '<p>Run <code>ss -lntp</code> and identify one listening service and its PID.</p>')}
`
      },
      {
        id: 'advanced',
        title: 'Advanced',
        badge: '🚀',
        minutes: 20,
        tagline: 'ethtool, strace, modules, and interrupt imbalance',
        html: `
<h4>NIC tooling</h4>
<pre>ethtool eth0
ethtool -k eth0          # offloads
ethtool -S eth0          # driver stats
ethtool -L eth0 combined 4</pre>
<h4>Debugging userspace↔kernel</h4>
<ul>
<li><code>strace -f</code> on a failing test binary — watch open/ioctl/connect errno.</li>
<li>Kernel modules (<code>.ko</code>): version skew with <code>uname -r</code> breaks labs constantly.</li>
<li><code>/proc/interrupts</code>: if all NIC IRQs stick on CPU0, perf numbers lie.</li>
</ul>
${callout('tip', 'Stabilize benches', '<p>Pin IRQs and worker threads; respect NUMA node locality.</p>')}
${callout('interview', 'Sound senior', '<p>Describe a time you used strace/dmesg/ethtool together to separate “env” from “product bug.”</p>')}
`
      },
      {
        id: 'expert',
        title: 'Expert',
        badge: '🏆',
        minutes: 20,
        tagline: 'cgroups, capabilities, perf, matrix testing',
        html: `
<ul>
<li><strong>cgroups:</strong> limit/account CPU/memory/I/O — foundation of containers and fair CI.</li>
<li><strong>capabilities:</strong> <code>CAP_NET_RAW</code>/<code>CAP_NET_ADMIN</code> beat full root for capture tools.</li>
<li><strong>perf:</strong> find hot functions and cache issues in SDK stacks.</li>
<li><strong>Matrix:</strong> test across kernels/distros customers actually run.</li>
</ul>
${callout('lab', 'Expert checklist', '<ul class="checklist"><li>Document required groups/udev rules for the SDK</li><li>Add a preflight script: kernel, driver, device node, ethtool link</li><li>Record IRQ balance before publishing Gbps numbers</li></ul>')}
${callout('interview', 'Leadership angle', '<p>“We treat lab preflight as productized automation — it cut false failures by X%.”</p>')}
`
      }
    ],
    resources: [
      { title: 'Linux Journey', url: 'https://linuxjourney.com/', source: 'Linux Journey', note: 'Friendly free path through Linux fundamentals.' },
      { title: 'Free Electrons / Bootlin kernel labs (materials)', url: 'https://bootlin.com/doc/training/linux-kernel/', source: 'Bootlin', note: 'High-quality free kernel/driver training slides.' },
      { title: 'man ss / man ethtool', url: 'https://man7.org/linux/man-pages/man8/ss.8.html', source: 'man7', note: 'Primary references for socket &amp; NIC tooling.' },
      { title: 'Linux Performance (Brendan Gregg)', url: 'https://www.brendangregg.com/linuxperf.html', source: 'Brendan Gregg', note: 'Gold-standard free performance methodology maps.' },
      { title: 'capabilities(7)', url: 'https://man7.org/linux/man-pages/man7/capabilities.7.html', source: 'man7', note: 'How to avoid running everything as root.' }
    ]
  },

  'cicd-devops-sdk': {
    intro: 'Treat CI as a product: reproducible environments, honest gates, and cross-component promotion — not a red dashboard you ignore.',
    levels: [
      {
        id: 'basics',
        title: 'Basics',
        badge: '🌱',
        minutes: 15,
        tagline: 'Git → build → test → package',
        html: `
<ol>
<li><strong>Build</strong> the SDK artifacts</li>
<li><strong>Test</strong> fast checks on every change</li>
<li><strong>Package/sign</strong> release candidates</li>
<li><strong>Publish</strong> only after gates pass</li>
</ol>
<pre>git switch -c sdk-verify-fix
docker run --rm -it -v "$PWD":/workspace sdk-verify:1.2</pre>
${callout('tip', 'Gerrit tip', '<p><strong>Change-Id</strong> ties patch sets of one logical review together.</p>')}
`
      },
      {
        id: 'advanced',
        title: 'Advanced',
        badge: '🚀',
        minutes: 20,
        tagline: 'Jenkins agents, Docker pins, flake policy',
        html: `
<ul>
<li><strong>Agent labels:</strong> route jobs to NIC/GPU lab pools.</li>
<li><strong>Golden images:</strong> freeze toolchain/driver versions — kill “works on agent 3.”</li>
<li><strong>Flakes:</strong> quarantine with owners; don’t infinite-retry into a fake green.</li>
</ul>
<pre>pipeline {
  agent any
  stages {
    stage('Verify') {
      steps { sh 'pytest -q' }
    }
  }
}</pre>
${callout('pitfall', 'Anti-pattern', '<p>Marking the whole pipeline optional because it is red destroys organizational trust.</p>')}
`
      },
      {
        id: 'expert',
        title: 'Expert',
        badge: '🏆',
        minutes: 18,
        tagline: 'Promotion matrices across FW/driver/SDK',
        html: `
<p>In HW/SW orgs, <strong>compatibility is a release artifact</strong>.</p>
<ul>
<li>Promote firmware+driver pairs that passed joint smoke.</li>
<li>SDK signs off only against promoted pairs.</li>
<li>Nightlies must not silently mix unpromoted drops.</li>
</ul>
${callout('interview', 'Manager answer', '<p>“I’d publish a compatibility matrix and a merge-blocking smoke on golden agents; nightlies expand coverage without lying about gate health.”</p>')}
`
      }
    ],
    resources: [
      { title: 'Docker Get Started', url: 'https://docs.docker.com/get-started/', source: 'Docker Docs', note: 'Official free intro to images, containers, and volumes.' },
      { title: 'Jenkins Pipeline documentation', url: 'https://www.jenkins.io/doc/book/pipeline/', source: 'Jenkins', note: 'Declarative pipelines &amp; agents from the source.' },
      { title: 'Pro Git book', url: 'https://git-scm.com/book/en/v2', source: 'git-scm', note: 'The free classic for branching, rebasing, and collaboration.' },
      { title: 'Gerrit documentation', url: 'https://gerrit-review.googlesource.com/Documentation/', source: 'Gerrit', note: 'Change-Ids, reviews, and submit requirements.' },
      { title: 'GitHub Skills (free hands-on)', url: 'https://skills.github.com/', source: 'GitHub', note: 'Interactive free courses on Git/Actions workflows.' }
    ]
  },

  'sdk-verification-automation': {
    intro: 'Think like a verification leader: oracles, risk-based coverage, harness craft, and metrics that measure trust.',
    levels: [
      {
        id: 'basics',
        title: 'Basics',
        badge: '🌱',
        minutes: 16,
        tagline: 'Verification vs validation, and a trustworthy smoke',
        html: `
<ul>
<li><strong>Verification:</strong> build the product <em>right</em> (vs spec/design).</li>
<li><strong>Validation:</strong> build the <em>right</em> product (vs user need).</li>
<li><strong>Smoke gate:</strong> small, owned, deterministic, merge-blocking.</li>
</ul>
<pre>def test_add():
    assert add(2, 3) == 5</pre>
${callout('tip', 'First 30 days', '<p>Map owners, measure flake/runtime, define critical smoke — before rewriting 8,000 tests.</p>')}
`
      },
      {
        id: 'advanced',
        title: 'Advanced',
        badge: '🚀',
        minutes: 20,
        tagline: 'Oracles, fixtures, retries with limits',
        html: `
<ul>
<li><strong>Hangs</strong> need liveness oracles: timeouts, heartbeats, progress counters.</li>
<li><strong>pytest fixtures</strong> with <code>yield</code> for setup/teardown.</li>
<li><strong>Retries</strong> belong in helpers with caps — still fail loudly.</li>
<li><strong>HW farms</strong> need locks/leases; shared mutable devices without isolation = heisenbugs.</li>
</ul>
${callout('pitfall', 'Vanity metric', '<p>100% line coverage with weak asserts is theater. Demand behavioral oracles.</p>')}
`
      },
      {
        id: 'expert',
        title: 'Expert',
        badge: '🏆',
        minutes: 18,
        tagline: 'Compatibility contracts &amp; severity judgment',
        html: `
<ul>
<li>Contract/schema tests + old clients against new SDK in CI.</li>
<li>Silent data corruption ⇒ high/critical even if rare.</li>
<li>Scale metrics: wall time, flake %, parallel efficiency, MTTR, ownership %.</li>
</ul>
${callout('interview', 'Pushback line', '<p>“Coverage is necessary but not sufficient — here’s the risk-based scenario set that actually protects customers.”</p>')}
`
      }
    ],
    resources: [
      { title: 'pytest documentation', url: 'https://docs.pytest.org/', source: 'pytest', note: 'Fixtures, parametrization, and plugins — the harness standard.' },
      { title: 'Google Testing Blog', url: 'https://testing.googleblog.com/', source: 'Google', note: 'Free essays on testability, flakiness, and engineering culture.' },
      { title: 'Ministry of Testing (free articles)', url: 'https://www.ministryoftesting.com/articles', source: 'MoT', note: 'Practical software testing community content.' },
      { title: 'Martin Fowler — Test Pyramid', url: 'https://martinfowler.com/articles/practical-test-pyramid.html', source: 'Martin Fowler', note: 'Classic free framing for where tests should live.' },
      { title: 'OWASP Wrangling WebSocket / general quality ideas', url: 'https://owasp.org/www-project-web-security-testing-guide/', source: 'OWASP', note: 'Free testing mindset for adversarial/negative cases.' }
    ]
  },

  'concurrency-distributed-testing': {
    intro: 'From data races to multi-node partitions: name the failure class, then design an oracle that would catch it.',
    levels: [
      {
        id: 'basics',
        title: 'Basics',
        badge: '🌱',
        minutes: 15,
        tagline: 'Races, locks, and why shared counters break',
        html: `
<ul>
<li><strong>Data race:</strong> conflicting concurrent accesses without happens-before (UB in C++).</li>
<li><strong>Critical section:</strong> protect with mutex/atomic.</li>
<li><strong>Deadlock:</strong> circular wait — fix with global lock order.</li>
</ul>
<pre>with lock:
    counter += 1</pre>
${callout('tip', 'Remember', '<p>Release-only corruption under stress ⇒ suspect races; try TSan.</p>')}
`
      },
      {
        id: 'advanced',
        title: 'Advanced',
        badge: '🚀',
        minutes: 18,
        tagline: 'Heisenbugs, TSan, and sleep-free sync',
        html: `
<ul>
<li><strong>Heisenbug:</strong> changes when observed (logging/debugger timing).</li>
<li><strong>TSan:</strong> dynamic detector for data races in native code.</li>
<li>Prefer condition variables / state polling with timeout over <code>sleep(2)</code>.</li>
<li>Invariants beat spot checks: every enqueue has exactly one dequeue.</li>
</ul>
${callout('lab', 'Drill', '<p>Write an invariant for a multi-producer queue before you write the test threads.</p>')}
`
      },
      {
        id: 'expert',
        title: 'Expert',
        badge: '🏆',
        minutes: 20,
        tagline: 'Partitions, thundering herds, p99 honesty',
        html: `
<ul>
<li>Inject disconnect/partition; assert reconnect/resubscribe bounds.</li>
<li>Stagger multi-node starts with jitter — herds amplify control-plane storms.</li>
<li>Publish p99/p999 with pinned CPUs; averages hide pain.</li>
</ul>
${callout('interview', 'Experienced line', '<p>“We chaos-test recovery paths and treat liveness as a first-class assertion, not a hopeful log line.”</p>')}
`
      }
    ],
    resources: [
      { title: 'ThreadSanitizer wiki', url: 'https://github.com/google/sanitizers/wiki/ThreadSanitizerCppManual', source: 'Google Sanitizers', note: 'How to build/run TSan on C/C++.' },
      { title: 'Preshing on Programming — atomics &amp; locks', url: 'https://preshing.com/', source: 'Preshing', note: 'Clear free deep-dives on memory ordering &amp; concurrency.' },
      { title: 'Python threading docs', url: 'https://docs.python.org/3/library/threading.html', source: 'Python.org', note: 'Locks, events, and primitives for harnesses.' },
      { title: 'Jepsen.io analyses', url: 'https://jepsen.io/analyses', source: 'Jepsen', note: 'World-class free distributed-systems failure narratives.' },
      { title: 'Awesome Chaos Engineering (lists free tools)', url: 'https://github.com/dastergon/awesome-chaos-engineering', source: 'Community', note: 'Curated free chaos/fault-injection resources.' }
    ]
  },

  'verification-leadership': {
    intro: 'Practice the management craft the NVIDIA posting asks for: hands-on technical credibility, mentoring, and protecting the quality signal.',
    levels: [
      {
        id: 'basics',
        title: 'Basics',
        badge: '🌱',
        minutes: 14,
        tagline: 'Tradeoffs, ownership, and honest signoff',
        html: `
<ul>
<li>Make <strong>risk-based</strong> calls: fast merge gate vs deep nightly.</li>
<li>Never fake full signoff when HW deps slipped — renegotiate scoped criteria.</li>
<li>Healthy scale = ownership + falling flakes + trusted gate (not raw test count).</li>
</ul>
${callout('interview', 'STAR nugget', '<p>Prepare a story where you protected signal under schedule pressure.</p>')}
`
      },
      {
        id: 'advanced',
        title: 'Advanced',
        badge: '🚀',
        minutes: 16,
        tagline: 'Coaching, onboarding, cross-team alignment',
        html: `
<ul>
<li>Coach “clever but unreadable” toward on-call diagnosability.</li>
<li>Onboarding: buddy, smoke day 1, first owned flake fix.</li>
<li>Alignment meetings must produce interfaces, owners, exit criteria.</li>
</ul>
${callout('tip', 'Meeting rule', '<p>No decision / no owner / no note = theater.</p>')}
`
      },
      {
        id: 'expert',
        title: 'Expert',
        badge: '🏆',
        minutes: 16,
        tagline: 'Shift-left and metrics that matter',
        html: `
<ul>
<li>Institutionalize verification seats in design/architecture reviews.</li>
<li>Measure runtime, flake %, escape defects, MTTR, ownership — not vanity counts.</li>
<li>Mission: honest, fast confidence that the SDK works on real hardware at customer scale.</li>
</ul>
${callout('interview', 'Close the loop', '<p>Connect escape bugs to process changes (review checklist, new gate, new oracle).</p>')}
`
      }
    ],
    resources: [
      { title: 'Google re:Work — Managers', url: 'https://rework.withgoogle.com/guides/managers-identify-what-makes-a-great-manager/steps/learn-about-googles-manager-research/', source: 'Google re:Work', note: 'Free evidence-based management practices.' },
      { title: 'LeadDev articles', url: 'https://leaddev.com/', source: 'LeadDev', note: 'Strong free/community articles on engineering leadership.' },
      { title: 'Manager Tools basics (podcast)', url: 'https://www.manager-tools.com/', source: 'Manager Tools', note: 'Practical free podcast episodes on 1:1s and feedback.' },
      { title: 'The Engineering Manager resources list', url: 'https://github.com/ryanburgess/engineer-manager', source: 'Community', note: 'Curated free reading list for new EM/tech leads.' },
      { title: 'Articulate quality with risk (ISTQB foundation syllabus PDF)', url: 'https://istqb.org/', source: 'ISTQB', note: 'Free syllabus PDFs help vocabulary for V&amp;V discussions.' }
    ]
  },

  'python-cpp-verification': {
    intro: 'Become bilingual: Python for orchestration and C++ for fidelity — with ownership-safe APIs.',
    levels: [
      {
        id: 'basics',
        title: 'Basics',
        badge: '🌱',
        minutes: 16,
        tagline: 'Parsing, pathlib, and tiny pytest',
        html: `
<pre>def parse_kv(line):
    k, v = line.split('=', 1)
    return k.strip(), v.strip()

Path('reports').mkdir(parents=True, exist_ok=True)</pre>
<p>Python shines at glue: logs, artifacts, CI orchestration.</p>
${callout('tip', 'Remember', '<p><code>set()</code> makes a set; <code>{}</code> is a dict.</p>')}
`
      },
      {
        id: 'advanced',
        title: 'Advanced',
        badge: '🚀',
        minutes: 18,
        tagline: 'RAII, unique_ptr, and polyglot harnesses',
        html: `
<ul>
<li><strong>RAII:</strong> resource lifetime follows object lifetime.</li>
<li><strong>unique_ptr:</strong> exclusive ownership; <strong>shared_ptr:</strong> refcounted sharing.</li>
<li>Delete copy ctor/assignment for handles that must not double-close.</li>
<li>Shell out to native stress binaries from Python for fidelity/perf.</li>
</ul>
<pre>DeviceHandle(const DeviceHandle&) = delete;
DeviceHandle& operator=(const DeviceHandle&) = delete;</pre>
`
      },
      {
        id: 'expert',
        title: 'Expert',
        badge: '🏆',
        minutes: 16,
        tagline: 'UB awareness and API review instincts',
        html: `
<ul>
<li>Data races on non-atomic C++ objects are <strong>undefined behavior</strong>.</li>
<li>In design reviews, push APIs that return <code>unique_ptr</code>/RAII handles — not raw “caller must free.”</li>
<li>Exit-code taxonomy (<code>0</code> pass, <code>77</code> skip, else fail) keeps automation honest.</li>
</ul>
${callout('interview', 'Hybrid answer', '<p>“Python owns the matrix and reporting; C++ owns the packet path under TSan/ASan builds.”</p>')}
`
      }
    ],
    resources: [
      { title: 'Official Python Tutorial', url: 'https://docs.python.org/3/tutorial/', source: 'Python.org', note: 'The canonical free Python on-ramp.' },
      { title: 'Learn C++ (learncpp.com)', url: 'https://www.learncpp.com/', source: 'LearnCpp', note: 'Best free structured C++ course-style site.' },
      { title: 'cppreference', url: 'https://en.cppreference.com/', source: 'cppreference', note: 'Authoritative free C++ standard library reference.' },
      { title: 'freeCodeCamp Python curriculum', url: 'https://www.freecodecamp.org/learn/scientific-computing-with-python/', source: 'freeCodeCamp', note: 'Free interactive Python practice.' },
      { title: 'The C++ Core Guidelines', url: 'https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines', source: 'isocpp', note: 'Free guidance on ownership, RAII, and safety.' }
    ]
  }
};

function enrichDocumentation(section, tutorial) {
  const resourceLinks = (tutorial.resources || [])
    .slice(0, 3)
    .map(r => `<li><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.title}</a> — ${r.note}</li>`)
    .join('');

  return `${section.documentation || ''}
<h3>Learn path</h3>
<p>Open this section’s <strong>Learn</strong> button for the full Basics → Advanced → Expert journey (interactive in the app).</p>
<h4>Quick remediation map</h4>
<ul>
<li><strong>Basics:</strong> ${(tutorial.levels[0] && tutorial.levels[0].tagline) || 'core ideas'}</li>
<li><strong>Advanced:</strong> ${(tutorial.levels[1] && tutorial.levels[1].tagline) || 'deeper practice'}</li>
<li><strong>Expert:</strong> ${(tutorial.levels[2] && tutorial.levels[2].tagline) || 'professional judgment'}</li>
</ul>
<h4>Start with these free resources</h4>
<ul>${resourceLinks}</ul>`;
}

let updated = 0;
for (const [id, tutorial] of Object.entries(tutorials)) {
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) {
    console.warn('skip missing', id);
    continue;
  }
  const section = JSON.parse(fs.readFileSync(file, 'utf8'));
  section.tutorial = tutorial;
  section.documentation = enrichDocumentation(section, tutorial);
  fs.writeFileSync(file, JSON.stringify(section, null, 2) + '\n');
  updated++;
  console.log('updated', id, 'levels=', tutorial.levels.length, 'resources=', tutorial.resources.length);
}
console.log('done', updated);
