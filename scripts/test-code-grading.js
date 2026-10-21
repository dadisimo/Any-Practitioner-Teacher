#!/usr/bin/env node
/**
 * Unit checks for flexible code-answer grading in app.js.
 * Run: node scripts/test-code-grading.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appPath = path.join(__dirname, '..', 'app.js');
const source = fs.readFileSync(appPath, 'utf8');

// Extract the grading helpers by evaluating app.js in a sandbox with stubs.
const sandbox = {
    console,
    document: {
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ style: {}, classList: { add() {}, remove() {}, contains() { return false; } } }),
        addEventListener() {}
    },
    window: {},
    localStorage: {
        getItem: () => null,
        setItem() {},
        removeItem() {}
    },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    alert() {},
    location: { href: '', search: '' },
    navigator: { onLine: true },
    setTimeout,
    clearTimeout,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.runInNewContext(source + '\nthis.__grade = { normalizeCodeAnswer, tokenizeCodeAnswer, codeAnswerCovers, gradeOpenAnswer, getQuestionType };', sandbox);

const {
    normalizeCodeAnswer,
    codeAnswerCovers,
    gradeOpenAnswer
} = sandbox.__grade;

const tcpdumpQuestion = {
    type: 'code',
    explanation: 'test',
    acceptedAnswers: [
        'tcpdump -i eth0 icmp -v',
        'tcpdump -i eth0 -v icmp',
        'sudo tcpdump -i eth0 icmp -v',
        'tcpdump -vi eth0 icmp'
    ],
    answerPatterns: [
        'tcpdump(?=.*-i\\s*\\S+)(?=.*\\bicmp\\b)(?=.*-v)',
        'tcpdump(?=.*-vi\\s*\\S+)(?=.*\\bicmp\\b)',
        'tcpdump(?=.*-iv\\s*\\S+)(?=.*\\bicmp\\b)'
    ]
};

const cases = [
    {
        name: 'user wifi iface + sudo + flag order',
        answer: 'sudo tcpdump -v -i wlp4s0 icmp',
        expect: true
    },
    {
        name: 'model answer',
        answer: 'tcpdump -i eth0 -v icmp',
        expect: true
    },
    {
        name: 'combined -vi',
        answer: 'tcpdump -vi eth0 icmp',
        expect: true
    },
    {
        name: 'extra -n is still ok',
        answer: 'sudo tcpdump -n -v -i ens33 icmp',
        expect: true
    },
    {
        name: 'missing verbose should fail',
        answer: 'tcpdump -i eth0 icmp',
        expect: false
    },
    {
        name: 'missing icmp should fail',
        answer: 'tcpdump -i eth0 -v',
        expect: false
    },
    {
        name: 'wrong tool should fail',
        answer: 'sudo tshark -i eth0 -v icmp',
        expect: false
    },
    {
        name: 'docker command not broken by iface normalization',
        answer: 'docker build -t demo .',
        expect: false
    }
];

let failed = 0;
for (const test of cases) {
    const got = gradeOpenAnswer(tcpdumpQuestion, test.answer);
    const ok = got === test.expect;
    console.log(`${ok ? '✅' : '❌'} ${test.name}`);
    if (!ok) {
        failed++;
        console.log(`   answer: ${test.answer}`);
        console.log(`   expected ${test.expect}, got ${got}`);
        console.log(`   normalized: ${normalizeCodeAnswer(test.answer)}`);
        console.log(`   covers model: ${codeAnswerCovers(test.answer, 'tcpdump -i eth0 -v icmp')}`);
    }
}

// ethtool bare-iface flexibility
const ethtoolQuestion = {
    type: 'code',
    explanation: 'test',
    acceptedAnswers: ['ethtool -k eth0', 'sudo ethtool -k eth0']
};
const ethtoolOk = gradeOpenAnswer(ethtoolQuestion, 'sudo ethtool -k wlp4s0') === true
    && gradeOpenAnswer(ethtoolQuestion, 'ethtool -k eth0') === true
    && gradeOpenAnswer(ethtoolQuestion, 'ethtool -k') === false;
console.log(`${ethtoolOk ? '✅' : '❌'} ethtool accepts alternate iface`);
if (!ethtoolOk) failed++;

// ip route still exact about gateway
const routeQuestion = {
    type: 'code',
    explanation: 'test',
    acceptedAnswers: [
        'ip route add default via 192.168.1.1',
        'sudo ip route add default via 192.168.1.1'
    ]
};
const routeOk = gradeOpenAnswer(routeQuestion, 'sudo ip route add default via 192.168.1.1') === true
    && gradeOpenAnswer(routeQuestion, 'ip route add default via 10.0.0.1') === false;
console.log(`${routeOk ? '✅' : '❌'} ip route still checks gateway`);
if (!routeOk) failed++;

if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
}
console.log('\nAll code-grading checks passed');
