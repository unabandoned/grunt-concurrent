'use strict';
const {describe, it, before} = require('node:test');
const {strict: assert} = require('assert');
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const root = path.join(__dirname, '..');
const tmp = path.join(__dirname, 'tmp');
const gruntBin = require.resolve('grunt/bin/grunt');

const grunt = (...args) => spawnSync(process.execPath, [gruntBin, ...args], {cwd: root, encoding: 'utf8'});

const runGrunt = (...args) => {
	const result = grunt(...args);
	assert.equal(result.status, 0, `grunt ${args.join(' ')} failed:\n${result.stdout}${result.stderr}`);
	return result;
};

const read = name => fs.readFileSync(path.join(tmp, name), 'utf8');

describe('concurrent', () => {
	before(() => {
		fs.rmSync(tmp, {recursive: true, force: true});
		runGrunt('concurrent:test', 'concurrent:testSequence');
	});

	it('runs grunt tasks successfully', () => {
		assert(fs.existsSync(path.join(tmp, '1')));
		assert(fs.existsSync(path.join(tmp, '2')));
		assert(fs.existsSync(path.join(tmp, '3')));
	});

	it('runs grunt task sequence successfully', () => {
		const file5 = fs.statSync(path.join(tmp, '5'));
		const file6 = fs.statSync(path.join(tmp, '6'));
		assert.ok(file5.ctimeMs < file6.ctimeMs);
	});

	it('forwards CLI args to grunt sub-processes', () => {
		const expected = '--arg1=test,--arg2';
		runGrunt('concurrent:testargs', '--arg1=test', '--arg2');
		assert.ok(read('args1').includes(expected));
		assert.ok(read('args2').includes(expected));
	});

	it('fails when a sub-task fails', () => {
		const result = grunt('concurrent:fail');
		assert.notEqual(result.status, 0);
		assert.match(result.stdout, /testFail failed on purpose/);
	});

	it('honours the `limit` option', () => {
		const result = runGrunt('concurrent:limited');
		assert.match(result.stdout, /more tasks than your concurrency limit/);
		const out = result.stdout;
		assert.ok(out.indexOf('test2') < out.indexOf('test3'), 'with limit 1 the tasks run in order');
	});

	describe('`logConcurrentOutput` option', () => {
		let logOutput = '';

		before(() => {
			logOutput = runGrunt('concurrent:log').stdout;
		});

		it('outputs concurrent logging', () => {
			assert(logOutput.includes('Running "concurrent:log" (concurrent) task'));
		});

		it('streams sub-task output indented line by line', () => {
			const lines = logOutput.split('\n');
			assert.ok(lines.includes('    indent test output'));
			assert.ok(lines.includes('    line one'));
			assert.ok(lines.includes('    '), 'blank lines are padded too');
			assert.ok(lines.includes('    line three'));
		});
	});

	describe('works with supports-color', () => {
		it('ensures that colors are supported by default', () => {
			runGrunt('concurrent:colors');
			assert.equal(read('colors'), 'true');
		});

		it('doesn\'t support colors with --no-color option', () => {
			runGrunt('concurrent:colors', '--no-color');
			assert.equal(read('colors'), 'false');
		});
	});

	describe('`indent` option', () => {
		const testOutput = 'indent test output';
		const indentedTestOutput = '    ' + testOutput;

		it('indents output when true', () => {
			assert.ok(runGrunt('concurrent:indentTrue').stdout.split('\n').includes(indentedTestOutput));
		});

		it('does not indent output when false', () => {
			assert.ok(runGrunt('concurrent:indentFalse').stdout.split('\n').includes(testOutput));
		});

		it('does not indent output when false and logConcurrentOutput is true', () => {
			assert.ok(runGrunt('concurrent:indentFalseConcurrentOutput').stdout.split('\n').includes(testOutput));
		});

		it('indents output by default', () => {
			assert.ok(runGrunt('concurrent:indentDefault').stdout.split('\n').includes(indentedTestOutput));
		});
	});
});
