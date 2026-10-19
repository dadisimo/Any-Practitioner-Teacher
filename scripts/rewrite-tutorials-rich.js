#!/usr/bin/env node
/**
 * Replace thin Learn-path tutorials with real teaching content.
 * Every important command is explained flag-by-flag.
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'questions');

const cmd = (command, parts) =>
  `<div class="cmd-block"><pre>${command}</pre><dl class="cmd-explain">${
    parts.map(([k, v]) => `<dt><code>${k}</code></dt><dd>${v}</dd>`).join('')
  }</dl></div>`;

const why = (title, body) =>
  `<div class="why-box"><strong>${title}</strong><p>${body}</p></div>`;

const callout = (kind, title, body) =>
  `<div class="tutorial-callout ${kind}"><strong>${title}</strong>${body}</div>`;

const tutorials = {};

// ===================== NETWORKING =====================
tutorials['networking-l2-l3'] = {
  intro: 'Learn networking by walking packets through the stack, then mastering the exact Linux commands you will use in labs and interviews — with every flag explained.',
  levels: [
    {
      id: 'basics',
      title: 'Basics',
      badge: '🌱',
      minutes: 35,
      tagline: 'How a packet really moves — and the first commands that prove it',
      html: `
<p>Goal of this level: understand <em>what happens between “press Enter on ping”</em> and <em>“reply comes back”</em>, and use Linux tools to observe each step.</p>

<h4>1. The three jobs in networking</h4>
<ol>
<li><strong>Ethernet (Layer 2)</strong> delivers frames on one local link/VLAN using <strong>MAC addresses</strong>.</li>
<li><strong>IP (Layer 3)</strong> delivers packets between networks using <strong>IP addresses + routes</strong>.</li>
<li><strong>TCP/UDP (Layer 4)</strong> delivers data to the right app using <strong>ports</strong>.</li>
</ol>
${why('Why this split matters',
  'When something fails, you diagnose one layer at a time. “Internet is down” is not a diagnosis — “no default route” or “ARP incomplete” is.')}

<h4>2. See your host’s identity</h4>
${cmd('ip addr show', [
  ['ip', 'The modern Linux networking command (iproute2). Prefer this over old ifconfig.'],
  ['addr', 'Address subcommand: show/add/delete IP addresses on interfaces.'],
  ['show', 'Print current addresses (can omit; ip addr alone also lists them).']
])}
<p>In the output, look for:</p>
<ul>
<li><code>eth0</code> / <code>ens*</code> / <code>enp*</code> — your NIC name</li>
<li><code>inet 10.0.1.10/24</code> — IPv4 address and prefix length</li>
<li><code>inet6 ...</code> — IPv6 if present</li>
<li><code>state UP</code> — link is administratively/carrier up</li>
</ul>
${why('/24 means',
  'The first 24 bits are the network. Hosts with the same first three octets (e.g. 10.0.1.x) are usually on-link. Everything else needs a router (gateway).')}

<h4>3. See how the host forwards packets</h4>
${cmd('ip route show', [
  ['ip route', 'Routing table: “for this destination, use this next hop / device.”'],
  ['show', 'List routes (default if you type only ip route).']
])}
<p>Important lines:</p>
<ul>
<li><code>default via 10.0.1.1 dev eth0</code> — if no better match, send to gateway 10.0.1.1 out eth0</li>
<li><code>10.0.1.0/24 dev eth0 ...</code> — destinations in this subnet are on-link on eth0 (no gateway)</li>
</ul>

<h4>4. ARP: map IP → MAC on the local link</h4>
<p>Ethernet cannot send to an “IP”. It sends to a MAC. <strong>ARP</strong> answers: “Who has 10.0.1.1? Tell 10.0.1.10.”</p>
${cmd('ip neigh show', [
  ['ip neigh', 'Neighbor table (ARP for IPv4, Neighbor Discovery for IPv6).'],
  ['show', 'List known IP→MAC (or unresolved) entries.']
])}
<p>States you will see: <code>REACHABLE</code> (good), <code>STALE</code> (old but usable), <code>INCOMPLETE</code>/<code>FAILED</code> (ARP did not resolve — big red flag).</p>

<h4>5. Ping as a layer test (not a full app test)</h4>
${cmd('ping -c 4 10.0.1.1', [
  ['ping', 'Sends ICMP Echo Requests; waits for Echo Replies.'],
  ['-c 4', 'Stop after 4 probes (otherwise ping runs forever).'],
  ['10.0.1.1', 'Target IP — often your default gateway in labs.']
])}
${callout('tip', 'Interpret ping results', `
<ul>
<li>Gateway ping works, 8.8.8.8 fails → local LAN OK; problem is upstream routing/WAN/DNS separately.</li>
<li>Same-subnet ping fails → L2/ARP/VLAN/host firewall before “the internet”.</li>
<li>Ping success does <em>not</em> prove TCP port 443 works.</li>
</ul>`)}

<h4>6. First packet capture</h4>
${cmd('sudo tcpdump -i eth0 -n icmp', [
  ['sudo', 'Packet capture usually needs root or CAP_NET_RAW.'],
  ['tcpdump', 'Capture and print packets matching a filter.'],
  ['-i eth0', 'Listen on interface eth0 (change to your NIC name).'],
  ['-n', 'Do not resolve names — show raw IPs/ports (faster, clearer).'],
  ['icmp', 'Capture filter: only ICMP (what ping uses).']
])}
${callout('lab', 'Do this once', `
<ol>
<li>Terminal A: <code>sudo tcpdump -i eth0 -n icmp</code></li>
<li>Terminal B: <code>ping -c 3 10.0.1.1</code></li>
<li>Confirm you see echo request/reply lines. That is “proof”, not vibes.</li>
</ol>`)}
`
    },
    {
      id: 'advanced',
      title: 'Advanced',
      badge: '🚀',
      minutes: 40,
      tagline: 'Routes, VLANs, TCP vs UDP, and capture filters that tell a story',
      html: `
<p>Goal: debug real failures with evidence — wrong route, remote ARP mistake, MTU issues, TCP resets.</p>

<h4>1. Add / fix a default route</h4>
${cmd('sudo ip route add default via 192.168.1.1', [
  ['sudo ip route add', 'Install a new route in the kernel routing table.'],
  ['default', 'Matches every destination that has no more-specific route (same as 0.0.0.0/0).'],
  ['via 192.168.1.1', 'Next-hop gateway IP (must be reachable on-link).']
])}
${cmd('sudo ip route del default', [
  ['del', 'Remove a route — useful when a bad default was added.'],
  ['default', 'Deletes the default route (be careful on remote SSH).']
])}
${callout('pitfall', 'Classic bug you must recognize', `
<p>Host ARPs for a <em>remote</em> IP (e.g. 10.0.2.20) instead of the gateway. That means it thinks the destination is local — usually <strong>missing default route</strong> or <strong>wrong netmask</strong>.</p>`)}

<h4>2. Richer captures for debugging</h4>
${cmd('sudo tcpdump -i eth0 -nv host 10.0.1.10 and port 443', [
  ['-v', 'Verbose: show more protocol detail (TTL, length, etc.).'],
  ['-n', 'No DNS/port-name resolution.'],
  ['host 10.0.1.10', 'Only packets to/from this IP.'],
  ['and port 443', 'And only TCP/UDP port 443 (HTTPS).'],
  ['and', 'Combines filter expressions (tcpdump uses pcap filter syntax).']
])}
${cmd('sudo tcpdump -i eth0 -n arp', [
  ['arp', 'Filter: only ARP packets — perfect when you suspect IP→MAC problems.']
])}

<h4>3. TCP vs UDP (what to say in interviews)</h4>
<ul>
<li><strong>TCP:</strong> connection setup (handshake), reliable delivery, ordering, congestion control. Use for most APIs.</li>
<li><strong>UDP:</strong> no connection, no built-in reliability. Use when the app invents its own reliability or latency beats guarantees (or tunnels).</li>
</ul>
${cmd('ss -lntp', [
  ['ss', 'Socket statistics (modern replacement for much of netstat).'],
  ['-l', 'Listening sockets only.'],
  ['-n', 'Numeric ports (do not translate 22→ssh).'],
  ['-t', 'TCP only.'],
  ['-p', 'Show owning process (may need root for others’ processes).']
])}
${why('Why ss matters in SDK labs',
  'Before blaming the SDK, confirm something is actually listening on the expected port, and which PID owns it.')}

<h4>4. MTU and “it works for small pings only”</h4>
<p>Standard Ethernet MTU is often <strong>1500</strong> bytes for the IP packet. If a path has a smaller MTU and ICMP “Fragmentation Needed” is blocked, large TCP sessions die mysteriously while ping -s small works.</p>
${cmd('ping -c 3 -M do -s 1472 8.8.8.8', [
  ['-M do', 'Path MTU discovery probe: do not fragment.'],
  ['-s 1472', 'Payload size. 1472 + 28 byte IP/ICMP headers ≈ 1500 MTU.'],
  ['8.8.8.8', 'Replace with a peer on the path you are testing.']
])}

<h4>5. Troubleshooting order (memorize)</h4>
<ol>
<li>Link: carrier/errors (<code>ip link</code>, <code>ethtool</code>)</li>
<li>L2: VLAN, MAC learning, ARP state</li>
<li>L3: address, mask, routes, ping gateway then beyond</li>
<li>Policy: firewall/iptables/nft/security groups</li>
<li>App: listen port, TLS, timeouts (<code>ss</code>, app logs)</li>
</ol>
`
    },
    {
      id: 'expert',
      title: 'Expert',
      badge: '🏆',
      minutes: 40,
      tagline: 'NIC offloads, RSS, RDMA — verify like a networking SDK engineer',
      html: `
<p>Goal: understand performance-path features that break correctness when misunderstood.</p>

<h4>1. ethtool: the NIC control panel</h4>
${cmd('ethtool eth0', [
  ['ethtool', 'Query/change NIC driver settings (link mode, speed, offloads, rings).'],
  ['eth0', 'Target network interface.']
])}
<p>Shows link speed/duplex and whether the link is detected.</p>
${cmd('ethtool -k eth0', [
  ['-k', 'Show offload features: which work the NIC/stack accelerates (checksum, TSO, GRO, etc.).'],
  ['on/off columns', 'fixed = cannot change; on/off = current state.']
])}
${cmd('sudo ethtool -K eth0 tso off gso off gro off', [
  ['-K', 'Change offload features (capital K).'],
  ['tso off', 'Disable TCP Segmentation Offload — CPU segments large TCP sends instead of NIC.'],
  ['gso off', 'Disable Generic Segmentation Offload in software.'],
  ['gro off', 'Disable Generic Receive Offload aggregation on receive.']
])}
${why('Why A/B offloads',
  'Many “perf wins” and many weird middlebox bugs appear only with offloads enabled. Professionals always test both.')}

${cmd('ethtool -S eth0', [
  ['-S', 'Driver statistics: drops, errors, queue counters — gold for “is the NIC unhappy?”']
])}

<h4>2. RSS / multi-queue</h4>
<p><strong>RSS (Receive Side Scaling)</strong> hashes flows to multiple receive queues/CPUs so one core is not the bottleneck.</p>
${cmd('ethtool -l eth0', [
  ['-l', 'Show channel/queue counts (RX/TX/combined).']
])}
${cmd('grep eth0 /proc/interrupts', [
  ['/proc/interrupts', 'Kernel table of interrupt counts per CPU.'],
  ['grep eth0', 'Filter lines for your NIC IRQs — look for imbalance (all hits on CPU0).']
])}
${callout('interview', 'Experienced answer', `
<p>“I’d check RSS queue count, IRQ affinity, and per-CPU interrupt rates before publishing Gbps numbers — otherwise I’m benchmarking the scheduler, not the NIC.”</p>`)}

<h4>3. RDMA / RoCE (high level you must own)</h4>
<ul>
<li><strong>RDMA</strong> lets one host read/write remote memory with low latency and less CPU than kernel TCP sockets.</li>
<li><strong>RoCE</strong> is RDMA over Converged Ethernet — common in AI/HPC clusters.</li>
<li>Verification concerns: lossy vs lossless fabric, PFC/ECN, connection recovery, interoperability.</li>
</ul>

<h4>4. Expert verification matrix</h4>
<ul>
<li>Kernel × driver × firmware</li>
<li>Offloads on vs off</li>
<li>MTU 1500 vs jumbo</li>
<li>Single queue vs multi-queue</li>
<li>Peer OS differences</li>
</ul>
${callout('lab', 'Capstone', `
<p>Take a working two-host path and break it five ways (bad route, wrong ARP static, VLAN mismatch, MTU black hole, offload+middlebox). For each, write the first three commands and the evidence you expect.</p>`)}
`
    }
  ],
  resources: [
    { title: 'Cloudflare Learning Center — Networking', url: 'https://www.cloudflare.com/learning/network-layer/what-is-a-computer-network/', source: 'Cloudflare', note: 'Friendly deep explainers for IP, DNS, TLS, and packets.' },
    { title: 'Practical Networking', url: 'https://www.practicalnetworking.net/', source: 'Practical Networking', note: 'Excellent free subnetting and packet-flow lessons.' },
    { title: 'tcpdump man page', url: 'https://www.tcpdump.org/manpages/tcpdump.1.html', source: 'tcpdump.org', note: 'Authoritative filter syntax and flags.' },
    { title: 'ip-route(8)', url: 'https://man7.org/linux/man-pages/man8/ip-route.8.html', source: 'man7', note: 'How Linux routing commands really work.' },
    { title: 'Wireshark User’s Guide', url: 'https://www.wireshark.org/docs/wsug_html/', source: 'Wireshark', note: 'GUI capture/decode skills for hard bugs.' }
  ]
};

// ===================== LINUX =====================
tutorials['linux-systems-verification'] = {
  intro: 'Build Linux lab fluency: permissions, sockets, NIC tooling, logs, and performance isolation — every command explained.',
  levels: [
    {
      id: 'basics',
      title: 'Basics',
      badge: '🌱',
      minutes: 35,
      tagline: 'Users, devices, sockets, and kernel messages',
      html: `
<p>Goal: stop treating Linux as a black box. Know <em>who you are</em>, <em>what you can open</em>, and <em>where errors land</em>.</p>

<h4>1. Who am I on this machine?</h4>
${cmd('id', [
  ['id', 'Print your user ID (uid), primary group (gid), and supplementary groups.']
])}
${cmd('groups', [
  ['groups', 'Quick list of group names — important for /dev access (e.g. dialout, docker, render).']
])}
${why('Why groups matter for SDKs',
  'Many device nodes are mode 660 root:somegroup. If your CI user is not in somegroup, open() returns EACCES — the SDK looks “broken” but the environment is wrong.')}

<h4>2. Inspect a device node</h4>
${cmd('ls -l /dev/nvidia0', [
  ['ls -l', 'Long listing: permissions, owner, group, name.'],
  ['/dev/nvidia0', 'Example char device — replace with your NIC/USB/GPU node.']
])}
<p>Read <code>crw-rw---- 1 root video</code> as: character device; owner root can rw; group video can rw; others nothing.</p>

<h4>3. Listening ports &amp; processes</h4>
${cmd('ss -lntp', [
  ['ss', 'Show socket state (connections and listeners).'],
  ['-l', 'Listening only.'],
  ['-n', 'Numeric addresses/ports.'],
  ['-t', 'TCP.'],
  ['-p', 'Process that owns the socket.']
])}
${cmd('ss -lunp', [
  ['-u', 'UDP instead of TCP — same idea for datagram listeners.']
])}

<h4>4. Kernel/driver messages</h4>
${cmd('dmesg -T | tail -50', [
  ['dmesg', 'Print the kernel ring buffer (driver probes, link flaps, oopses).'],
  ['-T', 'Human-readable timestamps.'],
  ['tail -50', 'Only the last 50 lines for a quick look.']
])}
${cmd('journalctl -k -b --no-pager | tail -50', [
  ['journalctl', 'systemd journal query tool.'],
  ['-k', 'Kernel messages only.'],
  ['-b', 'This boot only.'],
  ['--no-pager', 'Print to stdout (CI-friendly).']
])}
${callout('tip', 'First place for “driver didn’t load”', '<p>Search dmesg/journal for the module/NIC name right after failure. Userspace logs often never see the real error.</p>')}

<h4>5. Processes vs threads (interview crispness)</h4>
<p>A <strong>process</strong> owns an address space and resources (FDs, etc.). <strong>Threads</strong> are schedulable execution contexts that can share that address space. SDK bugs that appear only under load are often thread-safety bugs.</p>
`
    },
    {
      id: 'advanced',
      title: 'Advanced',
      badge: '🚀',
      minutes: 40,
      tagline: 'strace, ethtool, modules, IRQ imbalance',
      html: `
<h4>1. strace: watch syscalls fail in real time</h4>
${cmd('strace -f -o /tmp/sdk.strace ./your_test', [
  ['strace', 'Trace system calls and signals of a program.'],
  ['-f', 'Follow children/threads (critical for multi-process tests).'],
  ['-o /tmp/sdk.strace', 'Write output to a file (easier to search).'],
  ['./your_test', 'The command you are debugging.']
])}
${cmd('strace -e openat,ioctl,connect ./your_test', [
  ['-e openat,ioctl,connect', 'Only show these syscalls — less noise when you already suspect device/network.']
])}
${why('What to look for',
  'openat(...)= -1 EACCES / ENOENT, ioctl failures, connect ETIMEDOUT/ECONNREFUSED. Those errno values are the diagnosis.')}

<h4>2. ethtool deep dive</h4>
${cmd('ethtool eth0', [
  ['ethtool eth0', 'Link settings: speed, duplex, auto-neg, link detected.']
])}
${cmd('ethtool -k eth0', [
  ['-k', 'Offload features list (checksum/TSO/GRO…).']
])}
${cmd('ethtool -S eth0 | egrep -i "err|drop|disc|miss"', [
  ['-S', 'Driver stats dump.'],
  ['egrep ...', 'Filter to error/drop-like counters quickly.']
])}
${cmd('sudo ethtool -K eth0 tso off', [
  ['-K ... tso off', 'Disable one offload for A/B correctness testing.']
])}

<h4>3. Kernel modules</h4>
${cmd('uname -r', [
  ['uname -r', 'Running kernel release — modules must match this ABI.']
])}
${cmd('lsmod | head', [
  ['lsmod', 'List loaded kernel modules.']
])}
${cmd('modinfo <module>', [
  ['modinfo', 'Show module path, version, parameters, firmware deps.']
])}

<h4>4. IRQ / CPU imbalance</h4>
${cmd('grep eth0 /proc/interrupts', [
  ['/proc/interrupts', 'Per-CPU interrupt counters.'],
  ['grep eth0', 'NIC IRQs only — if one CPU column dominates, perf numbers are suspect.']
])}
${cmd('taskset -c 2-5 ./throughput_test', [
  ['taskset', 'Launch a process bound to specific CPUs.'],
  ['-c 2-5', 'Allow CPUs 2 through 5 only.'],
  ['./throughput_test', 'Your benchmark binary.']
])}
`
    },
    {
      id: 'expert',
      title: 'Expert',
      badge: '🏆',
      minutes: 35,
      tagline: 'cgroups, capabilities, perf, reproducible labs',
      html: `
<h4>1. Capabilities instead of root</h4>
${cmd('man 7 capabilities', [
  ['capabilities(7)', 'Documents CAP_* privileges that split “root powers”.']
])}
<p>Examples: <code>CAP_NET_RAW</code> for sniffing, <code>CAP_NET_ADMIN</code> for interface config. Grant only what the tool needs.</p>
${cmd('sudo setcap cap_net_raw,cap_net_admin+ep /usr/local/bin/lab-tool', [
  ['setcap', 'Attach capability bits to a binary.'],
  ['cap_net_raw,cap_net_admin+ep', 'Effective+permitted caps for network admin/raw.']
])}

<h4>2. cgroups (why containers isolate resources)</h4>
<p>cgroups limit/account CPU, memory, I/O for process groups. CI fairness and reproducible limits depend on them.</p>

<h4>3. perf quick start</h4>
${cmd('perf top', [
  ['perf top', 'Live CPU profile: which functions burn samples right now.']
])}
${cmd('perf record -g ./benchmark && perf report', [
  ['perf record -g', 'Record samples with call-graph.'],
  ['./benchmark', 'Workload under test.'],
  ['perf report', 'Interactive report of hot paths.']
])}

<h4>4. Ship a preflight script (professional bar)</h4>
<ul>
<li>Check <code>uname -r</code>, driver/module loaded, device node permissions</li>
<li>Check link up via ethtool</li>
<li>Print versions into CI artifacts</li>
<li>Fail early with a clear message</li>
</ul>
${callout('interview', 'Line that sounds experienced', `
<p>“We productized lab preflight — false failures from permissions/driver skew dropped dramatically.”</p>`)}
`
    }
  ],
  resources: [
    { title: 'Linux Journey', url: 'https://linuxjourney.com/', source: 'Linux Journey', note: 'Gentle free path through Linux fundamentals.' },
    { title: 'ss(8)', url: 'https://man7.org/linux/man-pages/man8/ss.8.html', source: 'man7', note: 'Socket statistics reference.' },
    { title: 'ethtool(8)', url: 'https://man7.org/linux/man-pages/man8/ethtool.8.html', source: 'man7', note: 'NIC settings &amp; stats flags.' },
    { title: 'strace tutorial (die.net / man)', url: 'https://man7.org/linux/man-pages/man1/strace.1.html', source: 'man7', note: 'Syscall tracer options.' },
    { title: 'Linux Performance (Brendan Gregg)', url: 'https://www.brendangregg.com/linuxperf.html', source: 'Brendan Gregg', note: 'Best free performance methodology maps.' }
  ]
};

fs.writeFileSync(path.join(__dirname, '_partial-net-linux.json'), JSON.stringify({
  'networking-l2-l3': tutorials['networking-l2-l3'],
  'linux-systems-verification': tutorials['linux-systems-verification']
}, null, 2));
console.log('wrote partial net+linux', Object.keys(tutorials));
module.exports = { cmd, why, callout, tutorials };
